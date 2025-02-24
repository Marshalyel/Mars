// plugins/youtube.js
//Mars

const ytSearch = require('yt-search');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasil dengan preview gambar',
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
      // Untuk setiap video, kirim pesan berupa gambar (thumbnail) dengan caption informasi
      for (const video of videos) {
        const caption = `*${video.title}*\nDurasi: ${video.timestamp}\nViews: ${video.views}\nLink: ${video.url}`;
        // Kirim pesan gambar; pastikan URL thumbnail valid
        await sock.sendMessage(chatId, { image: { url: video.thumbnail }, caption });
      }
    } catch (error) {
      console.error("Error during YouTube search:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};
