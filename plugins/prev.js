// plugins/prev.js

module.exports = {
  name: 'prev',
  description: 'Menampilkan video sebelumnya dari hasil pencarian YouTube yang tersimpan.',
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    
    // Pastikan cache hasil pencarian ada untuk chat ini
    if (!global.youtubeCache || !global.youtubeCache[chatId]) {
      return await sock.sendMessage(chatId, { text: 'Tidak ada hasil pencarian yang tersimpan. Gunakan perintah !youtube terlebih dahulu.' }, { quoted: m });
    }
    
    const userCache = global.youtubeCache[chatId];
    const videos = userCache.videos;
    let index = userCache.index;
    
    // Jika sudah di video pertama, beri tahu pengguna
    if (index <= 0) {
      return await sock.sendMessage(chatId, { text: 'Ini adalah video pertama dari hasil pencarian.' }, { quoted: m });
    }
    
    // Turunkan indeks untuk mendapatkan video sebelumnya
    index--;
    userCache.index = index;
    
    const video = videos[index];
    const videoUrl = video.url;
    const messageText = `📌 *${video.title}*\n📺 Channel: ${video.author.name || "Unknown"}\n⏳ Durasi: ${video.timestamp}\n👁 Views: ${video.views}\n🔗 Link: ${videoUrl}`;
    
    // Siapkan tombol untuk download serta tombol Next & Back
    const buttons = [
      { buttonId: `.ytmp3 ${videoUrl}`, buttonText: { displayText: `.ytmp3 ${videoUrl}` }, type: 1 },
      { buttonId: `.ytmp4 ${videoUrl}`, buttonText: { displayText: `.ytmp4 ${videoUrl}` }, type: 1 }
    ];
    
    if (index > 0) {
      buttons.push({ buttonId: `.prev`, buttonText: { displayText: '.prev' }, type: 1 });
      buttons.push({ buttonId: `.next`, buttonText: { displayText: '.Next' }, type: 1 });
    }
    
    if (index < videos.length - 1) {
      buttons.push({ buttonId: `.next`, buttonText: { displayText: '.Next' }, type: 1 });
    }
    
    await sock.sendMessage(chatId, {
      text: messageText,
      footer: `Video ${index + 1} dari ${videos.length}`,
      buttons: buttons,
      headerType: 1,
      viewOnce: true
    }, { quoted: m });
  }
};
