// plugins/igmp3.js
const { fetchInstagramPost } = require('./igUtils');

module.exports = {
  name: 'igmp3',
  description: 'Download audio dari post Instagram (hanya untuk video).',
  
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    if (!args.length) {
      return sock.sendMessage(chatId, { text: 'Format salah! Gunakan: `.igmp3 <url>`' });
    }
    const url = args[0].trim();
    try {
      const post = await fetchInstagramPost(url);
      if (!post) {
        return sock.sendMessage(chatId, { text: 'Gagal mengambil data dari URL yang diberikan.' });
      }
      
      if (post.mediaType !== 'GraphVideo') {
        return sock.sendMessage(chatId, { text: 'Post ini bukan video, audio tidak tersedia.' });
      }
      
      // Contoh: menganggap URL audio diperoleh dari videoUrl dengan parameter khusus
      const audioUrl = post.videoUrl + '?audio=true';
      return sock.sendMessage(chatId, { text: `Download audio dari:\n${audioUrl}` });
      
    } catch (error) {
      console.error("Error dalam .igmp3:", error);
      return sock.sendMessage(chatId, { text: 'Terjadi error saat memproses perintah .igmp3.' });
    }
  }
};
