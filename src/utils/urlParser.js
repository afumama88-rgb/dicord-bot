/**
 * URL 解析工具
 */

const URL_PATTERNS = {
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
  ],
  facebook: [
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\/]+\/(?:posts|videos|photos)\/[^\s]+/,
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:watch|reel|share)\/[^\s]+/,
    /(?:https?:\/\/)?(?:www\.)?fb\.watch\/[^\s]+/,
    /(?:https?:\/\/)?(?:www\.)?fb\.com\/[^\s]+/,
    /(?:https?:\/\/)?(?:m\.)?facebook\.com\/story\.php[^\s]+/
  ],
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/tv\/([a-zA-Z0-9_-]+)/
  ],
  threads: [
    /(?:https?:\/\/)?(?:www\.)?threads\.net\/@?[\w.]+\/post\/([a-zA-Z0-9_-]+)/
  ]
};

/**
 * 解析 URL 類型
 * @param {string} url - 要解析的 URL
 * @returns {{ type: string, url: string, match: RegExpMatchArray | null } | null}
 */
export function parseUrl(url) {
  if (!url) return null;

  // 清理 URL（移除前後空白）
  url = url.trim();

  for (const [type, patterns] of Object.entries(URL_PATTERNS)) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { type, url, match };
      }
    }
  }

  // 如果是有效的 HTTP(S) URL 但不符合上述模式，視為一般網頁
  if (/^https?:\/\/.+/i.test(url)) {
    return { type: 'web', url, match: null };
  }

  return null;
}

/**
 * 從文字中提取所有 URL
 * @param {string} text - 要解析的文字
 * @returns {string[]} URL 陣列
 */
export function extractUrls(text) {
  if (!text) return [];

  // 匹配 URL 的正則表達式
  const urlRegex = /https?:\/\/[^\s<>\"{}|\\^`\[\]]+/gi;

  const matches = text.match(urlRegex) || [];

  // 清理 URL（移除尾端的標點符號）
  return matches.map(url => {
    // 移除常見的尾端標點
    return url.replace(/[.,;:!?'")\]]+$/, '');
  });
}

/**
 * 檢查 URL 是否為支援的社群媒體
 * @param {string} url - URL
 * @returns {boolean}
 */
export function isSocialMediaUrl(url) {
  const parsed = parseUrl(url);
  return parsed && ['youtube', 'facebook', 'instagram', 'threads'].includes(parsed.type);
}

/**
 * 取得 URL 類型的顯示名稱
 * @param {string} type - URL 類型
 * @returns {string}
 */
export function getTypeDisplayName(type) {
  const names = {
    youtube: 'YouTube',
    facebook: 'Facebook',
    instagram: 'Instagram',
    threads: 'Threads',
    web: '網路文章'
  };
  return names[type] || type;
}

/**
 * 取得 URL 類型對應的 Notion type 值
 * @param {string} type - URL 類型
 * @returns {string}
 */
export function getNotionType(type) {
  const typeMap = {
    youtube: 'YT',
    facebook: 'FB',
    instagram: 'IG',
    threads: 'TH',
    web: '網路文章'
  };
  return typeMap[type] || '網路文章';
}

export default {
  parseUrl,
  extractUrls,
  isSocialMediaUrl,
  getTypeDisplayName,
  getNotionType,
  URL_PATTERNS
};
