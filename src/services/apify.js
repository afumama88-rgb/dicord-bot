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
 */
function normalizePostData(post, url, platform) {
  // 根據不同平台提取欄位
  const text = post.text || post.caption || post.content || '';
  const author = post.authorName || post.ownerUsername || post.username || post.author || '未知';
  const thumbnail = post.imageUrl || post.thumbnailUrl || post.displayUrl || post.image || null;
  const likes = post.likesCount || post.likeCount || post.likes || 0;
  const comments = post.commentsCount || post.commentCount || post.comments || 0;
  const timestamp = post.timestamp || post.takenAt || post.createdAt || null;

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
