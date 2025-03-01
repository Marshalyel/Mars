const yts = require('yt-search');

// Pastikan global.youtubeCache diinisialisasi (agar dapat diakses oleh plugin lain seperti .next/.prev jika diperlukan)
global.youtubeCache = global.youtubeCache || {};

module.exports = {
  name: 'youtube',
  description: 'Mencari video YouTube dan mengirimkan hasil dengan tombol interaktif untuk download MP3/MP4 serta Next & Back.',
  
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian!\nContoh: `!youtube lagu terbaru`' });
    }
    
    const query = args.join(' ').trim();
    try {
      const searchResult = await yts(query);
      if (!searchResult.videos || searchResult.videos.length === 0) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      
      // Ambil 5 hasil teratas
      const videos = searchResult.videos.slice(0, 5);
      
      // Simpan hasil pencarian di cache global berdasarkan chatId
      global.youtubeCache[chatId] = { videos, index: 0 };
      
      // Kirim video pertama
      await sendVideo(sock, chatId, m, videos, 0);
      
    } catch (error) {
      console.error("Error dalam pencarian YouTube:", error);
      await sock.sendMessage(chatId, { text: 'Gagal memproses pencarian YouTube.' }, { quoted: m });
    }
  },
  
  // Fungsi ini akan dipanggil ketika tombol Next atau Back ditekan
  handleButtons: async (sock, m) => {
    const chatId = m.key.remoteJid;
    const userCache = global.youtubeCache[chatId];
    if (!userCache) return; // Jika tidak ada cache, abaikan
    
    if (m.message.buttonsResponseMessage) {
      const selectedButton = m.message.buttonsResponseMessage.selectedButtonId;
      if (selectedButton === '.next') {
        if (userCache.index < userCache.videos.length - 1) {
          userCache.index++;
        } else {
          // Jika sudah di video terakhir, beri tahu pengguna
          return await sock.sendMessage(chatId, { text: 'Ini adalah video terakhir dari hasil pencarian.' }, { quoted: m });
        }
      } else if (selectedButton === '.prev') {
        if (userCache.index > 0) {
          userCache.index--;
        } else {
          return await sock.sendMessage(chatId, { text: 'Ini adalah video pertama.' }, { quoted: m });
        }
      } else {
        // Jika tombol yang ditekan bukan Next/Back, biarkan perintah lain yang menanganinya.
        return;
      }
      
      // Kirim video berdasarkan indeks yang diperbarui
      await sendVideo(sock, chatId, m, userCache.videos, userCache.index);
    }
  }
};

/**
 * Fungsi untuk mengirim pesan video dengan tombol Next & Back.
 * @param {Object} sock - Instance WhatsApp socket.
 * @param {string} chatId - ID chat.
 * @param {Object} m - Pesan asli (quoted message).
 * @param {Array} videos - Array video hasil pencarian.
 * @param {number} index - Indeks video yang akan ditampilkan.
 */
async function sendVideo(sock, chatId, m, videos, index) {
  if (index < 0 || index >= videos.length) return;
  const video = videos[index];
  const videoUrl = video.url;
  
  // Siapkan teks pesan dengan detail video
  const messageText = `📌 *${video.title}*\n📺 Channel: ${video.author.name || "Unknown"}\n⏳ Durasi: ${video.timestamp}\n👁 Views: ${video.views}\n🔗 Link: ${videoUrl}`;
  
  // Siapkan tombol Next dan Back
  const buttons = [
    { buttonId: `.ytmp3 ${videoUrl}`, buttonText: { displayText: `.ytmp3 ${videoUrl}` }, type: 1 },
    { buttonId: `.ytmp4 ${videoUrl}`, buttonText: { displayText: `.ytmp4 ${videoUrl}` }, type: 1 }
  ];
  
  if (index > 4) {
    buttons.push({ buttonId: `.prev`, buttonText: { displayText: '.prev' }, type: 1 });
    buttons.push({ buttonId: `.next`, buttonText: { displayText: '.next' }, type: 1 });
  }
  if (index < videos.length - 1) {
    buttons.push({ buttonId: `.next`, buttonText: { displayText: '.next' }, type: 1 });
  }
  
  await sock.sendMessage(chatId, {
    text: messageText,
    footer: `Video ${index + 1} dari ${videos.length}`,
    buttons: buttons,
    headerType: 1,
    viewOnce: true
  }, { quoted: m });
}
