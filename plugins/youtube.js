const ytSearch = require('yt-search');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

const cache = {}; // Penyimpanan sementara untuk hasil pencarian per pengguna

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasil dengan tombol interaktif',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    const senderId = message.key.participant || chatId;

    // Jika tidak ada query, cek apakah ini perintah "Next" atau "Back"
    if (!args.length) {
      if (cache[senderId]) {
        return await sendYouTubeResults(sock, chatId, senderId, cache[senderId].query, cache[senderId].page);
      }
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
    }

    // Jika perintah adalah "next" atau "back", gunakan data yang sudah dicache
    const query = args.join(' ');
    if (query === "next" || query === "back") {
      if (!cache[senderId]) {
        return await sock.sendMessage(chatId, { text: 'Tidak ada pencarian sebelumnya!' });
      }
      
      let newPage = cache[senderId].page + (query === "next" ? 1 : -1);
      return await sendYouTubeResults(sock, chatId, senderId, cache[senderId].query, newPage);
    }

    try {
      const searchResult = await ytSearch(query);
      const videos = searchResult.videos;

      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }

      // Simpan hasil pencarian ke cache
      cache[senderId] = {
        query,
        videos,
        page: 0
      };

      return await sendYouTubeResults(sock, chatId, senderId, query, 0);

    } catch (error) {
      console.error("Error during YouTube search:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};

// Fungsi untuk mengirim hasil YouTube dengan pagination
async function sendYouTubeResults(sock, chatId, senderId, query, page) {
  const videos = cache[senderId].videos;
  const perPage = 5;
  const totalPages = Math.ceil(videos.length / perPage);

  // Pastikan halaman tidak keluar batas
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;
  cache[senderId].page = page;

  // Ambil video untuk halaman ini
  const start = page * perPage;
  const end = start + perPage;
  const videoList = videos.slice(start, end);

  let mediaMsg = {};
  try {
    mediaMsg = await prepareWAMessageMedia(
      { image: { url: videoList[0].thumbnail } },
      { upload: sock.waUploadToServer.bind(sock) }
    );
  } catch (err) {
    console.error("Error preparing thumbnail:", err);
  }

  const buttons = videoList.map((video) => [
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
  ]).flat();

  // Tombol navigasi (Back & Next)
  if (page > 0) {
    buttons.push({
      buttonId: "!youtube back",
      buttonText: { displayText: "⬅️ Back" },
      type: 1
    });
  }
  if (page < totalPages - 1) {
    buttons.push({
      buttonId: "!youtube next",
      buttonText: { displayText: "➡️ Next" },
      type: 1
    });
  }

  const messageContent = {
    image: { url: videoList[0].thumbnail },
    caption: `🔎 Hasil pencarian untuk: *${cache[senderId].query}*\n\n📃 Halaman ${page + 1} dari ${totalPages}\n\n${videoList.map((v, i) => `${i + 1}. *${v.title}*\n👤 ${v.author.name} | 👁 ${v.views} | ⏳ ${v.timestamp}\n🔗 ${v.url}`).join("\n\n")}`,
    footer: "Gunakan tombol di bawah untuk mendownload atau navigasi:",
    buttons: buttons,
    headerType: 4
  };

  await sock.sendMessage(chatId, messageContent);
}
