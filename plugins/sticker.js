const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
  name: 'sticker',
  description: 'Convert image or video to WhatsApp sticker',
  alias: ['s', 'sticker'],
  async run(sock, m, args) {
    const chatId = m.key.remoteJid;
    try {
      const isQuoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const msgType = m.message?.imageMessage || m.message?.videoMessage || isQuoted?.imageMessage || isQuoted?.videoMessage;
      const downloadMsg = isQuoted ? {
        key: m.message.extendedTextMessage.contextInfo.stanzaId,
        message: isQuoted
      } : m;

      if (!msgType) {
        return await sock.sendMessage(chatId, { text: 'Kirim atau reply image/video dengan caption .s atau .sticker' }, { quoted: m });
      }

      const stream = await downloadMediaMessage(
        downloadMsg,
        'buffer',
        {},
        { logger: sock.logger, reuploadRequest: sock.reuploadRequest }
      );

      const isVideo = msgType.mimetype.startsWith('video/');
      const tmpInput = path.join(os.tmpdir(), `${Date.now()}_input${isVideo ? '.mp4' : '.jpg'}`);
      const tmpOutput = path.join(os.tmpdir(), `${Date.now()}_output.webp`);
      fs.writeFileSync(tmpInput, stream);

      await new Promise((resolve, reject) => {
        ffmpeg(tmpInput)
          .outputOptions([
            '-vcodec', 'libwebp',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease',
            '-qscale', '75',
            '-preset', 'picture',
            '-loop', '0',
            '-an',
            '-vsync', '0'
          ])
          .toFormat('webp')
          .save(tmpOutput)
          .on('end', resolve)
          .on('error', reject);
      });

      const sticker = fs.readFileSync(tmpOutput);
      await sock.sendMessage(chatId, { sticker }, { quoted: m });

      fs.unlinkSync(tmpInput);
      fs.unlinkSync(tmpOutput);
    } catch (err) {
      console.error('Sticker plugin error:', err);
      await sock.sendMessage(chatId, { text: 'Gagal membuat sticker.' }, { quoted: m });
    }
  }
};
