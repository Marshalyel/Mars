// plugins/gempa.js

const axios = require('axios');

let lastGempaDateTime = null; // Menyimpan waktu gempa terakhir

/**
 * Fungsi pembantu: cek data gempa dan notifikasi ke owner jika ada update
 * @param {Object} sock - Instance WhatsApp socket
 * @param {string} ownerJid - Nomor owner dalam format JID
 */
async function checkGempaAndNotify(sock, ownerJid) {
  try {
    const response = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
    const data = response.data;
    if (!data || !data.Infogempa || !data.Infogempa.gempa) {
      console.log("Data gempa tidak tersedia.");
      return;
    }
    let gempa = data.Infogempa.gempa;
    if (Array.isArray(gempa)) gempa = gempa[0];

    // Gunakan properti DateTime jika ada, atau gabungan Tanggal dan Jam
    const currentDateTime = gempa.DateTime || `${gempa.Tanggal || ''} ${gempa.Jam || ''}`.trim();

    // Jika belum pernah disimpan, simpan data sekarang dan keluar
    if (!lastGempaDateTime) {
      lastGempaDateTime = currentDateTime;
      console.log("Data gempa awal disimpan:", lastGempaDateTime);
      return;
    }

    // Jika data baru berbeda dari data terakhir, kirim notifikasi ke owner
    if (currentDateTime !== lastGempaDateTime) {
      lastGempaDateTime = currentDateTime; // Perbarui nilai terakhir
      const infoText = `*Update Gempa Terbaru BMKG:*\n` +
                         `Tanggal    : ${gempa.Tanggal || 'N/A'}\n` +
                         `Jam        : ${gempa.Jam || 'N/A'}\n` +
                         `DateTime   : ${currentDateTime || 'N/A'}\n` +
                         `Magnitude  : ${gempa.Magnitude || 'N/A'}\n` +
                         `Kedalaman  : ${gempa.Kedalaman || 'N/A'}\n` +
                         `Lintang    : ${gempa.Lintang || 'N/A'}\n` +
                         `Bujur      : ${gempa.Bujur || 'N/A'}\n` +
                         `Wilayah    : ${gempa.Wilayah || 'N/A'}\n` +
                         `Potensi    : ${gempa.Potensi || 'N/A'}`;
      if (gempa.Shakemap) {
        let shakemapUrl = gempa.Shakemap;
        if (!shakemapUrl.startsWith('http')) {
          // Tambahkan base URL jika hanya nama file
          shakemapUrl = 'https://data.bmkg.go.id/DataMKG/TEWS/' + shakemapUrl;
        }
        await sock.sendMessage(ownerJid, { image: { url: shakemapUrl }, caption: infoText });
      } else {
        await sock.sendMessage(ownerJid, { text: infoText });
      }
      console.log("Notifikasi update gempa dikirim ke owner:", ownerJid);
    } else {
      console.log("Tidak ada update gempa baru.");
    }
  } catch (error) {
    console.error("Error checking gempa update:", error);
  }
}

module.exports = {
  name: 'gempa',
  description: 'Menampilkan data gempa terbaru BMKG beserta peta jika tersedia dan mengirim notifikasi update ke owner.',
  
  // Fungsi run() untuk perintah manual !gempa
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      const response = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
      const data = response.data;
      if (!data || !data.Infogempa || !data.Infogempa.gempa) {
        return await sock.sendMessage(chatId, { text: 'Data gempa tidak tersedia.' });
      }
      let gempa = data.Infogempa.gempa;
      if (Array.isArray(gempa)) gempa = gempa[0];

      const tanggal   = gempa.Tanggal   || 'N/A';
      const jam       = gempa.Jam       || 'N/A';
      const dateTime  = gempa.DateTime  || `${tanggal} ${jam}`;
      const magnitude = gempa.Magnitude || 'N/A';
      const kedalaman = gempa.Kedalaman || 'N/A';
      const lintang   = gempa.Lintang   || 'N/A';
      const bujur     = gempa.Bujur     || 'N/A';
      const wilayah   = gempa.Wilayah   || 'N/A';
      const potensi   = gempa.Potensi   || 'N/A';

      const textMsg = `*Data Gempa Terbaru BMKG:*\n` +
                      `Tanggal    : ${tanggal}\n` +
                      `Jam        : ${jam}\n` +
                      `DateTime   : ${dateTime}\n` +
                      `Magnitude  : ${magnitude}\n` +
                      `Kedalaman  : ${kedalaman}\n` +
                      `Lintang    : ${lintang}\n` +
                      `Bujur      : ${bujur}\n` +
                      `Wilayah    : ${wilayah}\n` +
                      `Potensi    : ${potensi}`;
      
      if (gempa.Shakemap) {
        let shakemapUrl = gempa.Shakemap;
        if (!shakemapUrl.startsWith('http')) {
          shakemapUrl = 'https://data.bmkg.go.id/DataMKG/TEWS/' + shakemapUrl;
        }
        await sock.sendMessage(chatId, { image: { url: shakemapUrl }, caption: textMsg });
      } else {
        await sock.sendMessage(chatId, { text: textMsg });
      }
    } catch (error) {
      console.error("Error fetching gempa data:", error);
      await sock.sendMessage(chatId, { text: 'Gagal mengambil data gempa terbaru.' });
    }
  },
  
  // Fungsi autoCheck() untuk dipanggil secara periodik (misalnya dari index.js)
  autoCheck: async (sock) => {
    const ownerJid = require('../setting').owner;
    if (!ownerJid) return;
    await checkGempaAndNotify(sock, ownerJid);
  }
};