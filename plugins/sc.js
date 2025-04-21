// plugins/sc.js

const os = require('os');

module.exports = {
  name: 'sc',
  description: 'Menampilkan klasifikasi script, kecepatan respon, dan spesifikasi sistem',
  run: async (sock, message, args) => {
    // Pastikan pesan valid
    if (!message || !message.key || !message.key.remoteJid) return;
    const chatId = message.key.remoteJid;
    
    // Mulai pengukuran waktu eksekusi
    const start = process.hrtime();

    // Klasifikasi script (statis)
    const classification = "Bot WhatsApp Script (Built with Baileys)";

    // Spesifikasi sistem
    const nodeVersion = process.version;
    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();
    const cpus = os.cpus();
    const cpuModel = cpus[0].model;
    const cpuSpeed = cpus[0].speed; // dalam MHz
    const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2); // MB
    const freeMem = (os.freemem() / 1024 / 1024).toFixed(2); // MB
    const uptime = os.uptime();// dalam detik
    const uptimej = (os.uptime() / 3600).toFixed(0);
      const uptimem = (((os.uptime() / 3600).toFixed(2) - (os.uptime() / 3600).toFixed(0))*60).toFixed(0);
      const uptimem2 = (((os.uptime() / 3600).toFixed(2) - (os.uptime() / 3600).toFixed(0))*60).toFixed(2);
      const uptimed = ((uptimem2 - uptimem)*3600).toFixed(2)

    // Hitung waktu eksekusi (response speed)
    const end = process.hrtime(start);
    const responseTime = (end[0] * 1000 + end[1] / 1e6).toFixed(2); // dalam ms

    // Susun pesan informasi
    const textMsg = `*Script Classification:* ${classification}\n` +
                    `*Response Speed:* ${responseTime} ms\n` +
                    `*Node Version:* ${nodeVersion}\n` +
                    `*Platform:* ${platform} ${release} (${arch})\n` +
                    `*CPU:* ${cpuModel} @ ${cpuSpeed} MHz\n` +
                    `*Memory:* ${freeMem} MB free / ${totalMem} MB total\n` +
                    `*Uptime:* ${uptime} seconds /
${uptimej} jam;${uptimem} menit;${uptimed} detik`;

    await sock.sendMessage(chatId, { text: textMsg });
  }
};
