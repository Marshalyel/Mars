// plugins/tourl.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');

module.exports = {
  name: 'tourl',
  description: 'Mengubah gambar yang dikirim menjadi URL menggunakan Catbox',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    console.log("Command 'tourl' dipanggil.");

    // Cek apakah pesan memiliki imageMessage atau merupakan quoted image message
    let imageMessage = message.message?.imageMessage;
    if (!imageMessage && message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
      imageMessage = message.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
      console.log("Menggunakan imageMessage dari quoted message.");
    }

    if (!imageMessage) {
      console.log("Tidak ditemukan imageMessage dalam pesan.");
      return await sock.sendMessage(chatId, { text: 'Silakan kirim gambar dengan perintah !tourl' });
    }

    try {
      // Unduh media gambar sebagai Buffer
      const buffer = await downloadMediaMessage(message, 'buffer', {});
      console.log("Gambar berhasil diunduh, ukuran buffer:", buffer.length);

      // Siapkan FormData untuk upload ke Catbox
      const form = new FormData();
      form.append("reqtype", "fileupload");
      // Kita gunakan nama file "image.webp" (Catbox mendukung format WebP dan lainnya)
      form.append("fileToUpload", buffer, { filename: "image.webp" });
      
      console.log("Mengunggah gambar ke Catbox...");
      const response = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
      });
      console.log("Respons dari Catbox:", response.data);

      // Catbox mengembalikan URL dalam bentuk teks
      const url = response.data.trim();
      await sock.sendMessage(chatId, { text: `Gambar berhasil diupload: ${url}` });
    } catch (error) {
      console.error("Error dalam plugin tourl:", error);
      await sock.sendMessage(chatId, { text: "Gagal mengubah gambar menjadi URL." });
    }
  }
};
