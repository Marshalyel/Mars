// case.js

const chalk = require('chalk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load plugin (jika ada) dari folder plugins
const plugins = new Map();
const pluginsDir = path.join(__dirname, 'plugins');

if (fs.existsSync(pluginsDir)) {
  fs.readdirSync(pluginsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const plugin = require(path.join(pluginsDir, file));
      if (plugin.name && typeof plugin.run === 'function') {
        plugins.set(plugin.name.toLowerCase(), plugin);
        console.log(chalk.green(`Plugin loaded: ${plugin.name}`));
      }
    }
  });
}

// Tentukan prefix yang harus digunakan (misalnya: "!")
const PREFIX = '!';

/**
 * Fungsi untuk memperbarui file dengan konten dari URL remote.
 * Perubahan akan aktif setelah bot di-restart atau modul di-reload.
 *
 * @param {Object} sock - Instance WhatsApp socket dari Baileys
 * @param {Object} message - Objek pesan dari Baileys
 * @param {string} fileName - Nama file yang akan diperbarui (misalnya: 'index.js' atau 'case.js')
 * @param {string} remoteUrl - URL remote yang menyediakan konten file terbaru
 */
async function updateFile(sock, message, fileName, remoteUrl) {
  const chatId = message.key.remoteJid;
  try {
    const response = await axios.get(remoteUrl);
    const newContent = response.data;
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
 * Fungsi untuk menangani perintah pesan menggunakan plugin dan switch-case.
 * Hanya memproses perintah yang diawali dengan prefix.
 *
 * @param {Object} sock - Instance WhatsApp socket dari Baileys
 * @param {Object} message - Objek pesan dari Baileys
 */
async function handleCase(sock, message) {
  // Dapatkan ID chat (remoteJid)
  const chatId = message.key.remoteJid;
  let text = '';

  // Ambil teks pesan dari beberapa kemungkinan properti
  if (message.message.conversation) {
    text = message.message.conversation;
  } else if (message.message.extendedTextMessage) {
    text = message.message.extendedTextMessage.text;
  } else {
    console.log(chalk.red("Pesan tanpa teks diterima, tidak diproses."));
    return;
  }

  // Hapus spasi ekstra di awal dan akhir pesan
  text = text.trim();

  // Periksa apakah pesan diawali dengan prefix
  if (!text.startsWith(PREFIX)) {
    console.log(chalk.gray("Pesan tidak menggunakan prefix, diabaikan."));
    return;
  }

  // Pisahkan perintah dan argumen
  const args = text.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  console.log(chalk.cyan("Perintah yang terdeteksi:"), command);
  if (args.length > 0) {
    console.log(chalk.cyan("Argumen:"), args);
  }

  // Jika terdapat plugin untuk perintah ini, jalankan plugin tersebut
  if (plugins.has(command)) {
    const plugin = plugins.get(command);
    console.log(chalk.blue(`Menjalankan plugin untuk perintah: ${command}`));
    plugin.run(sock, message, args)
      .then(() => console.log(chalk.green(`Plugin '${command}' dijalankan.`)))
      .catch(err => console.error(chalk.red(`Error menjalankan plugin '${command}':`), err));
    return;
  }

  let response = '';

  // Logika switch-case untuk perintah bawaan
  switch (command) {
    case 'halo':
      response = 'Halo! Apa kabar?';
      break;
    case 'menu':
      response = 'Menu yang tersedia:\n1. Info\n2. Bantuan\n3. Tentang';
      break;
    case 'info':
      response = 'Ini adalah bot WhatsApp sederhana menggunakan @whiskeysockets/baileys.';
      break;
    case 'bantuan':
      response = 'Silakan ketik perintah: !halo, !menu, !info, !bantuan, !tentang, !marco, !restart, atau !update.';
      break;
    case 'tentang':
      response = 'Bot ini dibuat untuk demonstrasi penggunaan @whiskeysockets/baileys dengan prefix command.';
      break;
    case 'marco':
      // Fitur Marco Polo: jika perintah adalah 'marco', balas dengan 'polo'
      response = 'polo';
      break;
    case 'restart':
      // Fitur restart: kirim pesan konfirmasi, lalu restart bot dengan exit process.
      await sock.sendMessage(chatId, { text: 'Bot sedang restart...' });
      console.log(chalk.green("Bot sedang restart..."));
      process.exit(0);
      return;
    case 'update':
      // Fitur update: periksa argumen untuk menentukan file yang akan diperbarui
      if (args.length > 0) {
        if (args[0] === 'index') {
          await updateFile(sock, message, 'index.js', 'https://raw.githubusercontent.com/Marshalyel/Mars/master/index.js');
        } else if (args[0] === 'case') {
          await updateFile(sock, message, 'case.js', 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js');
        } else {
          response = 'Parameter update tidak dikenali. Gunakan "index" atau "case".';
        }
      } else {
        // Jika tidak ada argumen, perbarui kedua file
        await updateFile(sock, message, 'index.js', 'https://raw.githubusercontent.com/Marshalyel/Mars/master/index.js');
        await updateFile(sock, message, 'case.js', 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js');
        // Jangan lanjutkan ke pengiriman response karena masing-masing sudah mengirim pesan
        return;
      }
      // Setelah update, keluar dari fungsi agar tidak mengirim response tambahan
      return;
    default:
      response = 'Maaf, perintah tidak dikenali. Ketik "!menu" untuk melihat pilihan.';
      break;
  }

  // Kirim balasan jika ada response
  if (response) {
    sock.sendMessage(chatId, { text: response })
      .then(() => console.log(chalk.green("Balasan terkirim:"), response))
      .catch(err => console.error(chalk.red("Gagal mengirim pesan:"), err));
  }
}

module.exports = { handleCase };
