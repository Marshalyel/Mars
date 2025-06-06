//
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pino = require('pino');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Muat setting owner dari file setting.js
let settings = require('./setting');

// File untuk menyimpan last chat
const LAST_CHAT_FILE = path.join(__dirname, 'lastchat.txt');

function saveLastChatId(chatId) {
  fs.writeFileSync(LAST_CHAT_FILE, chatId, 'utf8');
}

function readLastChatId() {
  try {
    return fs.readFileSync(LAST_CHAT_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}


// Memuat idchat terakhir
let lastChatId = null;

// Muat plugin gempa dan azan (jika tersedia)
const gempaPlugin = require('./plugins/gempa');
let azanPlugin;
try {
  azanPlugin = require('./plugins/azan');
} catch (e) {
  console.error(chalk.red("Plugin azan tidak ditemukan atau error:"), e);
}

// Global flag untuk self mode (default: off)
let selfMode = false;

// Cache untuk ID pesan yang sudah diproses agar tidak terjadi duplikasi
const processedMessages = new Set();

/**
 * Fungsi helper untuk meminta input dari terminal.
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
 * Konfigurasi Nodemailer untuk mengirim email.
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: settings.email,      // Ganti dengan email Anda
    pass: settings.emailpass            // Ganti dengan app password Gmail Anda
  }
});

/**
 * Fungsi untuk mengirim kredensial login ke email user.
 */
async function sendLoginEmail(userEmail) {
  const username = `user${Math.floor(Math.random() * 10000)}`;
  const password = crypto.randomBytes(4).toString("hex"); // menghasilkan password 8 karakter
  const loginDetails = { username, password };

  const mailOptions = {
    from: settings.email,
    to: userEmail,
    subject: "Login Credentials for WhatsApp Bot",
    text: `Halo,\n\nBerikut adalah kredensial login Anda:\nUsername: ${username}\nPassword: ${password}\n\nGunakan kredensial ini untuk mengakses bot WhatsApp.\n\nTerima kasih!`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email berhasil dikirim ke ${userEmail}`);
    return loginDetails;
  } catch (error) {
    console.error("Gagal mengirim email:", error);
    return null;
  }
}

/**
 * Fungsi autentikasi dengan email.
 */
async function authenticateWithEmail() {
  const userEmail = await askQuestion("Masukkan email Anda: ");
  console.log("Mengirim kredensial ke", userEmail, "...");
  const credentials = await sendLoginEmail(userEmail);
  if (!credentials) {
    console.error("Gagal mengirim kredensial. Coba lagi.");
    process.exit(1);
  }
  const inputUsername = await askQuestion("Masukkan username yang dikirim ke email: ");
  const inputPassword = await askQuestion("Masukkan password yang dikirim ke email: ");
  if (inputUsername.trim() === credentials.username && inputPassword.trim() === credentials.password) {
    console.log("Login berhasil!");
    console.log("Silahkan masukkan nomor telepon (+62)");
    return true;
  } else {
    console.error("Login gagal. Username atau password salah.");
    process.exit(1);
  }
}

/**
 * Fungsi untuk mengambil konfigurasi user dari GitHub.
 */
async function fetchConfig() {
  
  try {
    const response = await axios.get(settings.dburl);
    console.log(chalk.gray("DEBUG: Fetched config data:"), JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(chalk.red("Failed to fetch config:"), error);
    return null;
  }
}

/**
 * Fungsi autentikasi konvensional (melalui GitHub config).
 * Data diharapkan berupa array dengan properti "USERNAME" dan "PASSWORD".
 */
async function authenticateUser() {
  const configData = await fetchConfig();
  let users = [];
  if (Array.isArray(configData)) {
    users = configData;
  } else if (configData && Array.isArray(configData.users)) {
    users = configData.users;
  } else {
    console.error(chalk.red("Konfigurasi user tidak valid:"), JSON.stringify(configData, null, 2));
    process.exit(1);
  }
  
  console.log(chalk.blue("Silakan login menggunakan username dan password:"));
  const inputUsername = (await askQuestion("Username: ")).trim();
  const inputPassword = (await askQuestion("Password: ")).trim();
  console.log(chalk.gray(`DEBUG: Input Username: '${inputUsername}', Password: '${inputPassword}'`));
  
  const foundUser = users.find(user => {
    return user.USERNAME && user.PASSWORD &&
           user.USERNAME.toString().trim() === inputUsername &&
           user.PASSWORD.toString().trim() === inputPassword;
  });
  
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
 * Fungsi untuk memeriksa apakah owner sudah disetting.
 */
async function checkOwner() {
  if (!settings.owner || settings.owner.trim() === '') {
    console.log(chalk.yellow("Owner belum disetting."));
    const newOwner = await askQuestion("Masukkan nomor owner baru (format: 628xxxxxxxxxx@s.whatsapp.net): ");
    if (newOwner.trim() !== "") {
      updateOwnerSetting(newOwner);
    } else {
      console.log(chalk.red("Owner tidak boleh kosong. Program dihentikan."));
      process.exit(1);
    }
  } else {
    console.log(chalk.green("Owner: " + settings.owner));
  }
}

/**
 * Fungsi untuk mengupdate file setting.js dengan owner baru.
 */
function updateOwnerSetting(newOwner) {
  const content = `module.exports = {\n  owner: '${newOwner.trim()}'\n};\n`;
  fs.writeFileSync(path.join(__dirname, 'setting.js'), content, 'utf8');
  console.log(chalk.green("Setting telah diperbarui dengan owner: " + newOwner));
  delete require.cache[require.resolve('./setting')];
}

/**
 * Fungsi helper untuk mengekstrak teks dari pesan berdasarkan struktur objek pesan Baileys.
 */
function getMessageText(m) {
  if (!m.message) return '';
  if (m.message.conversation) return m.message.conversation;
  if (m.message.extendedTextMessage && m.message.extendedTextMessage.text) return m.message.extendedTextMessage.text;
  if (m.message.imageMessage && m.message.imageMessage.caption) return m.message.imageMessage.caption;
  if (m.message.videoMessage && m.message.videoMessage.caption) return m.message.videoMessage.caption;
  if (m.message.buttonsResponseMessage) {
    return m.message.buttonsResponseMessage.selectedDisplayText || m.message.buttonsResponseMessage.selectedButtonId || '';
  }
  if (m.message.listResponseMessage && m.message.listResponseMessage.singleSelectReply && m.message.listResponseMessage.singleSelectReply.selectedRowId) {
    return m.message.listResponseMessage.singleSelectReply.selectedRowId;
  }
  if (m.message.templateButtonReplyMessage && m.message.templateButtonReplyMessage.selectedId) {
    return m.message.templateButtonReplyMessage.selectedId;
  }
  return m.text || '';
}

/**
 * Fungsi untuk memeriksa pembaruan file remote (index.js, case.js) dan plugin.
 */
async function checkForRemoteUpdates(sock) {
  const filesToCheck = [
    { localFile: 'index.js', remoteUrl: settings.remoteIndexUrl },
    { localFile: 'case.js', remoteUrl: settings.remoteCaseUrl }
  ];
  for (const fileObj of filesToCheck) {
    try {
      const remoteResponse = await axios.get(fileObj.remoteUrl);
      let remoteContent = remoteResponse.data;
      if (typeof remoteContent !== 'string') {
        remoteContent = JSON.stringify(remoteContent, null, 2);
      } else {
        remoteContent = remoteContent.trim();
      }
      let localContent = fs.readFileSync(fileObj.localFile, 'utf8').trim();
      if (localContent !== remoteContent) {
        const ownerJid = settings.owner;
        const warnMessage = `Peringatan: Terdeteksi perubahan pada ${fileObj.localFile} di GitHub. Silakan lakukan !update.`;
        await sock.sendMessage(ownerJid, { text: warnMessage });
        console.log(chalk.yellow(`Peringatan dikirim ke ${ownerJid} karena ${fileObj.localFile} berbeda.`));
        break;
      }
    } catch (error) {
      console.error(chalk.red(`Gagal memeriksa pembaruan untuk ${fileObj.localFile}:`), error);
    }
  }

  const pluginsPath = path.join(__dirname, 'plugins');
  if (fs.existsSync(pluginsPath)) {
    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
      try {
        const remotePluginUrl = settings.plgnurl + file;
        const remoteResponse = await axios.get(remotePluginUrl);
        let remoteContent = remoteResponse.data;
        if (typeof remoteContent !== 'string') {
          remoteContent = JSON.stringify(remoteContent, null, 2);
        } else {
          remoteContent = remoteContent.trim();
        }
        let localContent = fs.readFileSync(path.join(pluginsPath, file), 'utf8').trim();
        if (localContent !== remoteContent) {
          const ownerJid = settings.owner;
          const warnMessage = `Peringatan: Terdeteksi perubahan pada plugin ${file} di GitHub. Silakan lakukan !update plugins.`;
          await sock.sendMessage(ownerJid, { text: warnMessage });
          console.log(chalk.yellow(`Peringatan dikirim ke ${ownerJid} karena plugin ${file} berbeda.`));
          break;
        }
      } catch (error) {
        console.error(chalk.red(`Gagal memeriksa pembaruan untuk plugin ${file}:`), error);
      }
    }
  }
}

/**
 * Fungsi updateFile: mengambil konten file remote dan menimpanya secara lokal.
 */
async function updateFile(sock, message, fileName, remoteUrl) {
  const chatId = message.key.remoteJid;
  try {
    const response = await axios.get(remoteUrl);
    let newContent = response.data;
    if (typeof newContent !== 'string') {
      newContent = JSON.stringify(newContent, null, 2);
    } else {
      newContent = newContent.trim();
    }
    const localPath = path.join(__dirname, fileName);
    fs.writeFileSync(localPath, newContent, 'utf8');
    await sock.sendMessage(chatId, { text: `${fileName} telah diperbarui.` });
    console.log(chalk.green(`${fileName} updated successfully.`));
  } catch (error) {
    console.error(chalk.red(`Gagal memperbarui ${fileName}:`), error);
    await sock.sendMessage(chatId, { text: `Gagal memperbarui ${fileName}.` });
  }
}

/**
 * Fungsi updatePlugins: mengambil daftar file plugin dari GitHub dan menimpanya ke folder plugins.
 */
async function updatePlugins(sock, message) {
  const pluginsPath = path.join(__dirname, 'plugins');
  if (!fs.existsSync(pluginsPath)) {
    fs.mkdirSync(pluginsPath, { recursive: true });
  }
  try {
    const response = await axios.get(settings.apiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Format API tidak sesuai.');
    }
    for (const fileObj of response.data) {
      if (fileObj.type === 'file' && fileObj.name.endsWith('.js')) {
        const remoteUrl = fileObj.download_url;
        console.log(`Memperbarui plugin: ${fileObj.name}`);
        await updateFile(sock, message, path.join('plugins', fileObj.name), remoteUrl);
      }
    }
    await sock.sendMessage(message.key.remoteJid, { text: "Semua plugin telah diperbarui." });
  } catch (error) {
    console.error(chalk.red("Gagal memperbarui plugins:"), error);
    await sock.sendMessage(message.key.remoteJid, { text: "Gagal memperbarui plugins." });
  }
}

/**
 * Fungsi utama untuk memulai koneksi WhatsApp.
 */
async function startSock() {
  try {
    const authDir = 'auth_info';
    if (!fs.existsSync(authDir) || fs.readdirSync(authDir).length === 0) {
      console.log(chalk.yellow("Belum ada sesi autentikasi WhatsApp."));
      console.log(chalk.blue("Pilih metode login:"));
      console.log(chalk.blue("1. Login via Gmail"));
      console.log(chalk.blue("2. Login via GitHub config"));
      const choice = await askQuestion("Masukkan pilihan (1/2): ");
      if (choice.trim() === "1") {
        await authenticateWithEmail();
      } else if (choice.trim() === "2") {
        await authenticateUser();
      } else {
        console.log(chalk.red("Pilihan tidak valid. Program dihentikan."));
        process.exit(1);
      }
    } else {
      console.log(chalk.green("Sesi autentikasi terdeteksi, melewati proses login."));
    }
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      version
    });

  sock.ev.on('creds.update', saveCreds);

  if (!state.creds.registered) {
    try {
        const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, ans => resolve(ans)));
        
      const phoneNumber = await question('Masukkan nomor WhatsApp (62xxxxxxxxxx): ');
      const cleanedNumber = phoneNumber.trim().replace(/[^0-9]/g, '');
      if (!cleanedNumber.startsWith('62')) {
        console.log("Nomor pairing diawali 62");
        process.exit(1);
      }
      const pairingResult = await sock.requestPairingCode(cleanedNumber);
      if (!pairingResult || typeof pairingResult !== 'string') {
        console.log("error pairing kode tidak bisa didapatkan");
        process.exit(1);
      }
      console.log(`Pairing code: ${chalk.yellow(pairingResult)}`);
      console.log('Gunakan kode ini untuk pairing dalam 60 detik');
    } catch (error) {
      console.log(`Gagal meminta pairing code: ${error.message}`);
      process.exit(1);
    }
  }
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr, pairing } = update;
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(chalk.red("Koneksi terputus:"), lastDisconnect.error, "Reconnect:", shouldReconnect);
        if (shouldReconnect) {
          setTimeout(() => startSock(), 3000);
        }
      } else if (connection === 'open') {
        console.log(chalk.green("Koneksi berhasil terbuka"));
             // === Input via console untuk kirim pesan manual ===
     const rl = readline.createInterface({
       input: process.stdin,
       output: process.stdout
     });
   rl.on('line', async line => {
        const inp = line.trim();
        if (inp.toLowerCase().startsWith('balas ')) {
          const text = inp.slice(6).trim();
          const chatId = readLastChatId();
          if (!chatId) return console.log(chalk.yellow('No last chat'));
          await sock.sendMessage(chatId,{text});
          console.log(chalk.green('Replied to ' + chatId));
          return;
        }
        const [chatId, ...parts] = inp.split(' ');
        const text = parts.join(' ');
        if (!chatId||!text) return console.log(chalk.yellow('Use: <chatId> <msg> or balas <msg>'));
        await sock.sendMessage(chatId,{text});
        console.log(chalk.green('Sent to ' + chatId));
      });

     // ==================================================


      }
    });
    sock.ev.on('messages.upsert', async (m) => {
      try {
        // Proses setiap pesan di dalam array m.messages
        for (const message of m.messages) {
          // Abaikan pesan jika tidak memiliki message atau berasal dari bot sendiri
          if (!message || !message.key || !message.message || message.key.fromMe) continue;
          // Cek apakah pesan sudah diproses menggunakan ID pesan
          const messageId = message.key.id;
          if (processedMessages.has(messageId)) {
            console.log(`Pesan dengan ID ${messageId} sudah diproses.`);
            // ← SIMPAN CHAT TERAKHIR DI SINI
            lastChatId = message.key.id;
            saveLastChatId(message.key.id);
            continue;
          }
          // Tandai pesan sebagai telah diproses
          processedMessages.add(messageId);
          // Ekstrak teks pesan menggunakan fungsi helper
          let text = getMessageText(message).trim();
          if (!text) {
            console.log("Pesan tanpa teks diterima, tidak diproses.");
            continue;
          }
          console.log(chalk.blue('-------------------------------------------------'));
          const timestamp = new Date().toLocaleString();
          console.log(chalk.yellow(`Waktu   : ${timestamp}`));
          console.log(chalk.magenta(`Pengirim: ${message.key.remoteJid}`));
          console.log(chalk.green(`Pesan   : ${text}`));
          console.log(chalk.blue('-------------------------------------------------'));
          
          // Tandai pesan jika mengandung gambar
          if (message.message.imageMessage) {
            message.containsImage = true;
          }
          require('./case').handleCase(sock, message);
        }
      } catch (error) {
        console.error(chalk.red("Error processing message:"), error);
      }
    });
    // Cek pembaruan file remote (index.js, case.js, plugins) setiap 60 detik
    setInterval(() => {
      checkForRemoteUpdates(sock);
    }, 60000);
    // Cek update data gempa secara periodik (dari plugin gempa)
    setInterval(() => {
      gempaPlugin.autoCheck(sock);
    }, 60000);
    // Cek update jadwal azan secara periodik (jika plugin azan tersedia)
    if (azanPlugin && typeof azanPlugin.autoRun === 'function') {
      setInterval(() => {
        azanPlugin.autoRun(sock);
      }, 60000);
    }
  } catch (error) {
    console.error(chalk.red("Error in startSock:"), error);
  }
}

/**
 * Proses utama: pilih metode login (jika belum ada sesi), periksa setting owner, lalu jalankan bot.
 */
async function main() {
  await checkOwner();
  startSock();
}

main();