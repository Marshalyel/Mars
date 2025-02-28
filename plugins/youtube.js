// plugins/YouTube.js

const yts = require('yt-search');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'youtube',
  description: 'Mencari video YouTube dan mengirimkan hasil dalam bentuk card interaktif dengan tombol .ytmp3 dan .ytmp4',
  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
    }
    const query = args.join(' ').trim();
    try {
      // Cari video menggunakan yt-search
      const searchResult = await yts(query);
      if (!searchResult.videos || searchResult.videos.length === 0) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      // Ambil video teratas sebagai contoh
      const video = searchResult.videos[0];
      const videoUrl = video.url;
      
      // Siapkan thumbnail sebagai media header
      let mediaMsg = {};
      try {
        mediaMsg = await prepareWAMessageMedia(
          { image: { url: video.thumbnail } },
          { upload: sock.waUploadToServer.bind(sock) }
        );
      } catch (err) {
        console.error("Error preparing thumbnail:", err);
      }
      
      // Buat card interaktif dengan tombol .ytmp3 dan .ytmp4
      const card = {
        header: proto.Message.InteractiveMessage.Header.fromObject({
          title: video.title,
          hasMediaAttachment: true,
          ...((mediaMsg && mediaMsg.message && mediaMsg.message.imageMessage) ? mediaMsg.message.imageMessage : {})
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
          buttons: [
            {
              buttonId: `.ytmp3 ${videoUrl}`,
              buttonText: { displayText: `.ytmp3 ${videoUrl}` },
              type: 1
            },
            {
              buttonId: `.ytmp4 ${videoUrl}`,
              buttonText: { displayText: `.ytmp4 ${videoUrl}` },
              type: 1
            }
          ]
        }),
        footer: proto.Message.InteractiveMessage.Footer.fromObject({
          text: `Channel: ${video.author.name || "Unknown"} | Durasi: ${video.timestamp}`
        })
      };

      // Buat pesan carousel interaktif tanpa viewOnceMessage wrapper
      const interactiveMsgContent = {
        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
          body: proto.Message.InteractiveMessage.Body.fromObject({
            text: `Hasil pencarian untuk *${query}*`
          }),
          carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
            cards: [card]
          })
        })
      };

      const msg = await generateWAMessageFromContent(
        chatId,
        interactiveMsgContent,
        { userJid: chatId, quoted: m }
      );
      await sock.relayMessage(chatId, msg.message, { messageId: msg.key.id });
    } catch (error) {
      console.error("Error dalam pemrosesan YouTube:", error);
      await sock.sendMessage(chatId, { text: 'Gagal memproses pencarian YouTube.' }, { quoted: m });
    }
  }
};
