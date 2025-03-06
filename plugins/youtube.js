const yts = require('yt-search');

// Pastikan global.youtubeCache diinisialisasi
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
      
      // Ambil semua hasil video yang tersedia (tanpa batasan 5 link)
      const videos = searchResult.videos;
      
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
        }
      } else if (selectedButton === '.prev') {
        if (userCache.index > 0) {
          userCache.index--;
        }
      } else {
        return;
      }
      
      // Kirim video berdasarkan indeks yang diperbarui.
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
  
  // Siapkan pesan dengan detail video
  const messageText = `📌 *${video.title}*\n📺 Channel: ${video.author.name || "Unknown"}\n⏳ Durasi: ${video.timestamp}\n👁 Views: ${video.views}\n🔗 Link: ${videoUrl}`;
  
  // Tambahkan tombol untuk download MP3/MP4, serta tombol navigasi (Back & Next)
  const buttons = [
    { buttonId: `.ytmp3 ${videoUrl}`, buttonText: { displayText: `.ytmp3 ${videoUrl}` }, type: 1 },
    { buttonId: `.ytmp4 ${videoUrl}`, buttonText: { displayText: `.ytmp4 ${videoUrl}` }, type: 1 },
    { buttonId: `.prev`, buttonText: { displayText: '⬅️ Back' }, type: 1 },
    { buttonId: `.next`, buttonText: { displayText: '➡️ Next' }, type: 1 }
  ];
  
  await sock.sendMessage(chatId, {
    text: messageText,
    footer: `Video ${index + 1} dari ${videos.length}`,
    buttons: buttons,
    headerType: 1,
    viewOnce: true
  }, { quoted: m });
}
