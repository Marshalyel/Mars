// plugins/igimg.js
const { fetchInstagramPost } = require('./igUtils');

module.exports = {
  name: 'igimg',
  description: 'Download gambar dari post Instagram (untuk post gambar atau thumbnail untuk video).',
  
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    if (!args.length) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: `.igimg <url>`' });
    }
    const url = args[0].trim();
    try {
      const post = await fetchInstagramPost(url);
      if (!post) {
        return sock.sendMessage(chatId, { text: 'Gagal mengambil data dari URL yang diberikan.' });
      }
      
      // Untuk post video, gunakan thumbnail; untuk post gambar, gunakan displayUrl
      const imageUrl = post.mediaType === 'GraphVideo' ? post.thumbnailUrl : post.displayUrl;
      return sock.sendMessage(chatId, { text: `Download gambar dari:\n${imageUrl}` });
      
    } catch (error) {
      console.error("Error dalam .igimg:", error);
      return sock.sendMessage(chatId, { text: 'Terjadi error saat memproses perintah .igimg.' });
    }
  }
};
