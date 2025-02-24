// plugins/youtube.js
//Mars
const ytSearch = require('yt-search');
const { proto } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'youtube',
  description: 'Mencari video YouTube dan menampilkan hasil dalam bentuk carousel interaktif',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Harap berikan query pencarian. Contoh: !youtube tutorial javascript' });
    }
    const query = args.join(' ');

    // Kirim reaksi awal untuk menandai pencarian
    await sock.sendMessage(chatId, { react: { text: '🔎', key: message.key } });

    let searchResults;
    try {
      searchResults = await ytSearch(query);
    } catch (error) {
      console.error("Error during YouTube search:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }

    if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) {
      return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
    }

    // Ambil 7 hasil teratas
    const videos = searchResults.videos.slice(0, 7);
    let summaryText = `🔎 *Hasil Pencarian YouTube untuk:* _${query}_\n\n`;
    let cards = [];

    // Untuk setiap video, buat card untuk carousel
    for (let video of videos) {
      summaryText += `*🎬 ${video.title}*\n📅 ${video.ago} | ⏳ ${video.timestamp} | 👁 ${video.views}\n🔗 ${video.url}\n\n`;
      
      let imgMedia = {};
      try {
        // Prepare image media (menggunakan upload bawaan sock)
        imgMedia = await sock.prepareMessageMedia({ image: { url: video.thumbnail } }, { upload: sock.waUploadToServer });
      } catch (error) {
        console.error("Error preparing thumbnail:", error);
      }

      // Bangun card menggunakan format interactive message dari Baileys
      const card = {
        header: proto.Message.InteractiveMessage.Header.fromObject({
          title: video.title,
          hasMediaAttachment: true,
          ...imgMedia
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
          buttons: [
            {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "Salin Link",
                copy_text: video.url
              })
            }
          ]
        }),
        footer: proto.Message.InteractiveMessage.Footer.fromObject({
          text: `👤 ${video.author.name || "Unknown"} | 👁 ${video.views} | ⏳ ${video.timestamp}`
        })
      };

      cards.push(card);
    }

    // Kirim summary text terlebih dahulu
    await sock.sendMessage(chatId, { text: summaryText });

    // Bangun pesan carousel interaktif
    const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
      body: proto.Message.InteractiveMessage.Body.fromObject({
        text: `🔎 Berikut adalah hasil pencarian untuk *${query}*`
      }),
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
        cards: cards
      })
    });

    // Bungkus pesan dalam viewOnceMessage (sesuai contoh)
    const messageContent = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: interactiveMsg
        }
      }
    };

    // Hasilkan pesan dari konten dan relay ke chat
    const generatedMsg = await sock.generateMessageFromContent(chatId, messageContent, { userJid: chatId, quoted: message });
    await sock.relayMessage(chatId, generatedMsg.message, { messageId: generatedMsg.key.id });

    // Hapus reaksi (opsional)
    await sock.sendMessage(chatId, { react: { text: '', key: message.key } });
  }
};
