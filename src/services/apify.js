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
    const run = await client.actor(actorId).call({
      startUrls: [{ url }],
      resultsLimit: 1
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return createFallbackResult(url, platform, '無法取得貼文內容');
    }

    const post = items[0];

    return normalizePostData(post, url, platform);

  } catch (error) {
    console.error(`Apify 爬取失敗 (${platform}):`, error.message);
    return createFallbackResult(url, platform, error.message);
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
