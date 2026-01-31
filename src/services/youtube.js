/**
 * YouTube 處理服務
 * 使用 oEmbed API（免費、無需 API Key）
 */

/**
 * 從 YouTube URL 提取影片 ID
 * @param {string} url - YouTube URL
 * @returns {string|null} 影片 ID
 */
export function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * 使用 oEmbed 取得 YouTube 影片資訊
 * @param {string} url - YouTube URL
 * @returns {Promise<Object>} 影片資訊
 */
export async function getYouTubeInfo(url) {
  const videoId = extractVideoId(url);

  if (!videoId) {
    throw new Error('無效的 YouTube URL');
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

  try {
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      throw new Error(`oEmbed 請求失敗: ${response.status}`);
    }

    const data = await response.json();

    return {
      title: data.title,
      author: data.author_name,
      authorUrl: data.author_url,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      thumbnailFallback: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      url: url,
      videoId: videoId,
      type: 'YT'
    };
  } catch (error) {
    console.warn('YouTube oEmbed 請求失敗:', error.message);

    // 降級處理：返回基本資訊
    return {
      title: '無法取得標題',
      author: '未知',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      url: url,
      videoId: videoId,
      type: 'YT'
    };
  }
}

/**
 * 檢查是否為 YouTube URL
 * @param {string} url - URL
 * @returns {boolean}
 */
export function isYouTubeUrl(url) {
  return extractVideoId(url) !== null;
}

export default {
  extractVideoId,
  getYouTubeInfo,
  isYouTubeUrl
};
