// case.js

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

/**
 * Fungsi updateFile: Mengambil konten file remote dan menimpanya secara lokal.
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
 * Fungsi updatePlugins: Mengambil daftar file plugin dari GitHub dan menimpanya ke folder plugins.
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

// Definisikan prefix yang diizinkan (misal: "!", ".", "/")
const MULTI_PREFIX = ['!', '.', '/'];

// Muat custom commands dari file eksternal (jika ada)
const customCommandsFile = path.join(__dirname, 'custom_commands.json');
let customCommands = { textCommands: {}, pluginCommands: {} };
if (fs.existsSync(customCommandsFile)) {
  try {
    customCommands = JSON.parse(fs.readFileSync(customCommandsFile, 'utf8'));
    if (!customCommands.textCommands) customCommands.textCommands = {};
    if (!customCommands.pluginCommands) customCommands.pluginCommands = {};
  } catch (err) {
    console.error(chalk.red("Error loading custom commands:"), err);
    customCommands = { textCommands: {}, pluginCommands: {} };
  }
}

// Load plugin dari folder plugins
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
 * Fungsi helper getMessageText: Mengekstrak teks dari pesan berdasarkan struktur objek pesan Baileys.
 * Fungsi ini mendukung pesan biasa, pesan extended, caption pada image/video, dan respon dari tombol.
 */
function getMessageText(m) {
  if (!m.message) return '';
  // Periksa pesan biasa
  if (m.message.conversation) return m.message.conversation;
  if (m.message.extendedTextMessage && m.message.extendedTextMessage.text) return m.message.extendedTextMessage.text;
  if (m.message.imageMessage && m.message.imageMessage.caption) return m.message.imageMessage.caption;
  if (m.message.videoMessage && m.message.videoMessage.caption) return m.message.videoMessage.caption;
  // Periksa respons tombol interaktif
  if (m.message.buttonsResponseMessage) {
    return m.message.buttonsResponseMessage.selectedDisplayText || m.message.buttonsResponseMessage.selectedButtonId || '';
  }
  if (m.message.listResponseMessage &&
      m.message.listResponseMessage.singleSelectReply &&
      m.message.listResponseMessage.singleSelectReply.selectedRowId) {
    return m.message.listResponseMessage.singleSelectReply.selectedRowId;
  }
  if (m.message.templateButtonReplyMessage && m.message.templateButtonReplyMessage.selectedId) {
    return m.message.templateButtonReplyMessage.selectedId;
  }
  // Jika pesan dibungkus dalam viewOnceMessage
  if (m.message.viewOnceMessage && m.message.viewOnceMessage.message) {
    const vm = m.message.viewOnceMessage.message;
    if (vm.conversation) return vm.conversation;
    if (vm.extendedTextMessage && vm.extendedTextMessage.text) return vm.extendedTextMessage.text;
    if (vm.imageMessage && vm.imageMessage.caption) return vm.imageMessage.caption;
    if (vm.videoMessage && vm.videoMessage.caption) return vm.videoMessage.caption;
    if (vm.buttonsResponseMessage) {
      return vm.buttonsResponseMessage.selectedDisplayText || vm.buttonsResponseMessage.selectedButtonId || '';
    }
    if (vm.listResponseMessage &&
        vm.listResponseMessage.singleSelectReply &&
        vm.listResponseMessage.singleSelectReply.selectedRowId) {
      return vm.listResponseMessage.singleSelectReply.selectedRowId;
    }
    if (vm.templateButtonReplyMessage && vm.templateButtonReplyMessage.selectedId) {
      return vm.templateButtonReplyMessage.selectedId;
    }
  }
  return m.text || '';
}

/**
 * Fungsi handleCase: Menangani perintah yang diterima dari pesan.
 * Memproses custom command, plugin command, dan perintah built-in.
 */
