const axios = require('axios');
const { parse } = require('csv-parse/sync');

module.exports = {
  name: 'galon',
  description: 'Tampilkan ringkasan penjualan galon dari Google Sheets',
  usage: '!galon',
  async run(sock, m, args) {
    const chatId = m.key.remoteJid;
    try {
      // Ganti SPREADSHEET_ID dan gid=0 sesuai sheet Anda
      const csvUrl = 
        'https://docs.google.com/spreadsheets/d/1eLtgKNmQ8rjORpv9c_z9miRIauwQMXOnS7XXuzs4Lb8/export?format=csv&gid=0';

      // Ambil CSV
      const res = await axios.get(csvUrl);
      const records = parse(res.data, {
        columns: true,
        skip_empty_lines: true
      });

      if (!records.length) {
        return sock.sendMessage(chatId, { text: 'Data kosong atau tidak valid.' });
      }

      // Contoh kolom: Tanggal,Jumlah,Harga
      let totalSemua = 0;
      const perPelanggan = records.reduce((acc, row) => {
        const nama = row.Nama.trim();
        const jumlah = parseInt(row.Jumlah, 10) || 0;
        const harga = parseFloat(row.Harga.replace(/[^\d.]/g, '')) || 0;
        const total = jumlah * harga;
        totalSemua += total;
        if (!acc[nama]) acc[nama] = { jumlah: 0, total: 0 };
        acc[nama].jumlah += jumlah;
        acc[nama].total += total;
        return acc;
      }, {});

      // Bentuk teks output
      let teks = '*Data Penjualan Galon:*\n\n';
      let idx = 1;
      for (const [nama, obj] of Object.entries(perPelanggan)) {
        teks += `${idx}. ${nama}\n   • Jumlah beli: ${obj.jumlah}\n   • Total: Rp ${obj.total.toLocaleString()}\n\n`;
        idx++;
      }
      teks += `*Total Semua:* Rp ${totalSemua.toLocaleString()}`;

      // Kirim ke chat
      await sock.sendMessage(chatId, { text: teks }, { quoted: m });
    } catch (err) {
      console.error('Error plugins/galon:', err);
      await sock.sendMessage(chatId, { text: 'Gagal mengambil data galon.' });
    }
  }
};
