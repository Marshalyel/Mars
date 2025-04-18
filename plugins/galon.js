// plugins/galon.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const DOCUMENT_ID = '1Wis0wma8-q0HbqrHkwQdx6p1xT4bnwJIeLxodEI4ZO0';

module.exports = {
  name: 'galon',
  description: 'Menampilkan data penjualan galon dari Google Docs',

  run: async (sock, m, args) => {
    const chatId = m.key.remoteJid;
    try {
      // Periksa apakah file kredensial tersedia
      const credPath = path.join(__dirname, '../credentials/service-account.json');
      if (!fs.existsSync(credPath)) {
        return await sock.sendMessage(chatId, { text: 'File kredensial tidak ditemukan. Harap letakkan file `service-account.json` di folder `credentials`.' });
      }

      // Ambil dokumen Google Docs
      const doc = await getDocument(credPath);
      const content = doc.body.content || [];

      // Temukan tabel pertama di dokumen
      const tableElem = content.find(el => el.table);
      if (!tableElem) {
        return await sock.sendMessage(chatId, { text: 'Tidak menemukan tabel di dokumen.' });
      }
      const rows = tableElem.table.tableRows || [];
      if (rows.length < 2) {
        return await sock.sendMessage(chatId, { text: 'Tabel tidak memiliki data.' });
      }

      // Proses data
      let overallTotal = 0;
      let summary = '*Data Penjualan Galon:*
';
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].tableCells || [];
        const pelanggan = getCellText(cells[0]);
        const jumlahStr = getCellText(cells[1]);
        const hargaStr = getCellText(cells[2]);
        const jumlah = parseFloat(jumlahStr.replace(/\./g, '').replace(/,/g, '.')) || 0;
        const harga = parseFloat(hargaStr.replace(/\./g, '').replace(/,/g, '.')) || 0;
        const total = jumlah * harga;
        overallTotal += total;
        summary += `\n${i}. ${pelanggan}\n   Jumlah: ${jumlahStr}\n   Harga: ${hargaStr}\n   Total: Rp ${total.toLocaleString('id-ID')}\n`;
      }
      summary += `\n*Total Semua: Rp ${overallTotal.toLocaleString('id-ID')}*`;

      // Kirim ringkasan
      await sock.sendMessage(chatId, { text: summary });
    } catch (error) {
      console.error(chalk.red('Error plugin galon:'), error);
      await sock.sendMessage(m.key.remoteJid, { text: 'Terjadi kesalahan saat mengambil data.' });
    }
  },

  handleButtons: async () => {
    // Tidak ada tombol interaktif untuk galon
  }
};

// --------------------
// Helper functions
// --------------------

async function authorize(credPath) {
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/documents.readonly']
  });
  return auth.getClient();
}

async function getDocument(credPath) {
  const authClient = await authorize(credPath);
  const docs = google.docs({ version: 'v1', auth: authClient });
  const res = await docs.documents.get({ documentId: DOCUMENT_ID });
  return res.data;
}

function getCellText(cell) {
  if (!cell || !cell.content) return '';
  let text = '';
  cell.content.forEach(item => {
    if (item.paragraph && item.paragraph.elements) {
      item.paragraph.elements.forEach(elem => {
        if (elem.textRun && elem.textRun.content) {
          text += elem.textRun.content.trim();
        }
      });
    }
  });
  return text;
                            }
