/**
 * Message Create 事件處理
 */

import { config } from '../config/index.js';
import { handleInfoCollect, shouldHandleInfoCollect } from '../handlers/infoCollectHandler.js';
import { handleCalendar, shouldHandleCalendar } from '../handlers/calendarHandler.js';
import { extractUrls } from '../utils/urlParser.js';
import * as logger from '../utils/logger.js';

/**
 * 處理新訊息事件
 * @param {import('discord.js').Message} message - Discord 訊息
 */
export async function handleMessageCreate(message) {
  // 忽略機器人自己的訊息
  if (message.author.bot) return;

  // 檢查頻道 ID
  const channelId = message.channel.id;
  const isInfoCollectChannel = channelId === config.discord.infoCollectChannelId;
  const isCalendarChannel = channelId === config.discord.calendarChannelId;

  // 如果不在指定頻道，忽略
  if (!isInfoCollectChannel && !isCalendarChannel) {
    return;
  }

  logger.discordEvent('messageCreate', {
    channelId,
    authorId: message.author.id,
    hasAttachments: message.attachments.size > 0,
    contentLength: message.content?.length || 0
  });

  try {
    // 資訊收集頻道
    if (isInfoCollectChannel) {
      // 檢查是否有 URL
      if (shouldHandleInfoCollect(message)) {
        await handleInfoCollect(message);
        return;
      }
    }

    // 行事曆助手頻道
    if (isCalendarChannel) {
      // 優先檢查是否有 URL（如果有，可能是要收集資訊而非解析日曆）
      const urls = extractUrls(message.content);

      // 如果只有 URL 沒有其他文字，不處理為行事曆
      // 否則嘗試解析行事曆
      if (urls.length === 0 || message.content.length > urls.join('').length + 20) {
        if (shouldHandleCalendar(message)) {
          await handleCalendar(message);
          return;
        }
      }
    }

  } catch (error) {
    logger.error('訊息處理失敗', error);

    // 嘗試回覆錯誤訊息
    try {
      await message.reply({
        content: '❌ 處理訊息時發生錯誤，請稍後再試',
        allowedMentions: { repliedUser: false }
      });
    } catch {
      // 忽略回覆失敗
    }
  }
}

export default handleMessageCreate;
