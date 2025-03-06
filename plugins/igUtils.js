// plugins/igUtils.js
const { scrapePost } = require('insta-scrape');

async function fetchInstagramPost(url) {
  try {
    const post = await scrapePost(url);
    return post;
  } catch (error) {
    throw error;
  }
}

module.exports = { fetchInstagramPost };
