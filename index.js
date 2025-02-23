// index.js

const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Import setting.js
let settings = require('./setting');

// Impor fungsi handleCase (pastikan file case.js sudah disiapkan)
const { handleCase } = require('./case');

/**
 * Fungsi untuk meminta input dari terminal.
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Menu Setting: Update file setting.js (misal: nomor owner)
 */
async function updateSetting() {
  console.log(chalk.yellow("\n-- Setting --"));
  console.log("Setting saat ini:");
  console.log("Owner: " + settings.owner);
  const newOwner = await askQuestion("Masukkan nomor owner baru (format: 628xxxxxxxxxx@s.whatsapp.net) atau tekan Enter untuk membatalkan: ");
  if (newOwner.trim() !== "") {
    // Buat isi file setting.js baru
    const content = `module.exports = {\n  owner: '${newOwner.trim()}'\n};\n`;
    fs.writeFileSync(path.join(__dirname, 'setting.js'), content, 'utf8');
    console.log(chalk.green("Setting telah diperbarui."));
    // Muat ulang setting
    delete require.cache[require.resolve('./setting')];
    settings = require('./setting');
  } else {
    console.log(chalk.gray("Tidak ada perubahan."));
  }
  // Kembali ke menu utama
  await mainMenu();
}

/**
 * Fungsi untuk memulai koneksi WhatsApp.
 */
async function startSock() {
  try {
    // Cek apakah state autentikasi sudah tersedia
    const authDir = 'auth_info';
    if (!fs.existsSync(authDir) || fs.readdirSync(authDir).length === 0) {
      // Jika belum ada state, lakukan autentikasi
      await authenticateUser();
    } else {
      console.log(chalk.green("Sesi terdeteksi, melewati proses login."));
    }

    // Inisialisasi state autentikasi dan ambil versi terbaru dari Baileys
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    // Buat instance socket WhatsApp
    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      version
    });

    // Simpan kredensial jika terjadi update
    sock.ev.on('creds.update', saveCreds);

    // Tangani update koneksi
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr, pairing } = update;
      if (qr) {
        qrcode.generate(qr, { small: true });
        console.log(chalk.yellow("Scan QR Code di atas untuk masuk ke WhatsApp!"));
      }
      if (pairing) {
        console.log(chalk.green("Gunakan pairing code: " + pairing.pairingCode));
      }
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(chalk.red("Koneksi terputus:"), lastDisconnect.error, "Reconnect:", shouldReconnect);
        if (shouldReconnect) {
          setTimeout(() => startSock(), 3000);
        }
      } else if (connection === 'open') {
        console.log(chalk.green("Koneksi berhasil terbuka"));
      }
    });

    // Tangani pesan masuk
    sock.ev.on('messages.upsert', async m => {
      try {
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return;
        const sender = message.key.remoteJid;
        const timestamp = new Date().toLocaleString();
        let text = '';
        if (message.message.conversation) {
          text = message.message.conversation;
        } else if (message.message.extendedTextMessage) {
          text = message.message.extendedTextMessage.text;
        }
        console.log(chalk.blue('-------------------------------------------------'));
        console.log(chalk.yellow(`Waktu   : ${timestamp}`));
        console.log(chalk.magenta(`Pengirim: ${sender}`));
        console.log(chalk.green(`Pesan   : ${text}`));
        console.log(chalk.blue('-------------------------------------------------'));
        // Proses pesan dengan fungsi handleCase
        handleCase(sock, message);
      } catch (error) {
        console.error(chalk.red("Error processing message:"), error);
      }
    });

    // Mulai polling untuk memeriksa pembaruan kode setiap 1 menit
    setInterval(() => {
      checkForRemoteUpdates(sock);
    }, 60000);

  } catch (error) {
    console.error(chalk.red("Error in startSock:"), error);
  }
}

/**
 * Fungsi autentikasi:
 * Mengambil konfigurasi user dari GitHub dan meminta input username & password.
 */
async function authenticateUser() {
  const configData = await fetchConfig();
  if (!Array.isArray(configData) || configData.length === 0) {
    console.error(chalk.red("Konfigurasi user tidak valid atau kosong:"), JSON.stringify(configData, null, 2));
    process.exit(1);
  }
  console.log(chalk.blue("Silakan login menggunakan username dan password:"));
  const inputUsername = (await askQuestion("Username: ")).trim();
  const inputPassword = (await askQuestion("Password: ")).trim();
  console.log(chalk.gray(`DEBUG: Input Username: '${inputUsername}', Password: '${inputPassword}'`));
  const foundUser = configData.find(user => user.username === inputUsername && user.password === inputPassword);
  console.log(chalk.gray("DEBUG: Found User:"), foundUser);
  if (foundUser) {
    console.log(chalk.green("Login berhasil!"));
    return true;
  } else {
    console.log(chalk.red("Login gagal. Username atau password salah."));
    process.exit(1);
  }
}

/**
 * Fungsi untuk mengambil konfigurasi user dari GitHub.
 */
async function fetchConfig() {
  const url = 'https://raw.githubusercontent.com/latesturl/dbRaolProjects/main/dbconfig.json';
  try {
    const response = await axios.get(url);
    console.log(chalk.gray("DEBUG: Fetched config data:"), JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(chalk.red('Failed to fetch config:'), error);
    return null;
  }
}

/**
 * Fungsi untuk memeriksa pembaruan file remote (index.js dan case.js).
 * Normalisasi konten dengan trim() agar perbedaan whitespace tidak terdeteksi.
 */
async function checkForRemoteUpdates(sock) {
  const filesToCheck = [
    { localFile: 'index.js', remoteUrl: 'https://raw.githubusercontent.com/Marshalyel/Mars/master/index.js' },
    { localFile: 'case.js', remoteUrl: 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js' }
  ];
  for (const fileObj of filesToCheck) {
    try {
      const remoteResponse = await axios.get(fileObj.remoteUrl);
      let remoteContent = remoteResponse.data.trim();
      let localContent = fs.readFileSync(fileObj.localFile, 'utf8').trim();
      if (localContent !== remoteContent) {
        const ownerJid = settings.owner;
        const warnMessage = `Peringatan: Terdeteksi perubahan kode pada ${fileObj.localFile} di GitHub. Silakan lakukan !update.`;
        await sock.sendMessage(ownerJid, { text: warnMessage });
        console.log(chalk.yellow(`Peringatan dikirim ke ${ownerJid} karena ${fileObj.localFile} berbeda.`));
        break;
      }
    } catch (error) {
      console.error(chalk.red(`Gagal memeriksa pembaruan untuk ${fileObj.localFile}:`), error);
    }
  }
}

/**
 * Menu utama di console.
 */
async function mainMenu() {
  console.clear();
  console.log(chalk.blue("=========================================="));
  console.log(chalk.blue("         CONSOLE MENU BOT WHATSAPP        "));
  console.log(chalk.blue("=========================================="));
  console.log("Owner: " + settings.owner);
  console.log("1. Interaksi (Bot berjalan & berinteraksi)");
  console.log("2. Setting (Ubah konfigurasi, misal nomor owner)");
  console.log("3. Exit");
  const choice = await askQuestion("Pilih opsi (1/2/3): ");
  if (choice.trim() === "1") {
    // Jalankan bot (interaksi)
    startSock();
  } else if (choice.trim() === "2") {
    await updateSetting();
  } else if (choice.trim() === "3") {
    console.log(chalk.green("Keluar..."));
    process.exit(0);
  } else {
    console.log(chalk.red("Pilihan tidak valid."));
    await mainMenu();
  }
}

// Mulai dengan menampilkan menu utama
mainMenu();
