/**
 * 快取工具
 * 使用 node-cache 實作記憶體快取
 */

import NodeCache from 'node-cache';
import { config } from '../config/index.js';

// 建立快取實例
const cache = new NodeCache({
  stdTTL: config.cache.ttl,           // 預設 TTL 1 小時
  checkperiod: config.cache.checkPeriod, // 檢查週期 10 分鐘
  useClones: false                     // 不複製物件（效能優化）
});

/**
 * 儲存解析結果（用於行事曆助手的按鈕互動）
 * @param {string} messageId - Discord 訊息 ID
 * @param {Object} data - 解析結果
 */
export function cacheAnalysis(messageId, data) {
  const key = `analysis:${messageId}`;
  cache.set(key, data);
}

/**
 * 取得解析結果
 * @param {string} messageId - Discord 訊息 ID
 * @returns {Object|undefined} 解析結果
 */
export function cacheGet(messageId) {
  const key = `analysis:${messageId}`;
  return cache.get(key);
}

/**
 * 刪除快取
 * @param {string} messageId - Discord 訊息 ID
 */
export function cacheDelete(messageId) {
  const key = `analysis:${messageId}`;
  cache.del(key);
}

/**
 * 儲存 Notion 頁面 ID 對應（用於反應互動）
 * @param {string} discordMessageId - Discord 訊息 ID
 * @param {string} notionPageId - Notion 頁面 ID
 */
export function cacheNotionMapping(discordMessageId, notionPageId) {
  const key = `notion:${discordMessageId}`;
  cache.set(key, notionPageId, 86400); // 24 小時 TTL
}

/**
 * 取得 Notion 頁面 ID
 * @param {string} discordMessageId - Discord 訊息 ID
 * @returns {string|undefined} Notion 頁面 ID
 */
export function getNotionPageId(discordMessageId) {
  const key = `notion:${discordMessageId}`;
  return cache.get(key);
}

/**
 * 取得快取統計資訊
 * @returns {Object} 統計資訊
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * 清除所有快取
 */
export function clearCache() {
  cache.flushAll();
}

export default {
  cacheAnalysis,
  cacheGet,
  cacheDelete,
  cacheNotionMapping,
  getNotionPageId,
  getCacheStats,
  clearCache
};
