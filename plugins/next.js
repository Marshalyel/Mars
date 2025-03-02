module.exports = {
  name: 'next',
  description: 'Menampilkan video selanjutnya dari hasil pencarian YouTube yang tersimpan.',
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    
    // Periksa apakah cache hasil pencarian ada untuk chat ini
    if (!global.youtubeCache || !global.youtubeCache[chatId]) {
      return await sock.sendMessage(chatId, { text: 'Tidak ada hasil pencarian yang tersimpan. Gunakan perintah !youtube terlebih dahulu.' }, { quoted: m });
    }
    
    const userCache = global.youtubeCache[chatId];
    const videos = userCache.videos;
    let index = userCache.index;
    
    // Jika sudah berada di video terakhir, jangan naikkan index, tetapi tampilkan pesan dengan tombol tetap
    if (index >= videos.length - 1) {
      const video = videos[index];
      const videoUrl = video.url;
      const messageText = `📌 *${video.title}*\n📺 Channel: ${video.author.name || "Unknown"}\n⏳ Durasi: ${video.timestamp}\n👁 Views: ${video.views}\n🔗 Link: ${videoUrl}\n\nIni adalah video terakhir dari hasil pencarian.`;
      
      const buttons = [
        { buttonId: `.ytmp3 ${videoUrl}`, buttonText: { displayText: `.ytmp3 ${videoUrl}` }, type: 1 },
        { buttonId: `.ytmp4 ${videoUrl}`, buttonText: { displayText: `.ytmp4 ${videoUrl}` }, type: 1 },
        { buttonId: `.prev`, buttonText: { displayText: '⬅️ Back' }, type: 1 },
        { buttonId: `.next`, buttonText: { displayText: '➡️ Next' }, type: 1 }
      ];
      
      return await sock.sendMessage(chatId, {
        text: messageText,
        footer: `Video ${index + 1} dari ${videos.length}`,
        buttons: buttons,
        headerType: 1,
        viewOnce: true
      }, { quoted: m });
    }
    
    // Jika masih ada video berikutnya, naikkan index
    index++;
    userCache.index = index;
    
    const video = videos[index];
    const videoUrl = video.url;
    const messageText = `📌 *${video.title}*\n📺 Channel: ${video.author.name || "Unknown"}\n⏳ Durasi: ${video.timestamp}\n👁 Views: ${video.views}\n🔗 Link: ${videoUrl}`;
    
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
};
