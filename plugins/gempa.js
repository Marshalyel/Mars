// plugins/gempa.js

const axios = require('axios');
const xml2js = require('xml2js');

let lastGempaTimestamp = null;

module.exports = {
  name: 'gempa',
  description: 'Mendeteksi gempa terbaru BMKG dan memberi notifikasi update jika ada perubahan',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      // Ambil data XML gempa terbaru dari BMKG
      const response = await axios.get('https://data.bmkg.go.id/gempaterkini.xml');
      const xmlData = response.data;
      
      // Parsing XML ke JSON menggunakan parseStringPromise
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);
      
      // Pastikan struktur data sesuai
      if (!result || !result.Infogempa || !result.Infogempa.gempa) {
        return await sock.sendMessage(chatId, { text: 'Data gempa tidak tersedia atau format XML tidak sesuai.' });
      }
      
      // Jika terdapat lebih dari satu data gempa, ambil yang pertama
      let gempa = result.Infogempa.gempa;
      if (Array.isArray(gempa)) gempa = gempa[0];
      
      // Ambil timestamp gempa (gunakan gempa.DateTime jika ada, atau gabungkan gempa.Tanggal dan gempa.Jam)
      let currentTimestamp = gempa.DateTime;
      if (!currentTimestamp && gempa.Tanggal && gempa.Jam) {
        currentTimestamp = `${gempa.Tanggal} ${gempa.Jam}`;
      }
      if (!currentTimestamp) currentTimestamp = 'N/A';
      
      // Tentukan pesan update berdasarkan perbandingan timestamp
      let updateMessage = '';
      if (!lastGempaTimestamp) {
        updateMessage = 'Ini adalah data gempa pertama yang diambil.';
      } else if (currentTimestamp !== lastGempaTimestamp) {
        updateMessage = 'Update: Gempa terbaru telah terdeteksi!';
      } else {
        updateMessage = 'Belum ada update gempa terbaru.';
      }
      lastGempaTimestamp = currentTimestamp;
      
      // Ambil informasi gempa dengan fallback "N/A"
      const magnitude = gempa.Magnitude || 'N/A';
      const kedalaman = gempa.Kedalaman || 'N/A';
      const lintang   = gempa.Lintang   || 'N/A';
      const bujur     = gempa.Bujur     || 'N/A';
      const wilayah   = gempa.Wilayah   || 'N/A';
      const potensi   = gempa.Potensi   || 'N/A';
      
      const infoText = `*Gempa Terbaru BMKG*\n` +
                       `${updateMessage}\n\n` +
                       `Waktu     : ${currentTimestamp}\n` +
                       `Magnitude : ${magnitude}\n` +
                       `Kedalaman : ${kedalaman}\n` +
                       `Lintang   : ${lintang}\n` +
                       `Bujur     : ${bujur}\n` +
                       `Wilayah   : ${wilayah}\n` +
                       `Potensi   : ${potensi}`;
      
      await sock.sendMessage(chatId, { text: infoText });
      
    } catch (error) {
      console.error("Error fetching gempa data:", error);
      await sock.sendMessage(chatId, { text: 'Gagal mengambil data gempa terbaru.' });
    }
  }
};
