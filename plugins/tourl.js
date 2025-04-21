// plugins/tourl.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');

module.exports = {
  name: 'tourl',
  description: 'Mengubah gambar yang dikirim menjadi URL menggunakan Catbox',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    console.log("Perintah !tourl dipanggil.");

    // Cek apakah pesan memiliki imageMessage
    let msgForMedia = null;
    if (message.message?.imageMessage) {
      msgForMedia = message;
      console.log("Menggunakan imageMessage dari pesan.");
    } else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
      // Jika tidak, coba gunakan imageMessage dari quoted message
      msgForMedia = { ...message, message: message.message.extendedTextMessage.contextInfo.quotedMessage };
      console.log("Menggunakan imageMessage dari pesan yang di-quote.");
    } else {
      console.log("Tidak ditemukan imageMessage dalam pesan.");
      return await sock.sendMessage(chatId, { text: "Tidak ada gambar yang ditemukan. Silakan kirim gambar dengan perintah !tourl." });
    }

    try {
      // Unduh media gambar sebagai Buffer
      const buffer = await downloadMediaMessage(msgForMedia, 'buffer', {});
      console.log("Gambar berhasil diunduh, ukuran buffer:", buffer.length);

      // Buat FormData untuk mengupload ke Catbox
      const form = new FormData();
      form.append("reqtype", "fileupload");
      // Nama file dapat disesuaikan, di sini menggunakan image.webp
      form.append("fileToUpload", buffer, { filename: "image.webp" });
      
      console.log("Mengunggah gambar ke Catbox...");
      const response = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
      });
      console.log("Respons dari Catbox:", response.data);

      // Catbox mengembalikan URL file sebagai teks
      const url = response.data.trim();
      await sock.sendMessage(chatId, { text: `Gambar berhasil diupload: ${url}` });
    } catch (error) {
      console.error("Error dalam plugin tourl:", error);
      await sock.sendMessage(chatId, { text: "Gagal mengubah gambar menjadi URL." });
    }
  }
};