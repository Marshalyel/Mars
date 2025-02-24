// plugins/youtube.js
//Mars
const ytSearch = require('yt-search');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasilnya dalam bentuk list interaktif',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Harap berikan query pencarian. Contoh: !youtube tutorial javascript' });
    }
    const query = args.join(' ');
    try {
      const searchResult = await ytSearch(query);
      const videos = searchResult.videos.slice(0, 10); // Ambil 10 hasil teratas
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Tidak ada hasil yang ditemukan.' });
      }
      
      // Bangun list message
      const rows = videos.map((video, index) => {
        return {
          title: video.title.length > 30 ? video.title.substring(0, 27) + '...' : video.title,
          description: `Durasi: ${video.timestamp} | Views: ${video.views}`,
          rowId: video.url // Ketika dipilih, rowId ini yang dikirim sebagai jawaban
        };
      });
      
      const sections = [
        {
          title: "Hasil Pencarian YouTube",
          rows
        }
      ];
      
      const listMessage = {
        text: "Pilih video yang ingin Anda tonton:",
        footer: "Powered by yt-search",
        title: `Hasil pencarian untuk "${query}"`,
        buttonText: "Klik untuk melihat",
        sections
      };
      
      await sock.sendMessage(chatId, listMessage);
    } catch (error) {
      console.error("Error during YouTube search:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};
