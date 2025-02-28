// plugins/azan.js

const { proto, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'azan',
  description: 'Menampilkan jadwal azan dan petunjuk penggunaan fitur azan dengan tombol interaktif.',
  run: async (sock, m, args) => {
    // Pastikan m.prefix dan m.command ada; jika tidak, set default
    m.prefix = m.prefix || '!';
    m.command = m.command || 'azan';

    // Konfigurasi (misal, nama bot)
    const config = { name: "Elaina Bot" };

    // Siapkan media header (opsional) – gunakan file lokal jika tersedia
    let media = {};
    try {
      const imagePath = path.join(__dirname, 'azan.jpg'); // pastikan file ini ada atau ganti dengan URL
      if (fs.existsSync(imagePath)) {
        media = await prepareWAMessageMedia(
          { image: { url: imagePath } },
          { upload: sock.waUploadToServer.bind(sock) }
        );
      }
    } catch (err) {
      console.error("Error preparing media for azan:", err);
    }

    // Bangun pesan interaktif dengan tombol menggunakan kode yang Anda berikan
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
      // Jika media tersedia, sertakan pada header
      header: media ? media : {}
    };

    await sock.sendMessage(m.chat, send, { quoted: m });
  }
};
