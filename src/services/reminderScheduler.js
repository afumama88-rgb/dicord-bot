/**
 * 提醒排程器
 * 每分鐘檢查 Notion 中需要發送的提醒
 */

import cron from 'node-cron';
import { Client } from '@notionhq/client';
import { EmbedBuilder } from 'discord.js';
import { config } from '../config/index.js';
import { markReminderSent } from './notion.js';
import * as logger from '../utils/logger.js';

const notion = new Client({
  auth: config.notion.apiKey
});

const CALENDAR_DATABASE_ID = config.notion.databaseIds.calendar;

let discordClient = null;

/**
 * 初始化提醒排程器
 * @param {import('discord.js').Client} client - Discord Client
 */
export function initReminderScheduler(client) {
  discordClient = client;

  if (!config.discord.notifyChannelId) {
    logger.warn('DISCORD_NOTIFY_CHANNEL_ID 未設定，提醒功能停用');
    return;
  }

  if (!CALENDAR_DATABASE_ID) {
    logger.warn('NOTION_DATABASE_ID_CALENDAR 未設定，提醒功能停用');
    return;
  }

  // 每分鐘檢查一次
  cron.schedule('* * * * *', () => {
    checkAndSendReminders();
  }, { timezone: 'Asia/Taipei' });

  logger.info('提醒排程器已啟動', {
    interval: '每分鐘',
    timezone: 'Asia/Taipei'
  });
}

/**
 * 檢查並發送到期的提醒
 */
async function checkAndSendReminders() {
  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 查詢需要發送的提醒
    // 條件：提醒時間 <= 現在 AND 已提醒 = false
    const response = await notion.databases.query({
      database_id: CALENDAR_DATABASE_ID,
      filter: {
        and: [
          {
            property: '提醒時間',
            date: {
              on_or_before: nowIso
            }
          },
          {
            property: '已提醒',
            checkbox: {
              equals: false
            }
          },
          {
            // 排除已完成的任務
            property: '狀態',
            select: {
              does_not_equal: '已完成'
            }
          }
        ]
      }
    });

    if (response.results.length === 0) {
      return; // 沒有需要發送的提醒
    }

    logger.info(`找到 ${response.results.length} 個待發送提醒`);

    // 取得通知頻道
    const channel = await discordClient.channels.fetch(config.discord.notifyChannelId);
    if (!channel) {
      logger.error('找不到通知頻道', { channelId: config.discord.notifyChannelId });
      return;
    }

    // 發送每個提醒
    for (const page of response.results) {
      await sendReminderNotification(channel, page);
      await markReminderSent(page.id);
    }

  } catch (error) {
    // 如果是因為欄位不存在（使用者還沒加），不要噴錯誤
    if (error.code === 'validation_error' && error.message.includes('not a property')) {
      // 靜默忽略，等使用者加欄位
      return;
    }
    logger.error('檢查提醒失敗', error);
  }
}

/**
 * 發送提醒通知
 * @param {import('discord.js').TextChannel} channel - Discord 頻道
 * @param {Object} page - Notion 頁面
 */
async function sendReminderNotification(channel, page) {
  try {
    const title = page.properties.Name?.title?.[0]?.text?.content || '未命名項目';
    const type = page.properties['類型']?.select?.name || '任務';
    const priority = page.properties['優先級']?.select?.name || '中';
    const dateObj = page.properties['日期']?.date;
    const summary = page.properties['摘要']?.rich_text?.[0]?.text?.content || null;

    // 格式化日期時間
    let dateTimeStr = '未設定';
    if (dateObj?.start) {
      const date = new Date(dateObj.start);
      dateTimeStr = date.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    const typeEmoji = type === '活動' ? '📅' : '✅';
    const priorityEmoji = priority === '高' ? '🔴' : priority === '中' ? '🟡' : '⚪';

    const embed = new EmbedBuilder()
      .setColor(0xFF9500) // 橘色提醒
      .setTitle(`🔔 提醒：${title}`)
      .addFields(
        { name: `${typeEmoji} 類型`, value: type, inline: true },
        { name: `${priorityEmoji} 優先級`, value: priority, inline: true },
        { name: '🕐 時間', value: dateTimeStr, inline: true }
      )
      .setTimestamp();

    if (summary) {
      embed.addFields({ name: '📝 摘要', value: summary, inline: false });
    }

    // Notion 連結
    const notionUrl = `https://www.notion.so/${page.id.replace(/-/g, '')}`;
    embed.addFields({ name: '🔗 連結', value: `[在 Notion 中開啟](${notionUrl})`, inline: false });

    embed.setFooter({ text: '由 Cyclone Discord Bot 提醒' });

    // 組合訊息（如果有設定要標記的用戶）
    const messageOptions = { embeds: [embed] };
    if (config.discord.notifyUserId) {
      messageOptions.content = `<@${config.discord.notifyUserId}>`;
    }

    await channel.send(messageOptions);

    logger.info('提醒已發送', { title, pageId: page.id });

  } catch (error) {
    logger.error('發送提醒通知失敗', { error: error.message, pageId: page.id });
  }
}

/**
 * 手動觸發檢查（測試用）
 */
export async function triggerReminderCheck() {
  await checkAndSendReminders();
}

export default {
  initReminderScheduler,
  triggerReminderCheck
};
