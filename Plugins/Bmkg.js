// plugins/gempa.js

const axios = require('axios');
const xml2js = require('xml2js');

module.exports = {
  name: 'gempa',
  description: 'Mendeteksi gempa terbaru oleh BMKG',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      // Mengambil data XML gempa terbaru dari BMKG
      const response = await axios.get('https://data.bmkg.go.id/gempaterkini.xml');
      const xmlData = response.data;
      
      // Parsing XML ke JSON
      const parser = new xml2js.Parser({ explicitArray: false });
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          console.error("Error parsing XML:", err);
          return sock.sendMessage(chatId, { text: 'Terjadi error saat memproses data gempa.' });
        }
        
        // Asumsi struktur XML BMKG: <Infogempa><gempa>...</gempa></Infogempa>
        let gempa = result && result.Infogempa && result.Infogempa.gempa;
        if (!gempa) {
          return sock.sendMessage(chatId, { text: 'Tidak ada data gempa terbaru.' });
        }
        
        // Jika terdapat lebih dari satu data, ambil yang pertama
        if (Array.isArray(gempa)) gempa = gempa[0];
        
        // Ambil informasi penting (sesuaikan dengan struktur XML BMKG)
        const waktu     = gempa.waktu     || 'N/A';
        const magnitude = gempa.magnitude || 'N/A';
        const kedalaman = gempa.kedalaman || 'N/A';
        const lintang   = gempa.lintang   || 'N/A';
        const bujur     = gempa.bujur     || 'N/A';
        const wilayah   = gempa.wilayah   || 'N/A';
        
        const infoText = `Gempa Terbaru BMKG:\n` +
                         `Waktu     : ${waktu}\n` +
                         `Magnitude : ${magnitude}\n` +
                         `Kedalaman : ${kedalaman}\n` +
                         `Lintang   : ${lintang}\n` +
                         `Bujur     : ${bujur}\n` +
                         `Wilayah   : ${wilayah}`;
        sock.sendMessage(chatId, { text: infoText });
      });
    } catch (error) {
      console.error("Error fetching gempa data:", error);
      sock.sendMessage(chatId, { text: 'Gagal mengambil data gempa terbaru.' });
    }
  }
};
