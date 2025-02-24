// plugins/youtube.js

const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const tmp = require('tmp');
const fs = require('fs');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menyediakan tombol Download MP3 & MP4 yang langsung mengirim file',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    
    // Jika pesan merupakan response dari tombol (button response)
    if (message.message && message.message.buttonsResponseMessage) {
      const selectedButtonId = message.message.buttonsResponseMessage.selectedButtonId;
      if (selectedButtonId.startsWith('ytmp3:')) {
        const videoUrl = selectedButtonId.slice('ytmp3:'.length);
        await sock.sendMessage(chatId, { text: 'Sedang mengonversi video ke MP3, mohon tunggu...' });
        const tempMp3 = tmp.tmpNameSync({ postfix: '.mp3' });
        ffmpeg(ytdl(videoUrl, { quality: 'highestaudio' }))
          .audioBitrate(128)
          .save(tempMp3)
          .on('end', async () => {
            await sock.sendMessage(chatId, { audio: { url: tempMp3 }, mimetype: 'audio/mpeg' });
            fs.unlinkSync(tempMp3);
          })
          .on('error', async err => {
            console.error("Error converting to MP3:", err);
            await sock.sendMessage(chatId, { text: 'Gagal mengonversi video ke MP3.' });
          });
        return;
      } else if (selectedButtonId.startsWith('ytmp4:')) {
        const videoUrl = selectedButtonId.slice('ytmp4:'.length);
        await sock.sendMessage(chatId, { text: 'Sedang mengunduh video MP4, mohon tunggu...' });
        const tempMp4 = tmp.tmpNameSync({ postfix: '.mp4' });
        const stream = ytdl(videoUrl, { quality: 'highestvideo' });
        const writeStream = fs.createWriteStream(tempMp4);
        stream.pipe(writeStream);
        writeStream.on('finish', async () => {
          await sock.sendMessage(chatId, { video: { url: tempMp4 }, mimetype: 'video/mp4' });
          fs.unlinkSync(tempMp4);
        });
        writeStream.on('error', async (err) => {
          console.error("Error downloading MP4:", err);
          await sock.sendMessage(chatId, { text: 'Gagal mengunduh video MP4.' });
        });
        return;
      }
    }
    
    // Jika bukan button response, lakukan pencarian YouTube
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
      
      // Kirim ringkasan hasil pencarian
      let summaryText = `🔎 *Hasil Pencarian YouTube untuk:* _${query}_\n\n`;
      videos.forEach(video => {
        summaryText += `*🎬 ${video.title}*\n📅 ${video.ago} | ⏳ ${video.timestamp} | 👁 ${video.views}\n🔗 ${video.url}\n\n`;
      });
      await sock.sendMessage(chatId, { text: summaryText });
      
      // Bangun carousel card untuk tiap video
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
        
        // Buat card dengan dua tombol: Download MP3 dan Download MP4
        const card = {
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: video.title,
            hasMediaAttachment: true,
            ...mediaMsg
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons: [
              {
                buttonId: "ytmp3:" + video.url,
                buttonText: { displayText: "Download MP3" },
                type: 1
              },
              {
                buttonId: "ytmp4:" + video.url,
                buttonText: { displayText: "Download MP4" },
                type: 1
              }
            ]
          }),
          footer: proto.Message.InteractiveMessage.Footer.fromObject({
            text: `👤 ${video.author.name || "Unknown"} | 👁 ${video.views} | ⏳ ${video.timestamp}`
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
      await sock.sendMessage(chatId, { text: 'Gagal melakukan pencarian YouTube.' });
    }
  }
};