async function handleCase(sock, message) {
  const chatId = message.key.remoteJid;
  let text = getMessageText(message).trim();
  if (!text) {
    console.log(chalk.red("Pesan tanpa teks diterima, tidak diproses."));
    return;
  }

  // Penambahan custom text command (misalnya: !addcase)
  if (text.startsWith(MULTI_PREFIX[0] + 'addcase')) {
    const rest = text.slice((MULTI_PREFIX[0] + 'addcase').length).trim();
    const parts = rest.split(" | ");
    if (parts.length < 2) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: ' + MULTI_PREFIX[0] + 'addcase nama | teks_balasan' });
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

  // Penambahan custom plugin command (misalnya: !addplugin)
  if (text.startsWith(MULTI_PREFIX[0] + 'addplugin')) {
    const rest = text.slice((MULTI_PREFIX[0] + 'addplugin').length).trim();
    const parts = rest.split(" | ");
    if (parts.length < 2) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: ' + MULTI_PREFIX[0] + 'addplugin nama | kode_javascript' });
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
  if (customCommands.textCommands[text]) {
    const resp = customCommands.textCommands[text];
    return sock.sendMessage(chatId, { text: resp });
  }
  // Eksekusi custom plugin command jika ada
  if (customCommands.pluginCommands[text]) {
    try {
      const func = new Function('sock', 'message', 'args', customCommands.pluginCommands[text]);
      const result = func(sock, message, text.split(" ").slice(1));
      Promise.resolve(result)
        .then(r => sock.sendMessage(chatId, { text: 'Hasil: ' + r }))
        .catch(err => sock.sendMessage(chatId, { text: 'Error: ' + err.message }));
    } catch (err) {
      return sock.sendMessage(chatId, { text: 'Error: ' + err.message });
    }
    return;
  }

  // Eksekusi perintah dari plugin yang ada di folder plugins
  let commandName = text.split(" ")[0].substring(1).toLowerCase();
  if (plugins.has(commandName)) {
    const plugin = plugins.get(commandName);
    console.log(chalk.blue(`Menjalankan plugin untuk perintah: ${commandName}`));
    plugin.run(sock, message, text.split(" ").slice(1))
      .then(() => console.log(chalk.green(`Plugin "${commandName}" dijalankan.`)))
      .catch(err => console.error(chalk.red(`Error menjalankan plugin "${commandName}":`), err));
    return;
  }

  let response = '';
  // Perintah built-in
  switch (text.split(" ")[0].substring(1).toLowerCase()) {
      case 'list': {
  const listMessage = {
    text: 'Silahkan pilih opsi berikut:',
    footer: 'Mars Bot',
    title: 'Menu Utama',
    buttonText: 'Klik disini',
    sections: [
      {
        title: 'Kategori',
        rows: [
          { title: 'Info Bot', description: 'Informasi mengenai bot', rowId: 'info' },
          { title: 'Bantuan', description: 'Butuh bantuan?', rowId: 'bantuan' },
          // Tambahkan opsi lain sesuai kebutuhan
        ]
      }
    ]
  };
  await sock.sendMessage(chatId, listMessage);
  break;
      }
      
    case 'halo':
      response = 'Halo! Apa kabar?';
      break;
    case 'menu': {
      let sourceCode = fs.readFileSync(__filename, 'utf8');
      let builtInMatches = [];
      let regex = /case\s+'(\w+)'/g;
      let match;
      while ((match = regex.exec(sourceCode)) !== null) {
        builtInMatches.push(match[1]);
      }
      builtInMatches = Array.from(new Set(builtInMatches));
      let menuText = 'Menu yang tersedia:\n\nBuilt-in Commands:\n';
      builtInMatches.forEach((cmd, index) => {
        menuText += `${index + 1}. ${MULTI_PREFIX[0]}${cmd}\n`;
      });
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
      const remoteCaseUrl = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/case.js';
      const remoteIndexUrl = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/index.js';
      const remotePackageUrl = 'https://raw.githubusercontent.com/Marshalyel/Mars/master/package.json';
      if (text.split(" ").length > 1) {
        const param = text.split(" ")[1].toLowerCase();
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
