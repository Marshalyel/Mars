const yts = require('yt-search');

async function handleYouTubePagination(sock, m, args) {
    const chatId = m.key.remoteJid;
    if (args.length < 2) {
        return await sock.sendMessage(chatId, { text: 'Format salah! Gunakan tombol navigasi.' });
    }

    let page = parseInt(args[0]);
    let query = args.slice(1).join(' ');
    const resultsPerPage = 5;

    try {
        const searchResult = await yts(query);
        if (!searchResult.videos || searchResult.videos.length === 0) {
            return await sock.sendMessage(chatId, { text: 'Video tidak ditemukan!' });
        }

        let totalVideos = searchResult.videos.length;
        let totalPages = Math.ceil(totalVideos / resultsPerPage);
        if (page < 1 || page > totalPages) return;

        let startIndex = (page - 1) * resultsPerPage;
        let endIndex = startIndex + resultsPerPage;
        let videos = searchResult.videos.slice(startIndex, endIndex);

        let messageText = `🔎 Hasil pencarian untuk *${query}* (Halaman ${page}/${totalPages}):\n\n`;
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            messageText += `📌 *${i + 1}. ${video.title}*\n`;
            messageText += `📺 Channel: ${video.author.name || "Unknown"}\n`;
            messageText += `⏳ Durasi: ${video.timestamp}\n`;
            messageText += `👁 Views: ${video.views}\n`;
            messageText += `🔗 Link: ${video.url}\n\n`;
        }

        let buttons = [
            {
                buttonId: `.ytmp3 ${videos[0].url}`,
                buttonText: { displayText: '🎵 Download MP3' },
                type: 1
            },
            {
                buttonId: `.ytmp4 ${videos[0].url}`,
                buttonText: { displayText: '🎥 Download MP4' },
                type: 1
            }
        ];

        if (page > 1) {
            buttons.push({
                buttonId: `.ytback ${page - 1} ${query}`,
                buttonText: { displayText: '⬅ Back' },
                type: 1
            });
        }

        if (endIndex < totalVideos) {
            buttons.push({
                buttonId: `.ytnext ${page + 1} ${query}`,
                buttonText: { displayText: 'Next ➡' },
                type: 1
            });
        }

        await sock.sendMessage(chatId, {
            text: messageText,
            footer: 'Gunakan tombol di bawah untuk download atau navigasi:',
            buttons: buttons,
            headerType: 1,
            viewOnce: true
        }, { quoted: m });

    } catch (error) {
        console.error("Error dalam navigasi YouTube:", error);
        await sock.sendMessage(chatId, { text: 'Gagal memproses navigasi pencarian YouTube.' }, { quoted: m });
    }
}

// Tambahkan ke case handler
module.exports = async (sock, m, args, command) => {
    if (command === 'ytnext' || command === 'ytback') {
        return await handleYouTubePagination(sock, m, args);
    }
};
