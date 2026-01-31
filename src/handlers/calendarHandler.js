/**
 * 行事曆助手處理器
 * 處理文字/圖片/PDF 訊息，使用 AI 提取日期資訊
 */

import {
  extractCalendarFromText,
  extractCalendarFromImage,
  extractCalendarFromPdf
} from '../services/gemini.js';
import { cacheAnalysis } from '../utils/cache.js';
import {
  createCalendarPreviewEmbed,
  createCalendarButtons,
  createCalendarErrorEmbed,
  createCalendarProcessingEmbed
} from '../components/embeds/index.js';
import * as logger from '../utils/logger.js';

/**
 * 處理行事曆訊息
 * @param {import('discord.js').Message} message - Discord 訊息
 */
export async function handleCalendar(message) {
  // 判斷內容類型
  const contentType = detectContentType(message);

  if (!contentType) {
    return; // 沒有可處理的內容
  }

  // 發送處理中訊息
  const processingMsg = await message.reply({
    embeds: [createCalendarProcessingEmbed(contentType)]
  });

  try {
    // 根據內容類型提取行事曆資訊
    const calendarData = await extractCalendarData(message, contentType);

    if (!calendarData || !calendarData.title || !calendarData.startDate) {
      throw new Error('無法從內容中提取有效的日期資訊');
    }

    // 添加來源類型
    calendarData.source = contentType;

    // 快取解析結果，供按鈕互動使用
    cacheAnalysis(processingMsg.id, {
      ...calendarData,
      originalMessageId: message.id,
      channelId: message.channel.id
    });

    // 更新為預覽訊息，附帶按鈕
    await processingMsg.edit({
      embeds: [createCalendarPreviewEmbed(calendarData)],
      components: [createCalendarButtons(processingMsg.id)]
    });

    logger.info('行事曆解析成功', {
      title: calendarData.title,
      startDate: calendarData.startDate,
      contentType
    });

  } catch (error) {
    logger.error('行事曆解析失敗', { error: error.message, contentType });

    // 更新為錯誤訊息
    await processingMsg.edit({
      embeds: [createCalendarErrorEmbed(error.message)],
      components: []
    });
  }
}

/**
 * 偵測訊息內容類型
 * @param {import('discord.js').Message} message - Discord 訊息
 * @returns {'text'|'image'|'pdf'|null} 內容類型
 */
function detectContentType(message) {
  // 檢查附件
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    const contentType = attachment.contentType || '';
    const filename = attachment.name?.toLowerCase() || '';

    // PDF 檢查
    if (contentType === 'application/pdf' || filename.endsWith('.pdf')) {
      return 'pdf';
    }

    // 圖片檢查
    if (contentType.startsWith('image/') ||
        /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
      return 'image';
    }
  }

  // 純文字訊息（需要有足夠長度）
  if (message.content && message.content.length >= 10) {
    return 'text';
  }

  return null;
}

/**
 * 根據內容類型提取行事曆資料
 * @param {import('discord.js').Message} message - Discord 訊息
 * @param {'text'|'image'|'pdf'} contentType - 內容類型
 * @returns {Promise<Object|null>} 行事曆資料
 */
async function extractCalendarData(message, contentType) {
  switch (contentType) {
    case 'text':
      return await extractCalendarFromText(message.content);

    case 'image': {
      const attachment = message.attachments.first();
      const imageBuffer = await downloadAttachment(attachment.url);
      const mimeType = attachment.contentType || 'image/png';
      return await extractCalendarFromImage(imageBuffer, mimeType);
    }

    case 'pdf': {
      const attachment = message.attachments.first();
      const pdfBuffer = await downloadAttachment(attachment.url);
      return await extractCalendarFromPdf(pdfBuffer);
    }

    default:
      return null;
  }
}

/**
 * 下載附件
 * @param {string} url - 附件 URL
 * @returns {Promise<Buffer>} 檔案內容
 */
async function downloadAttachment(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下載附件失敗: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * 檢查訊息是否應該由行事曆助手處理
 * @param {import('discord.js').Message} message - Discord 訊息
 * @returns {boolean}
 */
export function shouldHandleCalendar(message) {
  return detectContentType(message) !== null;
}

export default {
  handleCalendar,
  shouldHandleCalendar
};
