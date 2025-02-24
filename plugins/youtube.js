// plugins/youtube.js

const ytSearch = require('yt-search');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasil dalam bentuk carousel interaktif dengan tombol salin link',
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
      
      let summaryText = `🔎 *Hasil Pencarian YouTube untuk:* _${query}_\n\n`;
      let cards = [];
      
      for (const video of videos) {
        summaryText += `*🎬 ${video.title}*\n📅 ${video.ago} | ⏳ ${video.timestamp} | 👁 ${video.views}\n🔗 ${video.url}\n\n`;
        
        let mediaMessage = {};
        try {
          // Pastikan fungsi upload dibinding ke konteks sock
          mediaMessage = await prepareWAMessageMedia(
            { image: { url: video.thumbnail } },
            { upload: sock.waUploadToServer.bind(sock) }
          );
        } catch (err) {
          console.error('Error preparing thumbnail:', err);
        }
        
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
      await sock.sendMessage(chatId, { text: "⌛" });
      
      // Buat pesan carousel interaktif menggunakan generateWAMessageFromContent
      const interactiveMsgContent = {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
              body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `🔎 Berikut adalah hasil pencarian untuk *${query}*`
              }),
              carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                cards: cards
              })
            })
          }
        }
      };

      const msg = await generateWAMessageFromContent(chatId, interactiveMsgContent, { userJid: chatId, quoted: message });
      await sock.relayMessage(chatId, msg.message, { messageId: msg.key.id });
      
      // Opsional: Hapus reaksi
      await sock.sendMessage(chatId, { react: { text: '', key: message.key } });
      
    } catch (error) {
      console.error("Error during YouTube search:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};
