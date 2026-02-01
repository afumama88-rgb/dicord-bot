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

    // 計算今天日期（用於判斷逾期）
    const today = new Date();
    const todayStr = formatDate(today);
    const weekday = getWeekday(today);

    // 查詢資料（7天內 + 逾期未完成）
    const [events, tasks, infoStats] = await Promise.all([
      queryCalendarEvents(todayStr),
      queryTasks(todayStr),
      queryInfoStats()
    ]);

    logger.info('每日報告查詢結果', {
      date: todayStr,
      eventsCount: events.length,
      tasksCount: tasks.length,
      infoToday: infoStats.today,
      infoWeek: infoStats.week
    });

    // 建立 Embed
    const embed = buildReportEmbed(type, todayStr, weekday, events, tasks, infoStats);

    // 組合訊息內容（如果有設定要標記的用戶）
    const messageOptions = { embeds: [embed] };
    if (config.discord.notifyUserId) {
      messageOptions.content = `<@${config.discord.notifyUserId}>`;
    }

    await channel.send(messageOptions);

    logger.info('每日報告已發送', { type, date: todayStr });

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

  // 行程區塊（7天內 + 逾期）
  let eventText = '';
  const overdueEvents = events.filter(e => e.isOverdue);
  const upcomingEvents = events.filter(e => !e.isOverdue);

  if (events.length === 0) {
    eventText = '無行程安排';
  } else {
    const lines = [];

    // 先顯示逾期
    if (overdueEvents.length > 0) {
      lines.push('⚠️ **逾期活動：**');
      overdueEvents.forEach(e => {
        const time = e.time || '全天';
        lines.push(`• ~~${e.date}~~ ${time}　${e.title}`);
      });
    }

    // 再顯示即將到來
    if (upcomingEvents.length > 0) {
      if (overdueEvents.length > 0) lines.push('');
      lines.push('📅 **近期活動：**');
      upcomingEvents.slice(0, 10).forEach(e => {
        const time = e.time || '全天';
        const isToday = e.date === dateStr;
        const dateLabel = isToday ? '今天' : e.date;
        lines.push(`• ${dateLabel} ${time}　${e.title}`);
      });
      if (upcomingEvents.length > 10) {
        lines.push(`...還有 ${upcomingEvents.length - 10} 項`);
      }
    }

    eventText = lines.join('\n');
  }
  embed.addFields({ name: `📌 行程（${events.length} 項）`, value: eventText });

  // 任務區塊（含逾期）
  let taskText = '';
  const overdueTasks = tasks.filter(t => t.isOverdue);
  const pendingTasks = tasks.filter(t => !t.isOverdue);

  if (tasks.length === 0) {
    taskText = '無待處理任務 🎉';
  } else {
    const lines = [];

    // 先顯示逾期任務
    if (overdueTasks.length > 0) {
      lines.push('⚠️ **逾期任務：**');
      overdueTasks.slice(0, 5).forEach(t => {
        const priority = t.priority === '高' ? '🔴' : t.priority === '中' ? '🟡' : '⚪';
        const status = t.status === '進行中' ? ' [進行中]' : '';
        lines.push(`${priority} ~~${t.deadline}~~ ${t.title}${status}`);
        if (t.summary) {
          lines.push(`　　📝 ${t.summary.slice(0, 50)}`);
        }
      });
      if (overdueTasks.length > 5) {
        lines.push(`...還有 ${overdueTasks.length - 5} 項逾期`);
      }
    }

    // 再顯示待處理任務
    if (pendingTasks.length > 0) {
      if (overdueTasks.length > 0) lines.push('');
      lines.push('📋 **待處理：**');
      pendingTasks.slice(0, 10).forEach(t => {
        const priority = t.priority === '高' ? '🔴' : t.priority === '中' ? '🟡' : '⚪';
        const deadline = t.deadline ? ` - ${t.deadline}` : '';
        const status = t.status === '進行中' ? ' [進行中]' : '';
        const isToday = t.deadline === dateStr;
        const urgent = isToday ? ' ⏰' : '';
        lines.push(`${priority} ${t.title}${deadline}${status}${urgent}`);
        if (t.summary) {
          lines.push(`　　📝 ${t.summary.slice(0, 50)}`);
        }
      });
      if (pendingTasks.length > 10) {
        lines.push(`...還有 ${pendingTasks.length - 10} 項`);
      }
    }

    taskText = lines.join('\n');
  }
  embed.addFields({ name: `✅ 任務（${tasks.length} 項）`, value: taskText });

  // 資訊收集統計區塊
  let infoText = `今日新增：${infoStats.today} 則\n本週累計：${infoStats.week} 則`;

  if (infoStats.byType && Object.keys(infoStats.byType).length > 0) {
    infoText += '\n\n📊 本週分類：';
    for (const [type, count] of Object.entries(infoStats.byType)) {
      infoText += `\n• ${type}：${count} 則`;
    }
  }
  embed.addFields({ name: '📚 資訊收集', value: infoText });

  // 打卡提醒
  const checkinText = '👉 [點我前往打卡](https://discord.com/channels/876831894900199474/1181522618717851710)';
  embed.addFields({ name: '🔔 每日打卡', value: checkinText });

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
