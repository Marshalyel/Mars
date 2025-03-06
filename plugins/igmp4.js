// plugins/igmp4.js
const { fetchInstagramPost } = require('./igUtils');

module.exports = {
  name: 'igmp4',
  description: 'Download video dari post Instagram (hanya untuk video).',
  
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    if (!args.length) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: `.igmp4 <url>`' });
    }
    const url = args[0].trim();
    try {
      const post = await fetchInstagramPost(url);
      if (!post) {
        return sock.sendMessage(chatId, { text: 'Gagal mengambil data dari URL yang diberikan.' });
      }
      
      if (post.mediaType !== 'GraphVideo') {
        return sock.sendMessage(chatId, { text: 'Post ini bukan video, video tidak tersedia.' });
      }
      
      return sock.sendMessage(chatId, { text: `Download video dari:\n${post.videoUrl}` });
      
    } catch (error) {
      console.error("Error dalam .igmp4:", error);
      return sock.sendMessage(chatId, { text: 'Terjadi error saat memproses perintah .igmp4.' });
    }
  }
};
