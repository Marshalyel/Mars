// plugins/youtube.js

const ytSearch = require('yt-search');
const { proto, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasil dalam bentuk carousel interaktif',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Harap berikan query pencarian. Contoh: !youtube tutorial javascript' });
    }
    const query = args.join(' ');
    try {
      const searchResult = await ytSearch(query);
      const videos = searchResult.videos.slice(0, 7); // Ambil 7 hasil teratas
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      
      // Buat summary text untuk hasil pencarian
      let summaryText = `🔎 *Hasil Pencarian YouTube untuk:* _${query}_\n\n`;
      
      // Array untuk menyimpan card carousel
      let cards = [];
      for (const video of videos) {
        summaryText += `*🎬 ${video.title}*\n📅 ${video.ago} | ⏳ ${video.timestamp} | 👁 ${video.views}\n🔗 ${video.url}\n\n`;
        
        let mediaMessage = {};
        try {
          // Menggunakan prepareWAMessageMedia untuk meng-upload thumbnail
          mediaMessage = await prepareWAMessageMedia({ image: { url: video.thumbnail } }, { upload: sock.waUploadToServer });
        } catch (err) {
          console.error('Error preparing media:', err);
        }
        
        // Buat card untuk setiap video
        cards.push({
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: video.title,
            hasMediaAttachment: true,
            ...mediaMessage
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
        });
      }
      
      // Kirim summary text terlebih dahulu
      await sock.sendMessage(chatId, { text: summaryText });
      
      // Buat pesan carousel interaktif
      const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
        body: proto.Message.InteractiveMessage.Body.fromObject({
          text: `🔎 Berikut adalah hasil pencarian untuk *${query}*`
        }),
        carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
          cards: cards
        })
      });
      
      // Bungkus pesan interaktif ke dalam viewOnceMessage dan kirimkan
      const msg = await sock.generateMessageFromContent(chatId, {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage: interactiveMsg
          }
        }
      }, { userJid: chatId, quoted: message });
      
      await sock.relayMessage(chatId, msg.message, { messageId: msg.key.id });
      
      // Hapus reaksi (opsional)
      await sock.sendMessage(chatId, { react: { text: '', key: message.key } });
    } catch (error) {
      console.error("Error during YouTube search:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};
