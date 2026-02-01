/**
 * Apify 社群媒體爬蟲服務
 */

import { ApifyClient } from 'apify-client';
import { config } from '../config/index.js';

// Apify 客戶端（延遲初始化）
let apifyClient = null;

/**
 * 取得 Apify 客戶端
 */
function getClient() {
  if (!config.apify.apiKey) {
    return null;
  }

  if (!apifyClient) {
    apifyClient = new ApifyClient({
      token: config.apify.apiKey
    });
  }

  return apifyClient;
}

/**
 * 檢查 Apify 是否可用
 */
export function isApifyAvailable() {
  return !!config.apify.apiKey;
}

/**
 * 爬取社群媒體貼文
 * @param {string} url - 貼文 URL
 * @param {'facebook' | 'instagram' | 'threads'} platform - 平台類型
 * @returns {Promise<Object>} 貼文資訊
 */
export async function scrapeSocialMedia(url, platform) {
  const client = getClient();

  if (!client) {
    // Apify 未設定，返回降級結果
    return createFallbackResult(url, platform);
  }

  const actorId = config.apify.actors[platform];

  if (!actorId) {
    throw new Error(`不支援的平台: ${platform}`);
  }

  try {
    // 不同 Actor 需要不同的輸入格式
    let runInput;
    if (platform === 'threads') {
      // sinam7/threads-post-scraper 使用 url 欄位
      runInput = { url };
    } else {
      // Facebook/Instagram 使用 startUrls
      runInput = {
        startUrls: [{ url }],
        resultsLimit: 1
      };
    }

    const run = await client.actor(actorId).call(runInput);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return createFallbackResult(url, platform, '無法取得貼文內容');
    }

    const post = items[0];

    return normalizePostData(post, url, platform);

  } catch (error) {
    console.error(`Apify 爬取失敗 (${platform}):`, error.message);

    // 嘗試 Fallback：從 meta 標籤提取
    const fallbackData = await scrapeMetaFallback(url, platform);
    if (fallbackData) {
      return fallbackData;
    }

    return createFallbackResult(url, platform, error.message);
  }
}

/**
 * Fallback: 使用 fetch 從 meta 標籤提取資訊
 * 當 Apify 失敗時使用
 */
async function scrapeMetaFallback(url, platform) {
  try {
    console.log(`[Fallback] 嘗試從 meta 標籤提取: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      console.log(`[Fallback] HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    // 提取 meta 標籤
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ||
                   html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/) ||
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/);

    const title = ogTitle?.[1] || '';
    const description = ogDesc?.[1] || '';
    const thumbnail = ogImage?.[1] || null;

    // 如果沒有內容，fallback 失敗
    if (!title && !description) {
      console.log(`[Fallback] 無法從 meta 標籤提取內容`);
      return null;
    }

    // 提取作者
    let author = '未知';

    if (platform === 'threads') {
      // Threads: 從 URL 或 title 提取
      const thMatch = url.match(/threads\.(com|net)\/@([^/]+)/);
      if (thMatch) {
        author = thMatch[2];
      } else if (title.includes(' on Threads')) {
        author = title.split(' on Threads')[0];
      }
    } else if (platform === 'instagram') {
      // Instagram: 從 URL 提取
      const igMatch = url.match(/instagram\.com\/([^/]+)/);
      if (igMatch && !['p', 'reels', 'reel', 'stories', 'tv'].includes(igMatch[1])) {
        author = igMatch[1];
      }
    } else if (platform === 'facebook') {
      // Facebook: 從 title 提取（通常格式是 "Author Name - Post"）
      if (title && !title.includes('Facebook')) {
        const dashIndex = title.indexOf(' - ');
        if (dashIndex > 0) {
          author = title.substring(0, dashIndex);
        }
      }
    }

    const typeMap = { facebook: 'FB', instagram: 'IG', threads: 'TH' };

    console.log(`[Fallback] 成功提取: author=${author}, content長度=${description.length}`);

    return {
      title: (description || title).slice(0, 100) || `${platform} 貼文`,
      description: description || title,
      thumbnail: thumbnail,
      author: author,
      url: url,
      type: typeMap[platform] || platform.toUpperCase(),
      success: true,
      fromFallback: true
    };

  } catch (error) {
    console.error(`[Fallback] 失敗:`, error.message);
    return null;
  }
}

