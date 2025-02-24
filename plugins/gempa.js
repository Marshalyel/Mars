// plugins/gempa.js
//Mars
const axios = require('axios');
const xml2js = require('xml2js');

module.exports = {
  name: 'gempa',
  description: 'Menampilkan data gempa terbaru dari BMKG',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      // Ambil data XML gempa terbaru dari BMKG
      const response = await axios.get('https://data.bmkg.go.id/gempaterkini.xml');
      const xmlData = response.data;

      // Parsing XML menggunakan parseStringPromise untuk mendapatkan JSON
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);

      // Periksa apakah struktur XML sesuai
      if (!result || !result.Infogempa || !result.Infogempa.gempa) {
        return await sock.sendMessage(chatId, { text: 'Data gempa tidak tersedia atau format XML tidak sesuai.' });
      }

      let gempa = result.Infogempa.gempa;
      // Jika ada lebih dari satu data gempa, ambil yang pertama
      if (Array.isArray(gempa)) gempa = gempa[0];

      // Ambil informasi penting dengan fallback "N/A"
      const tanggal   = gempa.Tanggal   || 'N/A';
      const jam       = gempa.Jam       || 'N/A';
      const dateTime  = gempa.DateTime  || `${tanggal} ${jam}`;
      const magnitude = gempa.Magnitude || 'N/A';
      const kedalaman = gempa.Kedalaman || 'N/A';
      const lintang   = gempa.Lintang   || 'N/A';
      const bujur     = gempa.Bujur     || 'N/A';
      const wilayah   = gempa.Wilayah   || 'N/A';
      const potensi   = gempa.Potensi   || 'N/A';

      const infoText = `Gempa Terbaru BMKG:\n` +
                       `Tanggal   : ${tanggal}\n` +
                       `Jam       : ${jam}\n` +
                       `DateTime  : ${dateTime}\n` +
                       `Magnitude : ${magnitude}\n` +
                       `Kedalaman : ${kedalaman}\n` +
                       `Lintang   : ${lintang}\n` +
                       `Bujur     : ${bujur}\n` +
                       `Wilayah   : ${wilayah}\n` +
                       `Potensi   : ${potensi}`;

      await sock.sendMessage(chatId, { text: infoText });
    } catch (error) {
      console.error("Error fetching or processing gempa data:", error);
      await sock.sendMessage(chatId, { text: 'Gagal mengambil data gempa terbaru.' });
    }
  }
};
