// plugins/gempa.js

const axios = require('axios');

module.exports = {
  name: 'gempa',
  description: 'Menampilkan data gempa terbaru BMKG (autogempa.json)',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      // Ambil data gempa dari BMKG autogempa.json
      const response = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
      const data = response.data;

      // Pastikan data tersedia
      if (!data || !data.Infogempa || !data.Infogempa.gempa) {
        return await sock.sendMessage(chatId, { text: 'Data gempa tidak tersedia.' });
      }

      // Ambil data gempa terbaru (anggap data gempa berupa array, ambil yang pertama)
      let gempa = data.Infogempa.gempa;
      if (Array.isArray(gempa)) gempa = gempa[0];

      // Ekstrak informasi yang diinginkan; sesuaikan nama properti dengan struktur JSON BMKG
      const tanggal   = gempa.Tanggal   || 'N/A';
      const jam       = gempa.Jam       || 'N/A';
      const dateTime  = gempa.DateTime  || `${tanggal} ${jam}`;
      const magnitude = gempa.Magnitude || 'N/A';
      const kedalaman = gempa.Kedalaman || 'N/A';
      const lintang   = gempa.Lintang   || 'N/A';
      const bujur     = gempa.Bujur     || 'N/A';
      const wilayah   = gempa.Wilayah   || 'N/A';
      const potensi   = gempa.Potensi   || 'N/A';

      // Buat pesan dengan informasi gempa
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
  }
};
