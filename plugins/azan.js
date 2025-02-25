// plugins/azan.js

const axios = require('axios');

let lastTimings = null; // menyimpan jadwal adzan terakhir
let notified = {
  Fajr: false,
  Dhuhr: false,
  Asr: false,
  Maghrib: false,
  Isha: false
};
let currentDate = null;

module.exports = {
  name: 'azan',
  description: 'Pengingat adzan otomatis untuk kota Ambon',
  /**
   * Fungsi run() digunakan jika perintah !azan dipanggil secara manual untuk mengirim jadwal adzan hari ini.
   */
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      const timings = await fetchTimings();
      if (!timings) {
        return await sock.sendMessage(chatId, { text: 'Gagal mengambil jadwal adzan.' });
      }
      let text = "*Jadwal Adzan Hari Ini (Ambon)*\n";
      text += `Fajr    : ${timings.Fajr}\n`;
      text += `Dhuhr   : ${timings.Dhuhr}\n`;
      text += `Asr     : ${timings.Asr}\n`;
      text += `Maghrib : ${timings.Maghrib}\n`;
      text += `Isha    : ${timings.Isha}\n`;
      await sock.sendMessage(chatId, { text });
    } catch (error) {
      console.error("Error dalam plugin azan run:", error);
      await sock.sendMessage(chatId, { text: 'Gagal mengambil jadwal adzan.' });
    }
  },
  /**
   * Fungsi autoRun() dijalankan secara otomatis untuk memantau waktu adzan dan mengirim notifikasi ke owner.
   * Pastikan fungsi ini dipanggil dari index.js setelah koneksi sock berhasil.
   */
  autoRun: async (sock) => {
    try {
      // Inisialisasi jadwal adzan dan tanggal awal
      const timings = await fetchTimings();
      if (!timings) {
        console.error("Gagal mengambil jadwal adzan pada autoRun.");
        return;
      }
      lastTimings = timings;
      currentDate = new Date().toLocaleDateString('en-GB'); // Format dd/mm/yyyy
      
      // Set interval setiap menit
      setInterval(async () => {
        const now = new Date();
        const nowDate = now.toLocaleDateString('en-GB');
        // Jika tanggal berubah, reset notifikasi dan re-fetch jadwal adzan
        if (nowDate !== currentDate) {
          currentDate = nowDate;
          notified = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false };
          try {
            lastTimings = await fetchTimings();
            console.log("Jadwal adzan diperbarui untuk hari baru:", currentDate);
          } catch (err) {
            console.error("Gagal memperbarui jadwal adzan pada pergantian hari:", err);
          }
        }
        // Ambil waktu sekarang dalam format HH:mm (asumsi server telah diset ke timezone lokal Ambon)
        const nowTime = now.toTimeString().slice(0, 5);
        // Periksa setiap waktu adzan
        for (const prayer of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
          if (lastTimings && lastTimings[prayer] && !notified[prayer] && nowTime === lastTimings[prayer]) {
            const textMsg = `*Waktunya Adzan ${prayer}!*\nJadwal: ${lastTimings[prayer]}`;
            // Kirim notifikasi ke owner (atau bisa juga dikirim ke grup tertentu)
            await sock.sendMessage(require('../setting').owner, { text: textMsg });
            console.log(`Notifikasi adzan ${prayer} dikirim pada ${nowTime}.`);
            notified[prayer] = true;
          }
        }
      }, 60000); // setiap 60 detik
    } catch (error) {
      console.error("Error pada autoRun azan:", error);
    }
  }
};

/**
 * Fungsi untuk mengambil jadwal adzan untuk kota Ambon dari API Aladhan.
 */
async function fetchTimings() {
  try {
    const url = 'http://api.aladhan.com/v1/timingsByCity?city=Ambon&country=Indonesia&method=11';
    const response = await axios.get(url);
    if (response.data && response.data.data && response.data.data.timings) {
      return response.data.data.timings;
    } else {
      throw new Error("Data timings tidak ditemukan.");
    }
  } catch (error) {
    console.error("Error fetching prayer timings:", error);
    return null;
  }
}
