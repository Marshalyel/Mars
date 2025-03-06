// plugins/ig.js
const { fetchInstagramPost } = require('./igUtils');

module.exports = {
  name: 'ig',
  description: 'Mengambil data post Instagram dan menampilkan opsi download.',
  
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    if (!args.length) {
      return sock.sendMessage(chatId, { text: 'Masukkan URL post Instagram!\nContoh: `.ig https://www.instagram.com/p/XXXXXXXX/`' });
    }
    
    const url = args[0].trim();
    try {
      const post = await fetchInstagramPost(url);
      if (!post) {
        return sock.sendMessage(chatId, { text: 'Gagal mengambil data post Instagram.' });
      }
      
      const mediaType = post.mediaType; // Misal: "GraphVideo" atau "GraphImage"
      const caption = post.caption || "Instagram post";
      let buttons = [];
      
      if (mediaType === 'GraphVideo') {
        buttons.push(
          { buttonId: `.igmp3 ${url}`, buttonText: { displayText: 'Download Audio' }, type: 1 },
          { buttonId: `.igmp4 ${url}`, buttonText: { displayText: 'Download Video' }, type: 1 },
          { buttonId: `.igimg ${url}`, buttonText: { displayText: 'Download Thumbnail' }, type: 1 }
        );
      } else if (mediaType === 'GraphImage') {
        buttons.push(
          { buttonId: `.igimg ${url}`, buttonText: { displayText: 'Download Gambar' }, type: 1 }
        );
      }
      
      const messageText = `📌 *${caption}*\nTipe: ${mediaType}\nURL: ${url}`;
      
      await sock.sendMessage(chatId, {
        text: messageText,
        footer: 'Pilih aksi download:',
        buttons: buttons,
        headerType: 1,
        viewOnce: true
      }, { quoted: m });
      
    } catch (error) {
      console.error("Error scraping Instagram post:", error);
      return sock.sendMessage(chatId, { text: 'Terjadi error saat mengambil data Instagram. Pastikan URL benar dan periksa koneksi.' });
    }
  }
};
