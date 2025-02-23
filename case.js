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
 * Fungsi untuk memperbarui file case.js dengan konten dari URL remote.
 * Update hanya akan mengganti file secara lokal, perubahan akan aktif
 * setelah bot di-restart atau modul di-reload.
 *
 * @param {Object} sock - Instance WhatsApp socket dari Baileys
 * @param {Object} message - Objek pesan dari Baileys
 */
async function updateCaseFile(sock, message) {
  const chatId = message.key.remoteJid;
  const url = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js';
  try {
    const response = await axios.get(url);
    const newContent = response.data;
    const localPath = __filename; // file ini adalah case.js
    fs.writeFileSync(localPath, newContent, 'utf8');
    await sock.sendMessage(chatId, { text: 'case.js telah diperbarui. Silakan restart bot untuk menerapkan perubahan.' });
    console.log(chalk.green('case.js updated successfully.'));
  } catch (error) {
    console.error(chalk.red('Gagal memperbarui case.js:'), error);
    await sock.sendMessage(chatId, { text: 'Gagal memperbarui case.js.' });
  }
}

/**
 * Fungsi untuk menangani perintah pesan menggunakan plugin dan switch-case.
 * Hanya memproses perintah yang diawali dengan prefix.
 *
 * @param {Object} sock - Instance WhatsApp socket dari Baileys
 * @param {Object} message - Objek pesan dari Baileys
 */
function handleCase(sock, message) {
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
      response = 'Silakan ketik perintah: !halo, !menu, !info, !bantuan, atau !tentang.';
      break;
    case 'tentang':
      response = 'Bot ini dibuat untuk demonstrasi penggunaan @whiskeysockets/baileys dengan prefix command.';
      break;
    case 'update':
      // Jalankan fungsi update untuk case.js
      updateCaseFile(sock, message);
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
