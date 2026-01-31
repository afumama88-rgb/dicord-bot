/**
 * 成功確認 Embed
 */

import { EmbedBuilder } from 'discord.js';

/**
 * 建立 Google Calendar 事件建立成功 Embed
 * @param {Object} data - 事件資料
 * @param {string} data.title - 事件標題
 * @param {string} data.calendarLink - Google Calendar 連結
 * @param {string} [data.notionUrl] - Notion 頁面 URL
 * @returns {EmbedBuilder}
 */
export function createCalendarEventSuccessEmbed(data) {
  const { title, calendarLink, notionUrl } = data;

  const embed = new EmbedBuilder()
    .setColor(0x57F287) // Discord 綠
    .setTitle('✅ 已建立 Google 日曆事件')
    .addFields({ name: '📌 標題', value: title });

  if (calendarLink) {
    embed.addFields({ name: '📅 日曆', value: `[在 Google 日曆中查看](${calendarLink})` });
  }

  if (notionUrl) {
    embed.addFields({ name: '📝 Notion', value: `[開啟頁面](${notionUrl})` });
  }

  embed.setTimestamp();

  return embed;
}

/**
 * 建立 Google Tasks 任務建立成功 Embed
 * @param {Object} data - 任務資料
 * @param {string} data.title - 任務標題
 * @param {string} [data.notionUrl] - Notion 頁面 URL
 * @returns {EmbedBuilder}
 */
export function createTaskSuccessEmbed(data) {
  const { title, notionUrl } = data;

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ 已建立 Google 任務')
    .addFields({ name: '📌 標題', value: title });

  if (notionUrl) {
    embed.addFields({ name: '📝 Notion', value: `[開啟頁面](${notionUrl})` });
  }

  embed.setTimestamp();

  return embed;
}

/**
 * 建立僅存 Notion 成功 Embed
 * @param {Object} data - 資料
 * @param {string} data.title - 標題
 * @param {string} data.notionUrl - Notion 頁面 URL
 * @returns {EmbedBuilder}
 */
export function createNotionOnlySuccessEmbed(data) {
  const { title, notionUrl } = data;

  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ 已儲存至 Notion')
    .addFields(
      { name: '📌 標題', value: title },
      { name: '📝 Notion', value: `[開啟頁面](${notionUrl})` }
    )
    .setTimestamp();
}

/**
 * 建立取消操作 Embed
 * @returns {EmbedBuilder}
 */
export function createCancelledEmbed() {
  return new EmbedBuilder()
    .setColor(0x99AAB5) // Discord 灰
    .setTitle('🚫 操作已取消')
    .setDescription('此行事曆事件未被儲存')
    .setTimestamp();
}

/**
 * 建立一般錯誤 Embed
 * @param {string} title - 錯誤標題
 * @param {string} message - 錯誤訊息
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed(title, message) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle(`❌ ${title}`)
    .setDescription(message)
    .setTimestamp();
}

/**
 * 建立權限錯誤 Embed（當 Google 服務未設定時）
 * @param {string} service - 服務名稱
 * @returns {EmbedBuilder}
 */
export function createServiceUnavailableEmbed(service) {
  return new EmbedBuilder()
    .setColor(0xFEE75C) // Discord 黃
    .setTitle(`⚠️ ${service} 服務未設定`)
    .setDescription('此功能需要額外設定，請聯繫管理員')
    .setTimestamp();
}

export default {
  createCalendarEventSuccessEmbed,
  createTaskSuccessEmbed,
  createNotionOnlySuccessEmbed,
  createCancelledEmbed,
  createErrorEmbed,
  createServiceUnavailableEmbed
};
