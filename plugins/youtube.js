const ytSearch = require('yt-search');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasil dalam bentuk card carousel dengan tombol Download MP3 & MP4',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
    }
    const query = args.join(' ');

    try {
      const searchResult = await ytSearch(query);
      const videos = searchResult.videos.slice(0, 7);
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }

      await sock.sendMessage(chatId, { text: "*Loading* ⌛ \n > Wait for 5 seconds" });

      let cards = [];
      for (const video of videos) {
        let mediaMsg = {};
        try {
          mediaMsg = await prepareWAMessageMedia(
            { image: { url: video.thumbnail } },
            { upload: sock.waUploadToServer.bind(sock) }
          );
        } catch (err) {
          console.error("Error preparing thumbnail:", err);
        }

        // Tombol interaktif yang mengirim perintah langsung ke bot
        const buttons = [
          {
            buttonId: `#batal ${video.videoId}`,
            buttonText: { displayText: "Batal" },
            type: 1
          },
          {
            buttonId: `#status ${video.videoId}`,
            buttonText: { displayText: "Status" },
            type: 1
          },
          {
            buttonId: `ytmp3 ${video.url}`,
            buttonText: { displayText: "Download MP3" },
            type: 1
          },
          {
            buttonId: `ytmp4 ${video.url}`,
            buttonText: { displayText: "Download MP4" },
            type: 1
          }
        ];

        const card = {
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: video.title,
            hasMediaAttachment: true,
            ...mediaMsg
          }),
          body: proto.Message.InteractiveMessage.Body.fromObject({
            text: `🔗 ${video.url}`
          }),
          footer: proto.Message.InteractiveMessage.Footer.fromObject({
            text: `👤 ${video.author.name || "Unknown"} | 👁 ${video.views} | ⏳ ${video.timestamp}`
          }),
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
              buttons: buttons
            })
          })
        };
        cards.push(card);
      }

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
