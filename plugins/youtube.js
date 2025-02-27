// plugins/YouTube.js

const axios = require('axios');
const yts = require('yt-search');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'youtube',
  description: 'Mencari video YouTube dan mengirim hasil dalam bentuk carousel dengan tombol Download MP3/MP4',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
    }
    
    const query = args.join(' ').trim();
    
    try {
      // Lakukan pencarian video menggunakan yt-search
      const searchResult = await yts(query);
      const videos = searchResult.videos.slice(0, 7);
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      
      // Opsional: kirim pesan loading agar user menunggu
      await sock.sendMessage(chatId, { text: "*Loading* ⌛\nTunggu beberapa detik..." });
      
      // Buat array card untuk carousel
      let cards = [];
      for (const video of videos) {
        let mediaMsg = {};
        try {
          // Siapkan thumbnail dengan fungsi upload ke server WhatsApp
          mediaMsg = await prepareWAMessageMedia(
            { image: { url: video.thumbnail } },
            { upload: sock.waUploadToServer.bind(sock) }
          );
        } catch (err) {
          console.error("Error preparing thumbnail:", err);
        }
        
        // Buat card interaktif dengan tombol Download MP3 dan Download MP4
        const card = {
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: video.title,
            hasMediaAttachment: true,
            ...mediaMsg
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons: [
              {
                buttonId: `#ytmp3 ${video.url}`,
                buttonText: { displayText: 'Download MP3' },
                type: 1
              },
              {
                buttonId: `#ytmp4 ${video.url}`,
                buttonText: { displayText: 'Download MP4' },
                type: 1
              }
            ]
          }),
          footer: proto.Message.InteractiveMessage.Footer.fromObject({
            text: `Channel: ${video.author.name} | Durasi: ${video.timestamp}`
          })
        };
        cards.push(card);
      }
      
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
                text: `Hasil pencarian untuk *${query}*`
              }),
              carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                cards: cards
              })
            })
          }
        }
      };

      const msg = await generateWAMessageFromContent(
        chatId,
        interactiveMsgContent,
        { userJid: chatId, quoted: message }
      );
      await sock.relayMessage(chatId, msg.message, { messageId: msg.key.id });
      
    } catch (error) {
      console.error("Error during YouTube processing:", error);
      return await sock.sendMessage(chatId, { text: 'Gagal memproses YouTube.' });
    }
  }
};
