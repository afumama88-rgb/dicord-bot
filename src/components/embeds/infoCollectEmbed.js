/**
 * 資訊收集成功 Embed
 */

import { EmbedBuilder } from 'discord.js';
import { getTypeDisplayName } from '../../utils/urlParser.js';

/**
 * 建立資訊收集成功 Embed
 * @param {Object} data - 收集的資料
 * @param {string} data.title - 標題
 * @param {string} data.description - 描述
 * @param {string} data.url - 原始 URL
 * @param {string} data.type - 內容類型
 * @param {string} [data.thumbnail] - 縮圖 URL
 * @param {string} [data.author] - 作者
 * @param {string} [data.notionUrl] - Notion 頁面 URL
 * @returns {EmbedBuilder}
 */
export function createInfoCollectEmbed(data) {
  const { title, description, url, type, thumbnail, author, notionUrl } = data;

  const embed = new EmbedBuilder()
    .setColor(getColorByType(type))
    .setTitle(truncate(title, 256))
    .setURL(url)
    .setDescription(truncate(description, 300) || '無描述')
    .addFields(
      { name: '📂 類型', value: getTypeDisplayName(type), inline: true }
    )
    .setTimestamp()
    .setFooter({ text: '✅ 已儲存至 Notion' });

  if (author) {
    embed.addFields({ name: '👤 作者', value: truncate(author, 100), inline: true });
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  if (notionUrl) {
    embed.addFields({ name: '📝 Notion', value: `[開啟頁面](${notionUrl})`, inline: true });
  }

  return embed;
}

/**
 * 建立資訊收集失敗 Embed
 * @param {string} url - 原始 URL
 * @param {string} errorMessage - 錯誤訊息
 * @returns {EmbedBuilder}
 */
export function createInfoCollectErrorEmbed(url, errorMessage) {
  return new EmbedBuilder()
    .setColor(0xED4245) // Discord 紅色
    .setTitle('❌ 收集失敗')
    .setDescription(`無法處理此連結`)
    .addFields(
      { name: '🔗 URL', value: truncate(url, 1024) },
      { name: '⚠️ 錯誤', value: truncate(errorMessage, 1024) }
    )
    .setTimestamp();
}

/**
 * 建立處理中 Embed
 * @param {string} url - 正在處理的 URL
 * @returns {EmbedBuilder}
 */
export function createProcessingEmbed(url) {
  return new EmbedBuilder()
    .setColor(0x5865F2) // Discord 藍色
    .setTitle('⏳ 處理中...')
    .setDescription('正在擷取內容並儲存至 Notion')
    .addFields({ name: '🔗 URL', value: truncate(url, 1024) })
    .setTimestamp();
}

/**
 * 根據類型取得顏色
 * @param {string} type - 內容類型
 * @returns {number} 顏色代碼
 */
function getColorByType(type) {
  const colors = {
    youtube: 0xFF0000,    // YouTube 紅
    facebook: 0x1877F2,   // Facebook 藍
    instagram: 0xE4405F,  // Instagram 粉紅
    threads: 0x000000,    // Threads 黑
    web: 0x57F287         // Discord 綠
  };
  return colors[type] || 0x5865F2;
}

/**
 * 截斷字串
 * @param {string} str - 原始字串
 * @param {number} maxLength - 最大長度
 * @returns {string}
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export default {
  createInfoCollectEmbed,
  createInfoCollectErrorEmbed,
  createProcessingEmbed
};
