// plugins/tourl.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');

module.exports = {
  name: 'tourl',
  description: 'Mengubah gambar yang dikirim menjadi URL menggunakan Catbox',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;

    // Pastikan pesan berisi imageMessage
    const imageMessage = message.message.imageMessage;
    if (!imageMessage) {
      return await sock.sendMessage(chatId, { text: 'Silakan kirim gambar dengan perintah !tourl' });
    }

    try {
      // Unduh media gambar sebagai Buffer
      const buffer = await downloadMediaMessage(message, 'buffer', {});
      
      // Buat FormData untuk upload ke Catbox
      const form = new FormData();
      form.append("reqtype", "fileupload");
      // Gunakan nama file yang umum, misalnya "image.webp" (Catbox mendukung berbagai format)
      form.append("fileToUpload", buffer, { filename: "image.webp" });
      
      // Upload ke Catbox API
      const response = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
      });
      
      // Catbox mengembalikan URL file dalam respons plain text
      const url = response.data.trim();
      await sock.sendMessage(chatId, { text: `Gambar berhasil diupload: ${url}` });
    } catch (error) {
      console.error("Error in tourl plugin:", error);
      await sock.sendMessage(chatId, { text: "Gagal mengubah gambar menjadi URL." });
    }
  }
};
