// plugins/youtube.js

const ytSearch = require('yt-search');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasilnya',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Harap berikan query pencarian. Contoh: !youtube tutorial javascript' });
    }
    const query = args.join(' ');
    try {
      const searchResult = await ytSearch(query);
      const videos = searchResult.videos.slice(0, 3); // Ambil 3 hasil teratas
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Tidak ada hasil yang ditemukan.' });
      }
      let reply = `Hasil pencarian untuk "${query}":\n\n`;
      videos.forEach((video, index) => {
        reply += `${index + 1}. ${video.title}\n`;
        reply += `   Durasi: ${video.timestamp} | Dilihat: ${video.views}\n`;
        reply += `   Link: ${video.url}\n\n`;
      });
      await sock.sendMessage(chatId, { text: reply });
    } catch (error) {
      console.error("Error saat pencarian YouTube:", error);
      await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};
