const fetch = require('node-fetch');
const path = require('path');
const setting = require('../setting.js'); // Pastikan path sesuai

module.exports = {
  name: 'delplg',
  description: 'Menghapus plugin dari GitHub repo',
  usage: '<nama_plugin>',
  async execute(m, { args }) {
    if (!args[0]) return m.reply('Masukkan nama plugin!\nContoh: .delplg yt');

    const pluginName = args[0].replace(/[^a-zA-Z0-9_\-]/g, '') + '.js';
    const GITHUB_TOKEN = setting.github_token;
    const REPO_OWNER = setting.repo_owner;
    const REPO_NAME = setting.repo_name;
    const FILE_PATH = `plugins/${pluginName}`;

    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
      return m.reply('Konfigurasi GitHub belum lengkap di setting.js.');
    }

    const shaUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const shaRes = await fetch(shaUrl, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });

    if (shaRes.status !== 200) {
      return m.reply(`Plugin "${pluginName}" tidak ditemukan di GitHub.`);
    }

    const shaData = await shaRes.json();

    const deleteRes = await fetch(shaUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `delete: ${pluginName}`,
        sha: shaData.sha
      })
    });

    if (deleteRes.ok) {
      m.reply(`Plugin "${pluginName}" berhasil dihapus dari GitHub.`);
    } else {
      m.reply(`Gagal menghapus plugin: ${deleteRes.statusText}`);
    }
  }
};

