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

// Muat custom commands dari file eksternal (jika ada)
const customCommandsFile = path.join(__dirname, 'custom_commands.json');
let customCommands = { textCommands: {}, pluginCommands: {} };
if (fs.existsSync(customCommandsFile)) {
  try {
    customCommands = JSON.parse(fs.readFileSync(customCommandsFile, 'utf8'));
  } catch (err) {
    console.error(chalk.red("Error loading custom commands:"), err);
  }
}

/**
 * Fungsi untuk menangani perintah pesan.
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

  // --- Proses penambahan perintah dinamis tanpa mengubah struktur switch-case ---

  // Tambah perintah statis baru: !addcase nama | teks_balasan
  if (command === 'addcase') {
    const rest = args.join(" ");
    const parts = rest.split(" | ");
    if (parts.length < 2) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: !addcase nama | teks_balasan' });
    }
    const name = parts[0].trim().toLowerCase();
    const response = parts.slice(1).join(" | ").trim();
    if (customCommands.textCommands[name] || customCommands.pluginCommands[name]) {
      return sock.sendMessage(chatId, { text: `Command "${name}" sudah ada.` });
    }
    customCommands.textCommands[name] = response;
    fs.writeFileSync(customCommandsFile, JSON.stringify(customCommands, null, 2));
    return sock.sendMessage(chatId, { text: `Command "${name}" berhasil ditambahkan.` });
  }

  // Tambah plugin baru: !addplugin nama | kode_javascript
  if (command === 'addplugin') {
    const rest = args.join(" ");
    const parts = rest.split(" | ");
    if (parts.length < 2) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: !addplugin nama | kode_javascript' });
    }
    const name = parts[0].trim().toLowerCase();
    const code = parts.slice(1).join(" | ").trim();
    if (customCommands.textCommands[name] || customCommands.pluginCommands[name]) {
      return sock.sendMessage(chatId, { text: `Command "${name}" sudah ada.` });
    }
    customCommands.pluginCommands[name] = code;
    fs.writeFileSync(customCommandsFile, JSON.stringify(customCommands, null, 2));
    return sock.sendMessage(chatId, { text: `Plugin "${name}" berhasil ditambahkan.` });
  }

  // --- Eksekusi perintah dinamis dari custom commands ---

  // Jika command ada di custom text commands
  if (customCommands.textCommands[command]) {
    const resp = customCommands.textCommands[command];
    return sock.sendMessage(chatId, { text: resp });
  }
  // Jika command ada di custom plugin commands
  if (customCommands.pluginCommands[command]) {
    try {
      const func = new Function('sock', 'message', 'args', customCommands.pluginCommands[command]);
      const result = func(sock, message, args);
      Promise.resolve(result)
        .then(r => sock.sendMessage(chatId, { text: 'Hasil: ' + r }))
        .catch(err => sock.sendMessage(chatId, { text: 'Error: ' + err.message }));
    } catch (err) {
      return sock.sendMessage(chatId, { text: 'Error: ' + err.message });
    }
    return;
  }

  // --- Jika tidak terdeteksi sebagai perintah dinamis, cek plugin dari folder ---
  if (plugins.has(command)) {
    const plugin = plugins.get(command);
    console.log(chalk.blue(`Menjalankan plugin untuk perintah: ${command}`));
    plugin.run(sock, message, args)
      .then(() => console.log(chalk.green(`Plugin "${command}" dijalankan.`)))
      .catch(err => console.error(chalk.red(`Error menjalankan plugin "${command}":`), err));
    return;
  }

  let response = '';

  // --- Switch-case built-in (struktur tidak diubah) ---
  switch (command) {
    case 'halo':
      response = 'Halo! Apa kabar?';
      break;
    case 'menu': {
      // Untuk menu, kita akan membaca file sumber (case.js) dan mengekstrak built-in commands secara otomatis
      let sourceCode = fs.readFileSync(__filename, 'utf8');
      let builtInMatches = [];
      let regex = /case\s+'(\w+)'/g;
      let match;
      while ((match = regex.exec(sourceCode)) !== null) {
        builtInMatches.push(match[1]);
      }
      // Hilangkan duplikat (jika ada)
      builtInMatches = Array.from(new Set(builtInMatches));
      let menuText = 'Menu yang tersedia:\n\n';
      // Tampilkan built-in commands
      menuText += 'Built-in Commands:\n';
      builtInMatches.forEach((cmd, index) => {
        menuText += `${index + 1}. ${PREFIX}${cmd}\n`;
      });
      // Tampilkan custom text commands
      const customTextKeys = Object.keys(customCommands.textCommands);
      if (customTextKeys.length > 0) {
        menuText += '\nCustom Text Commands:\n';
        customTextKeys.forEach((cmd, i) => {
          menuText += `${i + 1}. ${PREFIX}${cmd}\n`;
        });
      }
      // Tampilkan custom plugin commands
      const customPluginKeys = Object.keys(customCommands.pluginCommands);
      if (customPluginKeys.length > 0) {
        menuText += '\nCustom Plugin Commands:\n';
        customPluginKeys.forEach((cmd, i) => {
          menuText += `${i + 1}. ${PREFIX}${cmd}\n`;
        });
      }
      // Tampilkan commands dari folder plugins
      if (plugins.size > 0) {
        menuText += '\nPlugin Commands:\n';
        let i = 1;
        for (const [name, plugin] of plugins.entries()) {
          menuText += `${i}. ${PREFIX}${name} - ${plugin.description || 'Tanpa deskripsi'}\n`;
          i++;
        }
      }
      response = menuText;
      break;
    }
    case 'info':
      response = 'Ini adalah bot WhatsApp sederhana menggunakan @whiskeysockets/baileys.';
      break;
    case 'bantuan':
      response = 'Silakan ketik perintah: !halo, !menu, !info, !bantuan, !tentang, !marco, !restart, !update, !addcase, atau !addplugin.';
      break;
    case 'tentang':
      response = 'Bot ini dibuat untuk demonstrasi penggunaan @whiskeysockets/baileys dengan prefix command.';
      break;
    case 'marco':
      response = 'polo';
      break;
    case 'restart':
      await sock.sendMessage(chatId, { text: 'Bot sedang restart...' });
      console.log(chalk.green("Bot sedang restart..."));
      process.exit(0);
      return;
    case 'update':
      response = 'Fitur update belum diimplementasikan di perintah ini.';
      break;
    default:
      response = 'Maaf, perintah tidak dikenali. Ketik "!menu" untuk melihat pilihan.';
      break;
  }

  // Kirim balasan jika ada response dari built-in switch-case
  if (response) {
    sock.sendMessage(chatId, { text: response })
      .then(() => console.log(chalk.green("Balasan terkirim:"), response))
      .catch(err => console.error(chalk.red("Gagal mengirim pesan:"), err));
  }
}

module.exports = { handleCase };
