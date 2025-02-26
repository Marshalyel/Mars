const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const pino = require('pino');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Muat setting owner dari file setting.js
let settings = require('./setting');
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

/**
 * Fungsi untuk meminta input dari terminal.
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
 * Konfigurasi nodemailer untuk mengirim email.
 * Pastikan Anda mengganti user dan pass dengan kredensial email yang valid.
 */
const transporter = nodemailer.createTransport({
  service: "gmail", // ganti sesuai dengan penyedia email Anda
  auth: {
    user: "your-email@gmail.com", // ganti dengan email Anda
    pass: "your-email-password"   // ganti dengan password atau app password
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
    from: "your-email@gmail.com", // ganti dengan email Anda
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
 * User memasukkan email, bot mengirim kredensial, lalu user memasukkan kembali kredensial tersebut.
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
  if (inputUsername === credentials.username && inputPassword === credentials.password) {
    console.log("Login berhasil!");
    return true;
  } else {
    console.error("Login gagal. Username atau password salah.");
    process.exit(1);
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
  settings = require('./setting');
}

/**
 * Fungsi untuk memeriksa apakah owner sudah terdefinisi.
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
 * Fungsi untuk mengambil konfigurasi user dari GitHub.
 */
async function fetchConfig() {
  const url = 'https://raw.githubusercontent.com/latesturl/dbRaolProjects/main/dbconfig.json';
  try {
    const response = await axios.get(url);
    console.log(chalk.gray("DEBUG: Fetched config data:"), JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(chalk.red("Failed to fetch config:"), error);
    return null;
  }
}

/**
 * Fungsi autentikasi: mengambil array user, meminta username & password,
 * dan mencocokkan kredensial.
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
 * Fungsi untuk memeriksa pembaruan file remote pada file base (index.js dan case.js)
 * serta file-file dalam folder plugins. (Package.json tidak diperiksa otomatis)
 */
async function checkForRemoteUpdates(sock) {
  const filesToCheck = [
    { localFile: 'index.js', remoteUrl: 'https://raw.githubusercontent.com/Marshalyel/Mars/master/index.js' },
    { localFile: 'case.js', remoteUrl: 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js' }
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

  // Cek file di folder plugins
  const pluginsPath = path.join(__dirname, 'plugins');
  if (fs.existsSync(pluginsPath)) {
    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
      try {
        const remoteUrl = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/plugins/' + file;
        const remoteResponse = await axios.get(remoteUrl);
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
 * Fungsi updatePlugins: mengambil daftar file plugin dari GitHub menggunakan API,
 * dan menimpa file lokal di folder plugins.
 */
async function updatePlugins(sock, message) {
  const pluginsPath = path.join(__dirname, 'plugins');
  if (!fs.existsSync(pluginsPath)) {
    fs.mkdirSync(pluginsPath, { recursive: true });
  }
  try {
    const apiUrl = 'https://api.github.com/repos/Marshalyel/Mars/contents/plugins';
    const response = await axios.get(apiUrl, {
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
 * Fungsi untuk mengautentikasi user melalui email.
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
  if (inputUsername === credentials.username && inputPassword === credentials.password) {
    console.log("Login berhasil!");
    return true;
  } else {
    console.error("Login gagal. Username atau password salah.");
    process.exit(1);
  }
}

/**
 * Fungsi untuk mengirim email berisi kredensial login.
 */
async function sendLoginEmail(userEmail) {
  const username = `user${Math.floor(Math.random() * 10000)}`;
  const password = crypto.randomBytes(4).toString("hex"); // 8 karakter
  const loginDetails = { username, password };

  const mailOptions = {
    from: "your-email@gmail.com", // Ganti dengan email Anda
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

// Konfigurasi Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail", // Ganti dengan penyedia email Anda
  auth: {
    user: "your-email@gmail.com", // Ganti dengan email Anda
    pass: "your-email-password"   // Ganti dengan password atau App Password
  }
});

/**
 * Fungsi utama untuk memulai koneksi WhatsApp.
 */
async function startSock() {
  try {
    const authDir = 'auth_info';
    if (!fs.existsSync(authDir) || fs.readdirSync(authDir).length === 0) {
      await authenticateUser();
    } else {
      console.log(chalk.green("Sesi terdeteksi, melewati proses login."));
    }
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      version
    });
    sock.ev.on('creds.update', saveCreds);
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
    sock.ev.on('messages.upsert', async m => {
      try {
        const message = m.messages[0];
        if (!message || !message.key || !message.message) return;
        // Proses perintah !self on/off
        const sender = message.key.remoteJid;
        const text = (message.message.conversation || message.message.extendedTextMessage?.text || "").trim();
        if (text.startsWith("!self")) {
          const parts = text.split(" ");
          if (parts[1] && parts[1].toLowerCase() === "on") {
            selfMode = true;
            await sock.sendMessage(sender, { text: "Self mode aktif. Hanya pesan dari bot yang akan diproses." });
          } else if (parts[1] && parts[1].toLowerCase() === "off") {
            selfMode = false;
            await sock.sendMessage(sender, { text: "Self mode nonaktif. Semua pesan akan diproses." });
          } else {
            await sock.sendMessage(sender, { text: "Penggunaan: !self on atau !self off" });
          }
          return;
        }
        if (selfMode && !message.key.fromMe) {
          console.log("Self mode aktif, mengabaikan pesan dari luar.");
          return;
        }
        console.log(chalk.blue('-------------------------------------------------'));
        const timestamp = new Date().toLocaleString();
        console.log(chalk.yellow(`Waktu   : ${timestamp}`));
        console.log(chalk.magenta(`Pengirim: ${sender}`));
        console.log(chalk.green(`Pesan   : ${text}`));
        console.log(chalk.blue('-------------------------------------------------'));
        require('./case').handleCase(sock, message);
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
 * Proses utama: gunakan autentikasi email, periksa setting owner, lalu jalankan bot.
 */
async function main() {
  // Pertama, autentikasi dengan email
  await authenticateWithEmail();
  // Kemudian, periksa setting owner
  await checkOwner();
  // Lanjutkan dengan memulai koneksi bot
  startSock();
}

main();
