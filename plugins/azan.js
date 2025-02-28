// plugins/azan.js

const { proto, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'azan',
  description: 'Menampilkan jadwal azan dan petunjuk penggunaan fitur azan dengan tombol interaktif.',
  run: async (sock, m, args) => {
    // Gunakan m.key.remoteJid sebagai target chat
    const chatId = m.key.remoteJid;
    // Pastikan m.prefix dan m.command ada; jika tidak, set default
    m.prefix = m.prefix || '!';
    m.command = m.command || 'azan';

    // Konfigurasi nama bot
    const config = { name: "Elaina Bot" };

    // Siapkan media header (opsional)
    let headerMedia = {};
    try {
      const imagePath = path.join(__dirname, 'azan.jpg'); // Pastikan file ini ada atau ganti dengan URL
      if (fs.existsSync(imagePath)) {
        headerMedia = await prepareWAMessageMedia(
          { image: { url: imagePath } },
          { upload: sock.waUploadToServer.bind(sock) }
        );
      }
    } catch (err) {
      console.error("Error preparing media for azan:", err);
    }

    // Buat header interaktif jika media tersedia
    let headerObj = {};
    if (headerMedia && headerMedia.message && headerMedia.message.imageMessage) {
      headerObj = proto.Message.InteractiveMessage.Header.fromObject({
        title: "",
        subtitle: "Elaina",
        hasMediaAttachment: true,
        ...headerMedia.message.imageMessage,
      });
    }

    // Bangun pesan interaktif dengan tombol
    const send = {
      text: `*– 乂 Cara Penggunaan*\n> *\`0\`* Untuk mematikan fitur ${m.prefix + m.command} off\n> *\`1\`* Untuk menghidupkan fitur ${m.prefix + m.command} on`,
      footer: config.name,
      buttons: [
        {
          buttonId: `${m.prefix + m.command} menu`,
          buttonText: { displayText: 'kembali' },
          type: 1
        },
        {
          buttonId: `${m.prefix + m.command} gempa`,
          buttonText: { displayText: 'mengecek gempa terbaru' },
          type: 1
        }
      ],
      viewOnce: true,
      headerType: 6,
      header: Object.keys(headerObj).length ? headerObj : {}
    };

    try {
      await sock.sendMessage(chatId, send, { quoted: m });
    } catch (error) {
      console.error("Error sending azan message:", error);
    }
  }
};
