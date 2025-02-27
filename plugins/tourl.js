// plugins/tourl.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');

module.exports = {
  name: 'tourl',
  description: 'Mengubah gambar yang dikirim menjadi URL menggunakan Catbox',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    console.log("Perintah !tourl dipanggil");

    // Cari imageMessage di pesan atau di pesan yang di-quote
    let imageMsg = message.message?.imageMessage;
    if (!imageMsg && message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
      imageMsg = message.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
      console.log("Menggunakan imageMessage dari pesan yang di-quote.");
    }
    if (!imageMsg) {
      console.log("Tidak ditemukan imageMessage dalam pesan.");
      return await sock.sendMessage(chatId, { text: 'Silakan kirim gambar dengan perintah !tourl' });
    }

    try {
      // Buat objek media khusus yang hanya berisi imageMessage untuk di-download
      const media = { imageMessage: imageMsg };
      const buffer = await downloadMediaMessage(media, 'buffer', {});
      console.log("Gambar berhasil diunduh, ukuran buffer:", buffer.length);

      // Buat FormData untuk mengupload ke Catbox
      const form = new FormData();
      form.append("reqtype", "fileupload");
      form.append("fileToUpload", buffer, { filename: "image.webp" });
      
      console.log("Mengunggah gambar ke Catbox...");
      const response = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
      });
      console.log("Respons dari Catbox:", response.data);

      const url = response.data.trim();
      await sock.sendMessage(chatId, { text: `Gambar berhasil diupload: ${url}` });
    } catch (error) {
      console.error("Error dalam plugin tourl:", error);
      await sock.sendMessage(chatId, { text: "Gagal mengubah gambar menjadi URL." });
    }
  }
};
