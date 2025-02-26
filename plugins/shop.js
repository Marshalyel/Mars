// plugins/shop.js

module.exports = {
  name: 'shop',
  description: 'Mengirimkan pesan produk shop dengan detail dan tombol interaktif',
  run: async (sock, message, args) => {
    const chatId = message.key.remoteJid;
    try {
      // Anda dapat mengganti URL gambar dengan URL gambar produk yang valid
      const productMessage = {
        product: {
          productImage: { url: "https://example.com/your-product-image.jpg" },
          productImageCount: 1,
          title: "Tap here to get kont**", // Judul produk di thumbnail
          description: "", // Deskripsi (kosong jika tidak diperlukan)
          priceAmount1000: 20000 * 1000, // Harga dalam satuan 1/1000 (misalnya, 20000 * 1000)
          currencyCode: "IDR", // Kode mata uang
          retailerId: "100000", 
          url: "" // URL tambahan (kosong jika tidak diperlukan)
        },
        // Gunakan m.sender untuk menetapkan bahwa produk berasal dari pengirim (atau bisa disesuaikan)
        businessOwnerJid: message.key.remoteJid,
        caption: "halloww", // Caption produk
        title: "WMBot",    // Judul produk (misalnya nama bot atau brand)
        footer: "",        // Footer (kosong jika tidak diperlukan)
        media: true,
        viewOnce: true,
        shop: "WA",
        id: "689739h2dgshG"
      };

      await sock.sendMessage(chatId, productMessage, { quoted: message });
    } catch (error) {
      console.error("Error sending shop message:", error);
      await sock.sendMessage(chatId, { text: "Gagal mengirim pesan shop." });
    }
  }
};
