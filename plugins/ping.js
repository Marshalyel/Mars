// plugins/ping.js

module.exports = {
  name: 'ping',
  description: 'Membalas dengan pong ketika perintah ping diterima',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    // Kirim balasan "pong" ke chat yang bersangkutan
    await sock.sendMessage(chatId, { text: 'pong' });
  }
};
