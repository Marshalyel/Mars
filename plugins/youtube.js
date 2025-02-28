const yts = require('yt-search');

let youtubeCache = {}; // Cache untuk menyimpan hasil pencarian per pengguna

module.exports = {
  name: 'youtube',
  description: 'Mencari video YouTube dan mengirimkan hasil dengan tombol untuk download MP3 dan MP4',
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;

    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan kata kunci pencarian!\nContoh: `!youtube lagu terbaru`' });
    }

    const query = args.join(' ').trim();
    try {
      // Mencari video YouTube
      const searchResult = await yts(query);
      if (!searchResult.videos || searchResult.videos.length === 0) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }

      const videos = searchResult.videos.slice(0, 5); // Simpan hanya 5 video pertama
      youtubeCache[chatId] = { videos, index: 0 }; // Simpan hasil pencarian & posisi index pertama

      await sendVideo(sock, chatId, m, videos, 0);

    } catch (error) {
      console.error("Error saat mencari YouTube:", error);
      await sock.sendMessage(chatId, { text: 'Gagal memproses pencarian YouTube.' }, { quoted: m });
    }
  }
};

// Fungsi untuk mengirim video dengan tombol Next & Back
async function sendVideo(sock, chatId, m, videos, index) {
  if (index < 0 || index >= videos.length) return;

  const video = videos[index];
  const videoUrl = video.url;

  const messageText = `📌 *${video.title}*\n📺 Channel: ${video.author.name || "Unknown"}\n⏳ Durasi: ${video.timestamp}\n👁 Views: ${video.views}\n🔗 Link: ${videoUrl}`;

  const buttons = [
    { buttonId: `.ytmp3 ${videoUrl}`, buttonText: { displayText: '🎵 Download MP3' }, type: 1 },
    { buttonId: `.ytmp4 ${videoUrl}`, buttonText: { displayText: '🎥 Download MP4' }, type: 1 }
  ];

  if (index > 0) {
    buttons.push({ buttonId: `.prev`, buttonText: { displayText: '⬅️ Back' }, type: 1 });
  }

  if (index < videos.length - 1) {
    buttons.push({ buttonId: `.next`, buttonText: { displayText: '➡️ Next' }, type: 1 });
  }

  await sock.sendMessage(chatId, {
    text: messageText,
    footer: `Video ${index + 1} dari ${videos.length}`,
    buttons: buttons,
    headerType: 1,
    viewOnce: true
  }, { quoted: m });
}

// Handler untuk tombol Next & Back
module.exports.handleButtons = async (sock, m) => {
  const chatId = m.key.remoteJid;
  const userCache = youtubeCache[chatId];

  if (!userCache) return; // Tidak ada pencarian sebelumnya

  if (m.message.buttonsResponseMessage) {
    const selectedButton = m.message.buttonsResponseMessage.selectedButtonId;

    if (selectedButton === '.next') {
      userCache.index += 1;
    } else if (selectedButton === '.prev') {
      userCache.index -= 1;
    } else {
      return; // Jika bukan Next/Back, biarkan handler lain menangani
    }

    await sendVideo(sock, chatId, m, userCache.videos, userCache.index);
  }
};
