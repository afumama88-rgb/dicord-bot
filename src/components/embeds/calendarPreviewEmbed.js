/**
 * 行事曆預覽 Embed
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * 建立行事曆預覽 Embed
 * @param {Object} data - 解析的行事曆資料
 * @param {string} data.title - 事件標題
 * @param {string} [data.description] - 事件描述
 * @param {string} data.startDate - 開始日期 (ISO 格式)
 * @param {string} [data.endDate] - 結束日期 (ISO 格式)
 * @param {string} [data.startTime] - 開始時間 (HH:mm)
 * @param {string} [data.endTime] - 結束時間 (HH:mm)
 * @param {boolean} [data.isAllDay] - 是否為全天事件
 * @param {string} [data.location] - 地點
 * @param {string} [data.source] - 來源類型 (text/image/pdf)
 * @returns {EmbedBuilder}
 */
export function createCalendarPreviewEmbed(data) {
  const {
    title,
    description,
    startDate,
    endDate,
    startTime,
    endTime,
    isAllDay,
    location,
    source
  } = data;

  const embed = new EmbedBuilder()
    .setColor(0x4285F4) // Google 藍
    .setTitle('📅 行事曆事件預覽')
    .addFields({ name: '📌 標題', value: truncate(title, 256) });

  // 日期時間
  const dateTimeStr = formatDateTime(startDate, endDate, startTime, endTime, isAllDay);
  embed.addFields({ name: '🕐 時間', value: dateTimeStr });

  // 描述
  if (description) {
    embed.addFields({ name: '📝 描述', value: truncate(description, 500) });
  }

  // 地點
  if (location) {
    embed.addFields({ name: '📍 地點', value: truncate(location, 256) });
  }

  // 來源類型
  const sourceIcon = { text: '💬', image: '🖼️', pdf: '📄' }[source] || '📋';
  embed.setFooter({ text: `${sourceIcon} 來源：${source || '文字'}` });

  embed.setTimestamp();

  return embed;
}

/**
 * 建立行事曆預覽的按鈕列
 * @param {string} messageId - 訊息 ID（用於按鈕互動識別）
 * @returns {ActionRowBuilder}
 */
export function createCalendarButtons(messageId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`calendar_event:${messageId}`)
      .setLabel('📅 Google 日曆')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`calendar_task:${messageId}`)
      .setLabel('✅ Google 任務')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`calendar_notion:${messageId}`)
      .setLabel('📝 僅存 Notion')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`calendar_cancel:${messageId}`)
      .setLabel('取消')
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * 建立行事曆解析失敗 Embed
 * @param {string} errorMessage - 錯誤訊息
 * @returns {EmbedBuilder}
 */
export function createCalendarErrorEmbed(errorMessage) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('❌ 無法解析行事曆資訊')
    .setDescription('AI 無法從此內容中提取日期/時間資訊')
    .addFields({ name: '⚠️ 詳情', value: truncate(errorMessage, 1024) })
    .setTimestamp();
}

/**
 * 建立行事曆處理中 Embed
 * @param {string} sourceType - 來源類型 (text/image/pdf)
 * @returns {EmbedBuilder}
 */
export function createCalendarProcessingEmbed(sourceType) {
  const sourceText = {
    text: '文字訊息',
    image: '圖片',
    pdf: 'PDF 文件'
  }[sourceType] || '內容';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 AI 分析中...')
    .setDescription(`正在從${sourceText}中提取行事曆資訊`)
    .setTimestamp();
}

/**
 * 格式化日期時間顯示
 */
function formatDateTime(startDate, endDate, startTime, endTime, isAllDay) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  let result = formatDate(startDate);

  if (isAllDay) {
    result += ' (全天)';
    if (endDate && endDate !== startDate) {
      result += ` ~ ${formatDate(endDate)}`;
    }
  } else {
    if (startTime) {
      result += ` ${startTime}`;
    }
    if (endTime && endTime !== startTime) {
      result += ` - ${endTime}`;
    }
    if (endDate && endDate !== startDate) {
      result += `\n~ ${formatDate(endDate)}`;
      if (endTime) {
        result += ` ${endTime}`;
      }
    }
  }

  return result;
}

/**
 * 截斷字串
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export default {
  createCalendarPreviewEmbed,
  createCalendarButtons,
  createCalendarErrorEmbed,
  createCalendarProcessingEmbed
};
