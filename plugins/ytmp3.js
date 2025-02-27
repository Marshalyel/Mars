// plugins/ytmp3.js

const axios = require('axios');
const { Buffer } = require('buffer');
const ytRegex = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;

// Helper base64 untuk Node.js
const atob = x => Buffer.from(x, 'base64').toString('utf8');
const btoa = x => Buffer.from(x, 'utf8').toString('base64');

// Header untuk request ke API konversi
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

// Fungsi tokenizer (logika ndbotz)
function tokenizer(nyxz, ndbz) {
  if (eval(atob(nyxz.t[0])) == nyxz.t[1]) {
    for (let c = 0; c < atob(nyxz[0]).split(nyxz.f[5]).length; c++) {
      ndbz += (nyxz.f[4] > 0 ? nyxz[1].split("").reverse().join("") : nyxz[1])
              [atob(nyxz[0]).split(nyxz.f[5])[c] - nyxz.f[3]];
    }
    ndbz = nyxz.f[1] == 1 ? ndbz.toLowerCase() : nyxz.f[1] == 2 ? ndbz.toUpperCase() : ndbz;
    return nyxz.f[0].length > 0 ? nyxz.f[0] : nyxz.f[2] > 0 ? ndbz.substring(0, nyxz.f[2] + 1) : ndbz;
  }
}

// Fungsi convertYouTube untuk format audio (mp3)
async function convertYouTube(url, format = 'mp3') {
  if (!ytRegex.test(url))
    throw new Error('Link tidak valid, masukkan link YouTube yang benar.');
  const vidId = url.match(ytRegex)[3];
  
  // Dapatkan token dari endpoint ytmp3.cc
  const webb = await axios.get('https://ytmp3.cc/Vluk/', { headers });
  const tokenMatch = webb.data?.match(/atob\('(.*?)'\)/);
  if (!tokenMatch) throw new Error('Token tidak ditemukan');
  const tokenData = tokenMatch[1];
  const tokenJsonMatch = atob(tokenData).match(/var gC = ({[\s\S]*?});/);
  if (!tokenJsonMatch) throw new Error('Token JSON tidak ditemukan');
  const tokenJson = JSON.parse(tokenJsonMatch[1]);
  const token = btoa(tokenJson[2] + "-" + tokenizer(tokenJson, tokenJson.f[6]));
  
  // Inisialisasi konversi
  const init = await axios
    .get(`https://d.ecoe.cc/api/v1/init?k=${token}&_=${Math.random()}`, { headers })
    .then(x => x.data);
  const convert = await axios
    .get(`${init.convertURL}&v=https://www.youtube.com/watch?v=${vidId}&f=${format}&_=${Math.random()}`, { headers })
    .then(x => x.data);
  
  if (convert.redirectURL) {
    const res = await axios.get(convert.redirectURL, { headers }).then(x => x.data);
    return { title: res.title, link: res.downloadURL };
  } else {
    let res, retry = 0;
    do {
      if (retry > 50) throw new Error('Timeout');
      res = await axios.get(convert.progressURL, { headers }).then(x => x.data);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retry++;
    } while (res.progress < 3);
    return { title: res.title, link: convert.downloadURL };
  }
}

module.exports = {
  name: 'ytmp3',
  description: 'Mengunduh audio MP3 dari YouTube dengan !ytmp3 <link>',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan link YouTube untuk mengunduh audio.' }, { quoted: message });
    }
    const url = args[0].trim();
    if (!ytRegex.test(url)) {
      return await sock.sendMessage(chatId, { text: 'Link tidak valid. Pastikan link YouTube yang dimasukkan benar.' }, { quoted: message });
    }
    try {
      const { title, link } = await convertYouTube(url, 'mp3');
      await sock.sendMessage(
        chatId,
        {
          audio: { url: link },
          mimetype: 'audio/mp4',
          contextInfo: { mentionedJid: [message.key.participant || message.key.remoteJid] }
        },
        { quoted: message }
      );
    } catch (e) {
      await sock.sendMessage(
        chatId,
        { text: `Yah error :(\n${e.message}` },
        { quoted: message }
      );
    }
  }
};
