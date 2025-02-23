// index.js

const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');

// Impor fungsi penanganan pesan (pastikan file case.js sudah disiapkan)
const { handleCase } = require('./case');

/**
 * Mengambil konfigurasi (array user) dari GitHub menggunakan axios.
 * URL harus mengarah ke file JSON raw yang valid dan berbentuk array.
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
 * Meminta input dari terminal menggunakan modul readline.
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Fungsi autentikasi:
 * - Mengambil array user dari GitHub.
 * - Meminta input username dan password.
 * - Mencari user yang cocok di dalam array.
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

  const foundUser = configData.find(user => 
    user.username === inputUsername && user.password === inputPassword
  );

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
 * Fungsi untuk memeriksa apakah ada perubahan kode pada file remote di GitHub.
 * Jika terdapat perbedaan antara konten lokal dan remote, maka mengirim peringatan
 * ke nomor 6281523772093@s.whatsapp.net agar melakukan !update.
 *
 * @param {Object} sock - Instance WhatsApp socket dari Baileys.
 */
async function checkForRemoteUpdates(sock) {
  // Daftar file yang akan dicek beserta URL remote-nya
  const filesToCheck = [
    { localFile: 'index.js', remoteUrl: 'https://raw.githubusercontent.com/Marshalyel/Mars/master/index.js' },
    { localFile: 'case.js', remoteUrl: 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js' }
  ];

  for (const fileObj of filesToCheck) {
    try {
      const remoteResponse = await axios.get(fileObj.remoteUrl);
      const remoteContent = remoteResponse.data;
      const localContent = fs.readFileSync(fileObj.localFile, 'utf8');

      if (localContent !== remoteContent) {
        // Jika terdapat perbedaan, kirim peringatan ke nomor owner (hanya satu kali)
        const ownerJid = '6281523772093@s.whatsapp.net';
        const warnMessage = `Peringatan: Terdeteksi perubahan kode pada ${fileObj.localFile} di GitHub. Silakan lakukan !update.`;
        await sock.sendMessage(ownerJid, { text: warnMessage });
        console.log(chalk.yellow(`Peringatan dikirim ke ${ownerJid} karena ${fileObj.localFile} berbeda.`));
        // Keluar dari loop setelah mengirim peringatan untuk menghindari spam
        break;
      }
    } catch (error) {
      console.error(chalk.red(`Gagal memeriksa pembaruan untuk ${fileObj.localFile}:`), error);
    }
  }
}

/**
 * Fungsi utama untuk memulai koneksi WhatsApp.
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
      printQRInTerminal: false, // QR Code akan ditampilkan manual
      auth: state,
      version
    });

    // Simpan kredensial jika terjadi update
    sock.ev.on('creds.update', saveCreds);

    // Tangani update koneksi, tampilkan QR Code dan pairing code jika ada
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr, pairing } = update;

      if (qr) {
        qrcode.generate(qr, { small: true });
        console.log(chalk.yellow("Scan QR Code di atas untuk masuk ke WhatsApp!"));
      }

      if (pairing) {
        console.log(chalk.green("Gunakan pairing code berikut untuk terhubung: " + pairing.pairingCode));
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(chalk.red("Koneksi terputus:"), lastDisconnect.error, "Reconnect:", shouldReconnect);
        if (shouldReconnect) {
          // Tambahkan delay sebelum mencoba reconnect untuk mencegah rekursi cepat
          setTimeout(() => startSock(), 3000);
        }
      } else if (connection === 'open') {
        console.log(chalk.green("Koneksi berhasil terbuka"));
      }
    });

    // Tangani pesan masuk dan tampilkan log pesan secara rapi
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

        // Proses pesan menggunakan fungsi handleCase (di file case.js)
        handleCase(sock, message);
      } catch (error) {
        console.error(chalk.red("Error processing message:"), error);
      }
    });

    // Mulai polling untuk memeriksa pembaruan kode secara periodik (misalnya setiap 1 menit)
    setInterval(() => {
      checkForRemoteUpdates(sock);
    }, 60000); // 60000 ms = 1 menit

  } catch (error) {
    console.error(chalk.red("Error in startSock:"), error);
  }
}

// Jalankan fungsi utama
startSock();