/**
 * 標準化貼文資料（不同平台返回的欄位名稱不同）
 * 對照 Line Bot 的欄位提取邏輯
 */
function normalizePostData(post, url, platform) {
  // 記錄原始資料以便除錯
  console.log(`[Apify] ${platform} 原始欄位:`, Object.keys(post));

  let author = '未知';
  let text = '';
  let thumbnail = null;

  // 根據不同平台提取欄位（對照 Line Bot 邏輯）
  if (platform === 'facebook') {
    // Facebook 作者欄位優先級
    author = post.pageName || post.userName || post.name || post.user || post.groupTitle || '未知';
    // Facebook 內容欄位優先級
    text = post.text || post.message || post.postText || post.description ||
           post.story || post.content || post.seo_title || '';
    thumbnail = post.imageUrl || post.thumbnailUrl || post.image || post.photoUrl || null;

  } else if (platform === 'instagram') {
    // Instagram 支援嵌套 owner 物件
    const ownerInfo = (typeof post.owner === 'object' && post.owner) ? post.owner : {};
    author = post.ownerUsername || post.username || ownerInfo.username ||
             post.ownerFullName || ownerInfo.fullName || '';
    // 如果還是沒有，嘗試從 URL 提取
    if (!author) {
      const igMatch = url.match(/instagram\.com\/([^/]+)/);
      if (igMatch && !['p', 'reels', 'reel', 'stories', 'tv'].includes(igMatch[1])) {
        author = igMatch[1];
      }
    }
    if (!author) author = '未知';
    // Instagram 內容
    text = post.caption || post.text || post.description || '';
    thumbnail = post.displayUrl || post.thumbnailUrl || post.imageUrl || null;

  } else if (platform === 'threads') {
    // Threads 優先從 URL 提取用戶名
    const thMatch = url.match(/threads\.(com|net)\/@([^/]+)/);
    if (thMatch) {
      author = thMatch[2];
    } else {
      author = post.ownerUsername || post.username || post.author || post.user || '未知';
    }
    // Threads 內容
    text = post.text || post.caption || post.content || post.postText || '';
    thumbnail = post.imageUrl || post.thumbnailUrl || post.displayUrl || null;
  }

  // 通用欄位
  const likes = post.likesCount || post.likeCount || post.likes || post.reactions || 0;
  const comments = post.commentsCount || post.commentCount || post.comments || 0;
  const timestamp = post.timestamp || post.takenAt || post.createdAt || post.time || null;

  // 平台類型映射
  const typeMap = {
    facebook: 'FB',
    instagram: 'IG',
    threads: 'TH'
  };

  return {
    title: text.slice(0, 100) || `${platform} 貼文`,
    description: text,
    thumbnail: thumbnail,
    author: author,
    url: url,
    type: typeMap[platform] || platform.toUpperCase(),
    likes: likes,
    comments: comments,
    timestamp: timestamp,
    success: true
  };
}

/**
 * 建立降級結果（無法爬取時使用）
 */
function createFallbackResult(url, platform, errorMessage = null) {
  const typeMap = {
    facebook: 'FB',
    instagram: 'IG',
    threads: 'TH'
  };

  const platformNames = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    threads: 'Threads'
  };

  return {
    title: `${platformNames[platform] || platform} 貼文`,
    description: errorMessage ? `無法擷取內容: ${errorMessage}` : '無法擷取內容',
    thumbnail: null,
    author: '未知',
    url: url,
    type: typeMap[platform] || platform.toUpperCase(),
    success: false,
    error: errorMessage
  };
}

export default {
  isApifyAvailable,
  scrapeSocialMedia
};
