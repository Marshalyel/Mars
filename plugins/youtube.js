const ytSearch = require('yt-search');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

const resultsCache = {}; // Cache hasil pencarian per pengguna

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasil dengan navigasi Next & Back',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    const senderId = message.key.participant || chatId;

    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
    }

    const query = args.join(' ');
    
    // Jika pengguna sudah mencari sebelumnya, cek apakah dia menekan "Next" atau "Back"
    const userCache = resultsCache[senderId];
    let currentIndex = userCache ? userCache.index : 0;

    if (args[0] === "next" && userCache) {
      currentIndex = Math.min(userCache.index + 1, userCache.results.length - 1);
    } else if (args[0] === "back" && userCache) {
      currentIndex = Math.max(userCache.index - 1, 0);
    } else {
      // Pencarian baru
      try {
        const searchResult = await ytSearch(query);
        const videos = searchResult.videos.slice(0, 10); // Ambil 10 hasil teratas
        
        if (!videos.length) {
          return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
        }

        resultsCache[senderId] = { results: videos, index: 0 };
        currentIndex = 0;
      } catch (error) {
        console.error("Error during YouTube search:", error);
        return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
      }
    }

    const video = resultsCache[senderId].results[currentIndex];

    let mediaMsg = {};
    try {
      mediaMsg = await prepareWAMessageMedia(
        { image: { url: video.thumbnail } },
        { upload: sock.waUploadToServer.bind(sock) }
      );
    } catch (err) {
      console.error("Error preparing thumbnail:", err);
    }

    const buttons = [
      {
        buttonId: `.ytmp3 ${video.url}`,
        buttonText: { displayText: "🎵 Download MP3" },
        type: 1
      },
      {
        buttonId: `.ytmp4 ${video.url}`,
        buttonText: { displayText: "📺 Download MP4" },
        type: 1
      }
    ];

    if (currentIndex > 0) {
      buttons.push({
        buttonId: `!youtube back`,
        buttonText: { displayText: "⬅️ Back" },
        type: 1
      });
    }

    if (currentIndex < resultsCache[senderId].results.length - 1) {
      buttons.push({
        buttonId: `!youtube next`,
        buttonText: { displayText: "➡️ Next" },
        type: 1
      });
    }

    const messageContent = {
      image: { url: video.thumbnail },
      caption: `🎥 *${video.title}*\n👤 *${video.author.name || "Unknown"}*\n👁 ${video.views} | ⏳ ${video.timestamp}\n\n🔗 ${video.url}`,
      footer: `Hasil ${currentIndex + 1} dari ${resultsCache[senderId].results.length}`,
      buttons: buttons,
      headerType: 4
    };

    resultsCache[senderId].index = currentIndex;

    await sock.sendMessage(chatId, messageContent, { quoted: message });
  }
};
