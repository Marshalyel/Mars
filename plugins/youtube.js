// plugins/youtube.js

const ytSearch = require('yt-search');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menyediakan tombol Download MP3 & MP4',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Harap masukkan query pencarian. Contoh: !youtube tutorial javascript' });
    }
    const query = args.join(' ');
    try {
      const searchResult = await ytSearch(query);
      const videos = searchResult.videos.slice(0, 7);
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      
      let summaryText = `🔎 *Hasil Pencarian YouTube untuk:* _${query}_\n\n`;
      let cards = [];
      
      for (const video of videos) {
        summaryText += `*🎬 ${video.title}*\n📅 ${video.ago} | ⏳ ${video.timestamp} | 👁 ${video.views}\n🔗 ${video.url}\n\n`;
        
        let mediaMessage = {};
        try {
          // Gunakan prepareWAMessageMedia dengan binding upload agar thumbnail bisa di-upload
          mediaMessage = await prepareWAMessageMedia(
            { image: { url: video.thumbnail } },
            { upload: sock.waUploadToServer.bind(sock) }
          );
        } catch (err) {
          console.error('Error preparing thumbnail:', err);
        }
        
        // Buat card dengan dua tombol: Download MP3 dan Download MP4
        const card = {
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: video.title,
            hasMediaAttachment: true,
            ...mediaMessage
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons: [
              {
                name: "cta_mp3",
                buttonParamsJson: JSON.stringify({
                  display_text: "Download MP3",
                  copy_text: "ytmp3:" + video.url
                })
              },
              {
                name: "cta_mp4",
                buttonParamsJson: JSON.stringify({
                  display_text: "Download MP4",
                  copy_text: "ytmp4:" + video.url
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
      
      // Kirim summary teks terlebih dahulu
      await sock.sendMessage(chatId, { text: summaryText });
      
      // Buat pesan carousel interaktif
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
      
    } catch (error) {
      console.error("Error during YouTube search:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};
