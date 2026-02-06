/**
 * /ai 指令 - AI 智慧解析，自動判斷活動或任務
 * 使用 Gemini AI 分析文字，提取日期資訊
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { extractCalendarFromText } from '../services/gemini.js';
import { cacheAnalysis } from '../utils/cache.js';
import {
  createCalendarPreviewEmbed,
  createCalendarButtons,
  createCalendarErrorEmbed
} from '../components/embeds/index.js';
import * as logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('AI 智慧解析 - 輸入文字自動判斷活動或任務')
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('描述你的活動或任務（例：明天下午兩點開會）')
        .setRequired(true)
    ),

  async execute(interaction) {
    const text = interaction.options.getString('text');

    // 發送處理中訊息
    await interaction.deferReply();

    try {
      // 使用 Gemini AI 解析文字
      const calendarData = await extractCalendarFromText(text);

      if (!calendarData || !calendarData.title) {
        throw new Error('無法從內容中提取有效的標題');
      }

      // 如果沒有 startDate 但有 deadline，使用 deadline 作為日期
      if (!calendarData.startDate && calendarData.deadline) {
        calendarData.startDate = calendarData.deadline;
        logger.info('使用 deadline 作為 startDate', { deadline: calendarData.deadline });
      }

      if (!calendarData.startDate) {
        throw new Error('無法從內容中提取有效的日期資訊');
      }

      // 添加來源類型
      calendarData.source = 'ai-command';

      // 取得回覆訊息的 ID
      const reply = await interaction.fetchReply();

      // 快取解析結果，供按鈕互動使用
      cacheAnalysis(reply.id, {
        ...calendarData,
        originalText: text
      });

      // 建立預覽 Embed
      const embed = createAiPreviewEmbed(calendarData, text);

      // 更新為預覽訊息，附帶按鈕
      await interaction.editReply({
        embeds: [embed],
        components: [createCalendarButtons(reply.id)]
      });

      logger.info('/ai 指令解析成功', {
        title: calendarData.title,
        type: calendarData.type,
        startDate: calendarData.startDate
      });

    } catch (error) {
      logger.error('/ai 指令解析失敗', { error: error.message, text });

      await interaction.editReply({
        embeds: [createCalendarErrorEmbed(error.message)],
        components: []
      });
    }
  }
};

/**
 * 建立 AI 解析預覽 Embed（加強版，顯示 AI 判斷結果）
 */
function createAiPreviewEmbed(data, originalText) {
  const typeEmoji = data.type === 'task' ? '✅' : '📅';
  const typeText = data.type === 'task' ? '任務' : '活動';
  const priorityEmoji = data.priority === '高' ? '🔴' : data.priority === '中' ? '🟡' : '⚪';

  const embed = new EmbedBuilder()
    .setColor(data.type === 'task' ? 0x00D26A : 0x4285F4)
    .setTitle(`🤖 AI 解析結果`)
    .setDescription(`> ${originalText}`)
    .addFields(
      { name: '📌 標題', value: data.title, inline: false },
      { name: `${typeEmoji} AI 判斷類型`, value: typeText, inline: true },
      { name: `${priorityEmoji} 優先級`, value: data.priority || '中', inline: true }
    );

  // 日期時間
  let dateTimeStr = data.startDate;
  if (data.startTime) {
    dateTimeStr += ` ${data.startTime}`;
  }
  if (data.endDate && data.endDate !== data.startDate) {
    dateTimeStr += ` ~ ${data.endDate}`;
  }
  if (data.endTime && data.endTime !== data.startTime) {
    dateTimeStr += ` ${data.endTime}`;
  }
  embed.addFields({ name: '🕐 時間', value: dateTimeStr, inline: false });

  // 地點
  if (data.location) {
    embed.addFields({ name: '📍 地點', value: data.location, inline: true });
  }

  // 截止日期（如果與 startDate 不同）
  if (data.deadline && data.deadline !== data.startDate) {
    embed.addFields({ name: '⏰ 截止日期', value: data.deadline, inline: true });
  }

  // 提醒設定
  if (data.reminder && data.reminder.enabled) {
    let reminderText = data.reminder.description || '';
    if (data.reminder.mode === 'exact' && data.reminder.exactTime) {
      reminderText = `在 ${data.reminder.exactTime} 提醒`;
    } else if (data.reminder.mode === 'before' && data.reminder.beforeMinutes) {
      reminderText = `提前 ${data.reminder.beforeMinutes} 分鐘`;
    }
    embed.addFields({ name: '🔔 提醒', value: reminderText, inline: true });
  }

  // 摘要
  if (data.summary) {
    embed.addFields({ name: '📝 摘要', value: data.summary, inline: false });
  }

  // AI 信心指數
  if (data.confidence !== undefined) {
    const confidenceBar = getConfidenceBar(data.confidence);
    embed.addFields({ name: '🎯 AI 信心', value: confidenceBar, inline: true });
  }

  embed.setFooter({ text: '請選擇要建立的類型，或取消操作' });
  embed.setTimestamp();

  return embed;
}

/**
 * 生成信心指數進度條
 */
function getConfidenceBar(confidence) {
  const percent = Math.round(confidence * 100);
  const filled = Math.round(confidence * 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${bar} ${percent}%`;
}
