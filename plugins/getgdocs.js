const settings = require('../setting');
const axios = require('axios');
const cheerio = require('cheerio');


const URL = `https://docs.google.com/document/d/${settings.DOCUMENT_ID}/edit`;

module.exports = {
  name: 'getgdocs',
  description: 'Menampilkan data dari Google Docs publik dan merapikan otomatis',

  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;

    try {
      const res = await axios.get(URL);
      const $ = cheerio.load(res.data);
      const rawText = $('body').text();

      // Cari blok teks tabel (baris baris data)
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

      // Filter baris yang kemungkinan format tabel: setidaknya 3 kolom (pelanggan, jumlah, harga)
      const dataLines = lines.filter(line => line.split(/\s{2,}|\t/).length >= 3);

      if (dataLines.length === 0) {
        return await sock.sendMessage(chatId, { text: 'Data tabel tidak ditemukan atau tidak terbaca.' }, { quoted: m });
      }

      let summary = '*Data Penjualan Galon:*\n';
      let totalSemua = 0;

      dataLines.forEach((line, i) => {
        const [pelanggan, jumlahStr, hargaStr] = line.split(/\s{2,}|\t/).map(s => s.trim());
        const jumlah = parseFloat(jumlahStr.replace(/\./g, '').replace(/,/g, '.')) || 0;
        const harga = parseFloat(hargaStr.replace(/\./g, '').replace(/,/g, '.')) || 0;
        const total = jumlah * harga;
        totalSemua += total;

        summary += `\n${i + 1}. ${pelanggan}\n   Jumlah: ${jumlahStr}\n   Harga: ${hargaStr}\n   Total: Rp ${total.toLocaleString('id-ID')}\n`;
      });

      summary += `\n*Total Semua: Rp ${totalSemua.toLocaleString('id-ID')}*`;

      await sock.sendMessage(chatId, { text: summary }, { quoted: m });

    } catch (err) {
      console.error('Galon plugin error:', err.message);
      await sock.sendMessage(chatId, { text: 'Gagal mengambil atau memproses dokumen galon.' }, { quoted: m });
    }
  },

  handleButtons: async () => {
    // Tidak ada tombol
  }
};