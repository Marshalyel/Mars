// plugins/ytmp4.js

const axios = require('axios');
const { Buffer } = require('buffer');
const ytRegex = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;
const atob = x => Buffer.from(x, 'base64').toString('utf8');
const btoa = x => Buffer.from(x, 'utf8').toString('base64');

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

async function convertYouTube(url, format = 'mp4') {
  if (!ytRegex.test(url))
    throw new Error('Link tidak valid, masukkan link YouTube yang benar.');
  const vidId = url.match(ytRegex)[3];
  
  const webb = await axios.get('https://ytmp3.cc/Vluk/', { headers });
  const tokenMatch = webb.data?.match(/atob\('(.*?)'\)/);
  if (!tokenMatch) throw new Error('Token tidak ditemukan');
  const tokenData = tokenMatch[1];
  const tokenJsonMatch = atob(tokenData).match(/var gC = ({[\s\S]*?});/);
  if (!tokenJsonMatch) throw new Error('Token JSON tidak ditemukan');
  const tokenJson = JSON.parse(tokenJsonMatch[1]);
  const token = btoa(tokenJson[2] + "-" + tokenizer(tokenJson, tokenJson.f[6]));
  
  const init = await axios.get(`https://d.ecoe.cc/api/v1/init?k=${token}&_=${Math.random()}`, { headers })
    .then(x => x.data);
  const convert = await axios.get(`${init.convertURL}&v=https://www.youtube.com/watch?v=${vidId}&f=${format}&_=${Math.random()}`, { headers })
    .then(x => x.data);
  
  if (convert.redirectURL) {
    const res = await axios.get(convert.redirectURL, { headers }).then(x => x.data);
    return { title: res.title, link: res.downloadURL };
  } else {
    let res, retry = 0;
    // Tingkatkan batas retry dan waktu tunggu
    do {
      if (retry > 100) throw new Error('Timeout');
      res = await axios.get(convert.progressURL, { headers }).then(x => x.data);
      await new Promise(resolve => setTimeout(resolve, 1500));
      retry++;
    } while (res.progress < 3);
    return { title: res.title, link: convert.downloadURL };
  }
}

module.exports = {
  name: 'ytmp4',
  description: 'Mengunduh video MP4 dari YouTube dengan !ytmp4 <link>',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    if (!args.length) {
      return await sock.sendMessage(chatId, { text: 'Masukkan link YouTube untuk mengunduh video.' }, { quoted: message });
    }
    const url = args[0].trim();
    if (!ytRegex.test(url)) {
      return await sock.sendMessage(chatId, { text: 'Link tidak valid. Pastikan link YouTube yang dimasukkan benar.' }, { quoted: message });
    }
    try {
      const { title, link } = await convertYouTube(url, 'mp4');
      await sock.sendMessage(
        chatId,
        {
          video: { url: link },
          mimetype: 'video/mp4',
          caption: `Judul: ${title}`,
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
