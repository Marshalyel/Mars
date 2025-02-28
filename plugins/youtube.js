// plugins/YouTube.js

const axios = require('axios');
const yts = require('yt-search');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const fs = require('fs');

module.exports = {
  name: 'youtube',
  description: 'Mencari video YouTube dan mengirim hasil dalam bentuk carousel dengan list menu interaktif untuk aksi (Salin Link, Download MP3/MP4)',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
    }
    
    const query = args.join(' ').trim();
    
    try {
      // Cari video dengan yt-search
      const searchResult = await yts(query);
      const videos = searchResult.videos.slice(0, 7);
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      
      // Buat pesan loading (opsional)
      await sock.sendMessage(chatId, { text: "*Loading* ⌛\nTunggu beberapa detik..." });
      
      // Buat array card untuk carousel
      let cards = [];
      for (const video of videos) {
        let mediaMsg = {};
        try {
          // Siapkan thumbnail; Anda bisa mengganti URL thumbnail atau menggunakan file lokal
          mediaMsg = await prepareWAMessageMedia(
            { image: { url: video.thumbnail } },
            { upload: sock.waUploadToServer.bind(sock) }
          );
        } catch (err) {
          console.error("Error preparing thumbnail:", err);
        }
        
        // Bangun struktur list menu untuk tombol
        const listMenu = {
          title: "Pilih Aksi",
          sections: [
            {
              title: "Aksi Video",
              rows: [
                { id: `#copy ${video.url}`, title: "Salin Link", description: "Salin URL video YouTube" },
                { id: `#ytmp3 ${video.url}`, title: "Download MP3", description: "Download audio MP3" },
                { id: `#ytmp4 ${video.url}`, title: "Download MP4", description: "Download video MP4" }
              ]
            }
          ]
        };
        
        // Buat card interaktif dengan tombol list menu
        const card = {
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: video.title,
            hasMediaAttachment: true,
            ...mediaMsg
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons: [
              {
                name: "single_select",
                buttonParamsJson: JSON.stringify(listMenu)
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
