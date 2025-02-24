// plugins/youtube.js

const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');
const tmp = require('tmp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require('fs');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menyediakan tombol download MP3 & MP4',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;

    // --- Jika pesan merupakan button response, proses download ---
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
          .on('error', err => {
            console.error("Error converting to MP3:", err);
            sock.sendMessage(chatId, { text: 'Gagal mengonversi video ke MP3.' });
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
        writeStream.on('error', err => {
          console.error("Error downloading MP4:", err);
          sock.sendMessage(chatId, { text: 'Gagal mengunduh video MP4.' });
        });
        return;
      }
    }

    // --- Jika bukan button response, lakukan pencarian YouTube ---
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Harap berikan query pencarian. Contoh: !youtube tutorial javascript' });
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
                  action: "ytmp3:" + video.url
                })
              },
              {
                name: "cta_mp4",
                buttonParamsJson: JSON.stringify({
                  display_text: "Download MP4",
                  action: "ytmp4:" + video.url
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
      
      await sock.sendMessage(chatId, { text: summaryText });
      
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
