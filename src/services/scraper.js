/**
 * 一般網頁爬蟲服務
 */

import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

/**
 * 爬取網頁內容
 * @param {string} url - 網頁 URL
 * @returns {Promise<Object>} 網頁資訊
 */
export async function scrapeWebPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // 使用 Cheerio 提取 Open Graph 和 meta 標籤
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');

  const metaTitle = $('meta[name="title"]').attr('content');
  const metaDescription = $('meta[name="description"]').attr('content');
  const metaAuthor = $('meta[name="author"]').attr('content');

  const pageTitle = $('title').text().trim();

  // 使用 Readability 提取主要內容
  let article = null;
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    article = reader.parse();
  } catch (error) {
    console.warn('Readability 解析失敗:', error.message);
  }

  // 確保 thumbnail URL 是絕對路徑
  let thumbnail = ogImage;
  if (thumbnail && !thumbnail.startsWith('http')) {
    try {
      const baseUrl = new URL(url);
      thumbnail = new URL(thumbnail, baseUrl.origin).href;
    } catch {
      thumbnail = null;
    }
  }

  return {
    title: ogTitle || metaTitle || article?.title || pageTitle || '未知標題',
    description: ogDescription || metaDescription || article?.excerpt || '',
    content: article?.textContent?.slice(0, 5000) || null,
    thumbnail: thumbnail,
    author: article?.byline || metaAuthor || null,
    url: url,
    type: '網路文章',
    siteName: ogSiteName || extractDomain(url)
  };
}

/**
 * 從 URL 提取網域名稱
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

export default {
  scrapeWebPage
};
