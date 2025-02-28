// plugins/YouTube.js

const yts = require('yt-search');

module.exports = {
  name: 'youtube',
  description: 'Mencari video YouTube dan mengirimkan hasil dengan button interaktif',
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
    }
    const query = args.join(' ');
    try {
      const searchResult = await yts(query);
      if (!searchResult.videos || searchResult.videos.length === 0) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      // Pilih video top result
      const video = searchResult.videos[0];
      const videoUrl = video.url;
      
      // Konfigurasi bot (nama bot)
      const config = { name: "Elaina Bot" };
      
      // Bangun pesan interaktif menggunakan button sesuai contoh
      const send = {
        text: `*– 乂 YouTube Result*\nTitle: ${video.title}\nChannel: ${video.author.name}\nDurasi: ${video.timestamp}`,
        footer: config.name,
        buttons: [
          {
            buttonId: `#copy ${videoUrl}`,
            buttonText: { displayText: 'Salin Link' },
            type: 1
          },
          {
            buttonId: `#ytmp3 ${videoUrl}`,
            buttonText: { displayText: 'Download MP3' },
            type: 1
          }
        ],
        viewOnce: true,
        headerType: 6
      };
      
      await sock.sendMessage(chatId, send, { quoted: m });
    } catch (error) {
      console.error("Error dalam pencarian YouTube:", error);
      await sock.sendMessage(chatId, { text: 'Gagal memproses pencarian YouTube.' }, { quoted: m });
    }
  }
};
