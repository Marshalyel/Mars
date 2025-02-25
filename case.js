// case.js

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

// Fungsi updateFile: mengambil konten remote dan menimpanya secara lokal.
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

// Fungsi updatePlugins: mengambil daftar file plugin dari GitHub menggunakan API,
// dan menimpa file lokal dengan konten remote.
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

// Definisikan array prefix yang diizinkan (misalnya: "!", ".", "/")
const MULTI_PREFIX = ['!', '.', '/'];

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

// Load plugin (jika ada) dari folder plugins
const plugins = new Map();
const pluginsDir = path.join(__dirname, 'plugins');
if (fs.existsSync(pluginsDir)) {
  fs.readdirSync(pluginsDir).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const plugin = require(path.join(pluginsDir, file));
        if (plugin && plugin.name && typeof plugin.run === 'function') {
          plugins.set(plugin.name.toLowerCase(), plugin);
          console.log(chalk.green(`Plugin loaded: ${plugin.name}`));
        }
      } catch (e) {
        console.error(chalk.red(`Error loading plugin ${file}:`), e);
      }
    }
  });
}

/**
 * Fungsi untuk menangani perintah pesan.
 *
 * @param {Object} sock - Instance WhatsApp socket dari Baileys.
 * @param {Object} message - Objek pesan dari Baileys.
 */
async function handleCase(sock, message) {
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
  text = text.trim();

  // Cek apakah pesan diawali dengan salah satu prefix yang diizinkan
  let usedPrefix = null;
  for (const prefix of MULTI_PREFIX) {
    if (text.startsWith(prefix)) {
      usedPrefix = prefix;
      break;
    }
  }
  if (!usedPrefix) {
    console.log(chalk.gray("Pesan tidak menggunakan prefix yang diizinkan, diabaikan."));
    return;
  }
  const args = text.slice(usedPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  console.log(chalk.cyan("Perintah yang terdeteksi:"), command);
  if (args.length > 0) console.log(chalk.cyan("Argumen:"), args);

  // Penambahan perintah custom: !addcase dan !addplugin
  if (command === 'addcase') {
    const rest = args.join(" ");
    const parts = rest.split(" | ");
    if (parts.length < 2) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: ' + usedPrefix + 'addcase nama | teks_balasan' });
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

  if (command === 'addplugin') {
    const rest = args.join(" ");
    const parts = rest.split(" | ");
    if (parts.length < 2) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: ' + usedPrefix + 'addplugin nama | kode_javascript' });
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

  // Eksekusi custom text command jika ada
  if (customCommands.textCommands[command]) {
    const resp = customCommands.textCommands[command];
    return sock.sendMessage(chatId, { text: resp });
  }
  // Eksekusi custom plugin command jika ada
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

  // Eksekusi perintah dari folder plugins jika ada
  if (plugins.has(command)) {
    const plugin = plugins.get(command);
    console.log(chalk.blue(`Menjalankan plugin untuk perintah: ${command}`));
    plugin.run(sock, message, args)
      .then(() => console.log(chalk.green(`Plugin "${command}" dijalankan.`)))
      .catch(err => console.error(chalk.red(`Error menjalankan plugin "${command}":`), err));
    return;
  }

  let response = '';

  // Switch-case built-in (struktur tidak diubah)
  switch (command) {
    case 'halo':
      response = 'Halo! Apa kabar?';
      break;
    case 'menu': {
      // Bangun menu dinamis dengan mendeteksi perintah built-in secara otomatis
      let sourceCode = fs.readFileSync(__filename, 'utf8');
      let builtInMatches = [];
      let regex = /case\s+'(\w+)'/g;
      let match;
      while ((match = regex.exec(sourceCode)) !== null) {
        builtInMatches.push(match[1]);
      }
      builtInMatches = Array.from(new Set(builtInMatches));
      let menuText = 'Menu yang tersedia:\n\n';
      menuText += 'Built-in Commands:\n';
      builtInMatches.forEach((cmd, index) => {
        menuText += `${index + 1}. ${MULTI_PREFIX[0]}${cmd}\n`;
      });
      // Tambahkan custom commands
      const customTextKeys = Object.keys(customCommands.textCommands);
      if (customTextKeys.length > 0) {
        menuText += '\nCustom Text Commands:\n';
        customTextKeys.forEach((cmd, i) => {
          menuText += `${i + 1}. ${MULTI_PREFIX[0]}${cmd}\n`;
        });
      }
      const customPluginKeys = Object.keys(customCommands.pluginCommands);
      if (customPluginKeys.length > 0) {
        menuText += '\nCustom Plugin Commands:\n';
        customPluginKeys.forEach((cmd, i) => {
          menuText += `${i + 1}. ${MULTI_PREFIX[0]}${cmd}\n`;
        });
      }
      if (plugins.size > 0) {
        menuText += '\nPlugin Commands:\n';
        let i = 1;
        for (const [name, plugin] of plugins.entries()) {
          menuText += `${i}. ${MULTI_PREFIX[0]}${name} - ${plugin.description || 'Tanpa deskripsi'}\n`;
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
      response = `Silakan ketik perintah: ${MULTI_PREFIX[0]}halo, ${MULTI_PREFIX[0]}menu, ${MULTI_PREFIX[0]}info, ${MULTI_PREFIX[0]}bantuan, ${MULTI_PREFIX[0]}tentang, ${MULTI_PREFIX[0]}marco, ${MULTI_PREFIX[0]}restart, ${MULTI_PREFIX[0]}update, ${MULTI_PREFIX[0]}addcase, atau ${MULTI_PREFIX[0]}addplugin.`;
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
    case 'update': {
      // Fitur update: mendukung parameter "case", "index", "plugins", dan "package"
      const remoteCaseUrl = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js';
      const remoteIndexUrl = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/index.js';
      const remotePackageUrl = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/package.json';
      if (args.length > 0) {
        const param = args[0].toLowerCase();
        if (param === 'case') {
          await updateFile(sock, message, 'case.js', remoteCaseUrl);
        } else if (param === 'index') {
          await updateFile(sock, message, 'index.js', remoteIndexUrl);
        } else if (param === 'plugins') {
          await updatePlugins(sock, message);
        } else if (param === 'package') {
          await updateFile(sock, message, 'package.json', remotePackageUrl);
        } else {
          response = 'Parameter update tidak dikenali. Gunakan "case", "index", "plugins", atau "package".';
        }
      } else {
        // Jika tidak ada parameter, update semua
        await updateFile(sock, message, 'case.js', remoteCaseUrl);
        await updateFile(sock, message, 'index.js', remoteIndexUrl);
        await updateFile(sock, message, 'package.json', remotePackageUrl);
        await updatePlugins(sock, message);
      }
      return;
    }
    default:
      response = `Maaf, perintah tidak dikenali. Ketik "${MULTI_PREFIX[0]}menu" untuk melihat pilihan.`;
      break;
  }

  if (response) {
    sock.sendMessage(chatId, { text: response })
      .then(() => console.log(chalk.green("Balasan terkirim:"), response))
      .catch(err => console.error(chalk.red("Gagal mengirim pesan:"), err));
  }
}

module.exports = { handleCase };
