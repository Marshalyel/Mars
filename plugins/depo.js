// plugins/depo.js

const axios = require('axios');
const crypto = require('crypto');

// Ganti dengan API key Anda dari Atlantic (atau sesuai penyedia deposit)
const apikey_atlantic = "6uW9SN65GHG8MyN0s98SDUVs6HZyEZLC4mc9ufb3O00m7zSh5b0kE8qGq1vlPgthIDGJznI23ip7dvAOD8dVsh9FMOEttKBIcShb";

module.exports = {
  name: 'depo',
  description: 'Fitur deposit: membuat transaksi deposit dan memantau statusnya',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    // Helper function untuk membalas pesan
    const reply = async (text) => {
      await sock.sendMessage(chatId, { text }, { quoted: message });
    };

    // Validasi jumlah deposit
    const depo = args[0];
    if (!depo) return reply('Masukkan jumlah depositnya!');
    if (isNaN(depo)) return reply('Jumlah deposit harus berupa angka!');
    if (Number(depo) < 500) return reply('Minimal deposit sebesar 500');

    // Generate reference ID unik
    const ref = crypto.randomBytes(7).toString('hex').toUpperCase();

    try {
      // Buat transaksi deposit dengan request POST
      const params = {
        method: 'POST',
        url: 'https://atlantich2h.com/deposit/create',
        data: new URLSearchParams({
          api_key: apikey_atlantic,
          reff_id: ref,
          nominal: depo,
          type: 'ewallet',
          metode: 'qrisfast'
        })
      };

      const res = await axios(params);
      const data = res.data.data;
      
      // Buat pesan detail pembayaran
      const textPembayaran = `Ini adalah detail pembayaran Anda: 
ID Pembayaran: ${data.id}
ID Reff: ${data.reff_id}
Nominal: Rp ${data.nominal}
Status: ${data.status}

Tanggal Pembuatan: ${data.created_at}
Tanggal Expired: ${data.expired_at}
Qr: ${data.qr_image}

> Mohon maaf, QR harus menggunakan link karena bot masih dalam pengembangan.
`;

      // Definisikan tombol untuk "Batal" dan "Status"
      const buttons = [
        {
          buttonId: `#batal ${data.id}`,
          buttonText: { displayText: 'Batal' },
          type: 1
        },
        {
          buttonId: `#status ${data.id}`,
          buttonText: { displayText: 'Status' },
          type: 1
        }
      ];

      // Kirim pesan deposit dengan detail dan tombol
      await sock.sendMessage(chatId, {
        text: textPembayaran,
        footer: null,
        buttons: buttons,
        headerType: 1,
        viewOnce: true
      }, { quoted: message });

      // Fungsi untuk memeriksa status deposit
      const checkStatus = async () => {
        const statusParams = {
          method: 'POST',
          url: 'https://atlantich2h.com/deposit/status',
          data: new URLSearchParams({
            api_key: apikey_atlantic,
            id: data.id
          })
        };
        const response = await axios(statusParams);
        return response.data.data.status;
      };

      // Pantau status deposit setiap 5 detik
      let status = data.status;
      while (status !== 'success') {
        await new Promise(resolve => setTimeout(resolve, 5000));
        status = await checkStatus();
        if (status === 'cancel') {
          await reply('Transaksi dibatalkan.');
          break;
        }
      }
      if (status === 'success') {
        await reply('Deposit berhasil!');
      }
    } catch (error) {
      console.error("Error in deposit plugin:", error);
      await reply("Terjadi kesalahan dalam proses deposit.");
    }
  }
};