// plugins/gempa.js

const axios = require('axios');

let lastGempaDateTime = null; // Variabel untuk menyimpan data gempa terakhir

// Fungsi untuk memeriksa pembaruan data gempa dan mengirim notifikasi ke owner jika ada update
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

    // Jika belum pernah disimpan, simpan data sekarang
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
      await sock.sendMessage(ownerJid, { text: infoText });
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
  description: 'Menampilkan data gempa terbaru BMKG dan secara otomatis mengirim update ke owner jika terjadi perubahan.',
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

      await sock.sendMessage(chatId, { text: textMsg });
    } catch (error) {
      console.error("Error fetching gempa data:", error);
      await sock.sendMessage(chatId, { text: 'Gagal mengambil data gempa terbaru.' });
    }
  },
  // Fungsi autoCheck yang dapat dipanggil secara periodik (misal dari index.js)
  autoCheck: async (sock) => {
    if (!sock) return;
    // Pastikan settings.owner sudah terisi
    const ownerJid = require('../setting').owner;
    if (!ownerJid) return;
    await checkGempaAndNotify(sock, ownerJid);
  }
};

// Fungsi pembantu: cek data gempa dan notifikasi
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
    const currentDateTime = gempa.DateTime || `${gempa.Tanggal || ''} ${gempa.Jam || ''}`.trim();
    if (!lastGempaDateTime) {
      lastGempaDateTime = currentDateTime;
      console.log("Data gempa awal disimpan:", lastGempaDateTime);
      return;
    }
    if (currentDateTime !== lastGempaDateTime) {
      lastGempaDateTime = currentDateTime;
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
      await sock.sendMessage(ownerJid, { text: infoText });
      console.log("Notifikasi update gempa dikirim ke owner:", ownerJid);
    } else {
      console.log("Tidak ada update gempa baru.");
    }
  } catch (error) {
    console.error("Error checking gempa update:", error);
  }
}
