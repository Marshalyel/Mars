// plugins/youtube.js

const axios = require('axios');
const yts = require('yt-search');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

// Helper base64 untuk Node.js
const atob = x => Buffer.from(x, 'base64').toString('utf8');
const btoa = x => Buffer.from(x, 'utf8').toString('base64');

/* ndbotz */
function tokenizer(nyxz, ndbz) {
  if (eval(atob(nyxz.t[0])) == nyxz.t[1]) {
    for (var c = 0; c < atob(nyxz[0]).split(nyxz.f[5]).length; c++) {
      ndbz += (0 < nyxz.f[4]
        ? nyxz[1].split("").reverse().join("")
        : nyxz[1])[atob(nyxz[0]).split(nyxz.f[5])[c] - nyxz.f[3]];
    }
    ndbz = nyxz.f[1] == 1 ? ndbz.toLowerCase() : nyxz.f[1] == 2 ? ndbz.toUpperCase() : ndbz;
    return nyxz.f[0].length > 0
      ? nyxz.f[0]
      : nyxz.f[2] > 0
      ? ndbz.substring(0, nyxz.f[2] + 1)
      : ndbz;
  }
}
/* ndbotz */

// Regex untuk mendeteksi link YouTube
const ytRegex = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;

// Header untuk request (digunakan oleh API konversi)
const headers = {
  'Accept': '*/*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Origin': 'https://ytmp3.cc',
  'Pragma': 'no-cache',
  'Referer': 'https://ytmp3.cc/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.3',
  'sec-ch-ua': '"Not-A.Brand";v="99", "Chromium";v="124"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Windows"'
};

/**
 * Fungsi ytdl: Mengonversi link YouTube menjadi link download MP3.
 * @param {string} url - Link YouTube.
 * @returns {Promise<{title: string, link: string}>}
 */
async function ytdl(url) {
  if (!ytRegex.test(url)) {
    throw new Error('Link tidak valid, input yang bener dong 😡');
  }
  try {
    const vidId = url.match(ytRegex)[3];
    const webb = await axios.get('https://ytmp3.cc/Vluk/', { headers });
    const tokenMatch = webb.data?.match(/atob\('(.*?)'\)/);
    if (!tokenMatch) throw new Error('Token tidak ditemukan');
    const tokenData = tokenMatch[1];
    const tokenJsonMatch = atob(tokenData).match(/var gC = ({[\s\S]*?});/);
    if (!tokenJsonMatch) throw new Error('Token JSON tidak ditemukan');
    const tokenJson = JSON.parse(tokenJsonMatch[1]);
    const token = btoa(tokenJson[2] + "-" + tokenizer(tokenJson, tokenJson.f[6]));
    const init = await axios.get(`https://d.ecoe.cc/api/v1/init?k=${token}&_=${Math.random()}`, { headers }).then(x => x.data);
    const convert = await axios.get(`${init.convertURL}&v=https://www.youtube.com/watch?v=${vidId}&f=mp3&_=${Math.random()}`, { headers }).then(x => x.data);
    if (convert.redirectURL) {
      const res = await axios.get(convert.redirectURL, { headers }).then(x => x.data);
      return {
        title: res.title,
        link: res.downloadURL
      };
    } else {
      let res, retry = 0;
      do {
        if (retry > 50) throw new Error('Timeout');
        res = await axios.get(convert.progressURL, { headers }).then(x => x.data);
        await new Promise(resolve => setTimeout(resolve, 1000));
        retry++;
      } while (res.progress < 3);
      return {
        title: res.title,
        link: convert.downloadURL
      };
    }
  } catch (e) {
    let err = new Error(`Eror bang, nanti aja download nya, nih log eror nya: ${e.message}`);
    err.error = e;
    throw err;
  }
}

module.exports = {
  name: 'youtube',
  description: 'Melakukan pencarian video YouTube dan menampilkan hasil dalam bentuk carousel interaktif. Jika query berupa link atau dengan prefix "ytmp3:", langsung download audio MP3.',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      if (!args.length) {
        return await sock.sendMessage(chatId, { text: 'Masukkan query pencarian, misal: !youtube tutorial javascript' });
      }
      let query = args.join(' ').trim();

      // Jika query diawali dengan "ytmp3:" langsung proses download audio
      if (query.startsWith('ytmp3:')) {
        const url = query.slice(6).trim();
        const { title, link } = await ytdl(url);
        await sock.sendMessage(
          chatId,
          {
            audio: { url: link },
            mimetype: 'audio/mp4',
            contextInfo: { mentionedJid: [message.key.participant || message.key.remoteJid] }
          },
          { quoted: message }
        );
        return;
      }
      // Jika query merupakan link YouTube langsung download audio
      if (ytRegex.test(query)) {
        const { title, link } = await ytdl(query);
        await sock.sendMessage(
          chatId,
          {
            audio: { url: link },
            mimetype: 'audio/mp4',
            contextInfo: { mentionedJid: [message.key.participant || message.key.remoteJid] }
          },
          { quoted: message }
        );
        return;
      }
      // Jika query bukan link, lakukan pencarian dengan yt-search
      const searchResult = await yts(query);
      const videos = searchResult.videos.slice(0, 7);
      if (!videos.length) {
        return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
      }
      // Kirim pesan loading
      await sock.sendMessage(chatId, { text: "*Loading* ⌛ \n> Tunggu beberapa detik..." });
      // Buat array card untuk carousel
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
        // Buat card interaktif dengan tombol deposit-style
        const card = {
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: video.title,
            hasMediaAttachment: true,
            ...mediaMsg
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
            buttons: [
              {
                buttonId: `#copy ${video.url}`,
                buttonText: { displayText: 'Salin Link' },
                type: 1
              },
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
                text: `🔎 Hasil pencarian untuk *${query}*`
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
