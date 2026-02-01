/**
 * 定時任務排程器
 * 每日通知：21:00 明日預覽 + 08:00 當日提醒
 */

import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { config } from '../config/index.js';
import { queryCalendarEvents, queryTasks, queryInfoStats } from './notionQuery.js';
import * as logger from '../utils/logger.js';

let discordClient = null;

/**
 * 初始化排程器
 * @param {import('discord.js').Client} client - Discord Client
 */
export function initScheduler(client) {
  discordClient = client;

  if (!config.discord.notifyChannelId) {
    logger.warn('DISCORD_NOTIFY_CHANNEL_ID 未設定，每日通知功能停用');
    return;
  }

  // 每天 21:00 - 明日預覽
  cron.schedule('0 21 * * *', () => {
    sendDailyReport('preview');
  }, { timezone: 'Asia/Taipei' });

  // 每天 08:00 - 當日提醒
  cron.schedule('0 8 * * *', () => {
    sendDailyReport('reminder');
  }, { timezone: 'Asia/Taipei' });

  logger.info('每日通知排程已啟動', {
    preview: '21:00',
    reminder: '08:00',
    timezone: 'Asia/Taipei'
  });
}

/**
 * 發送每日報告
 * @param {'preview' | 'reminder'} type - 報告類型
 */
async function sendDailyReport(type) {
  try {
    const channel = await discordClient.channels.fetch(config.discord.notifyChannelId);

    if (!channel) {
      logger.error('找不到通知頻道', { channelId: config.discord.notifyChannelId });
      return;
    }

    // 計算目標日期
    const targetDate = new Date();
    if (type === 'preview') {
      targetDate.setDate(targetDate.getDate() + 1); // 明天
    }

    const dateStr = formatDate(targetDate);
    const weekday = getWeekday(targetDate);

    // 查詢資料
    const [events, tasks, infoStats] = await Promise.all([
      queryCalendarEvents(dateStr),
      queryTasks(),
      queryInfoStats()
    ]);

    // 建立 Embed
    const embed = buildReportEmbed(type, dateStr, weekday, events, tasks, infoStats);

    await channel.send({ embeds: [embed] });

    logger.info('每日報告已發送', { type, date: dateStr });

  } catch (error) {
    logger.error('發送每日報告失敗', error);
  }
}

/**
 * 建立報告 Embed
 */
function buildReportEmbed(type, dateStr, weekday, events, tasks, infoStats) {
  const isPreview = type === 'preview';
  const title = isPreview ? `🌙 明日預覽｜${dateStr}（${weekday}）` : `☀️ 今日提醒｜${dateStr}（${weekday}）`;
  const color = isPreview ? 0x5865F2 : 0xFEE75C; // 藍色 / 黃色

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp();

  // 行程區塊
  let eventText = '';
  if (events.length === 0) {
    eventText = '無行程安排';
  } else {
    eventText = events.map(e => {
      const time = e.time || '全天';
      return `• ${time}　${e.title}`;
    }).join('\n');
  }
  embed.addFields({ name: `📌 ${isPreview ? '明日' : '今日'}行程`, value: eventText });

  // 任務區塊
  let taskText = '';
  if (tasks.length === 0) {
    taskText = '無待處理任務 🎉';
  } else {
    taskText = tasks.slice(0, 10).map(t => {
      const priority = t.priority === '高' ? '🔴' : t.priority === '中' ? '🟡' : '⚪';
      const deadline = t.deadline ? ` - 截止：${t.deadline}` : '';
      const urgent = t.deadline === dateStr ? ' ⚠️' : '';
      return `${priority} ${t.title}${deadline}${urgent}`;
    }).join('\n');

    if (tasks.length > 10) {
      taskText += `\n...還有 ${tasks.length - 10} 項`;
    }
  }
  embed.addFields({ name: `✅ 待處理任務（${tasks.length} 項）`, value: taskText });

  // 資訊收集統計區塊
  let infoText = `今日新增：${infoStats.today} 則\n本週累計：${infoStats.week} 則`;

  if (infoStats.byType && Object.keys(infoStats.byType).length > 0) {
    infoText += '\n\n📊 本週分類：';
    for (const [type, count] of Object.entries(infoStats.byType)) {
      infoText += `\n• ${type}：${count} 則`;
    }
  }
  embed.addFields({ name: '📚 資訊收集', value: infoText });

  // Footer
  embed.setFooter({ text: '由 Cyclone Discord Bot 自動發送' });

  return embed;
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 取得星期幾
 */
function getWeekday(date) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return weekdays[date.getDay()];
}

/**
 * 手動觸發報告（測試用）
 */
export async function triggerReport(type = 'preview') {
  await sendDailyReport(type);
}

export default {
  initScheduler,
  triggerReport
};
