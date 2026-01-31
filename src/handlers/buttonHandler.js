/**
 * 按鈕互動處理器
 * 處理行事曆預覽的按鈕點擊事件
 */

import { cacheGet, cacheDelete } from '../utils/cache.js';
import { createCalendarEvent, createTask } from '../services/google.js';
import { createTaskPage } from '../services/notion.js';
import {
  createCalendarEventSuccessEmbed,
  createTaskSuccessEmbed,
  createNotionOnlySuccessEmbed,
  createCancelledEmbed,
  createErrorEmbed,
  createServiceUnavailableEmbed
} from '../components/embeds/index.js';
import { config } from '../config/index.js';
import * as logger from '../utils/logger.js';

/**
 * 處理按鈕互動
 * @param {import('discord.js').ButtonInteraction} interaction - 按鈕互動
 */
export async function handleButtonInteraction(interaction) {
  const [action, messageId] = interaction.customId.split(':');

  // 取得快取的解析結果
  const data = cacheGet(messageId);

  if (!data) {
    await interaction.reply({
      embeds: [createErrorEmbed('資料已過期', '請重新發送訊息以解析行事曆資訊')],
      ephemeral: true
    });
    return;
  }

  // 延遲回應（因為後續操作可能需要時間）
  await interaction.deferUpdate();

  try {
    switch (action) {
      case 'calendar_event':
        await handleCreateCalendarEvent(interaction, data, messageId);
        break;

      case 'calendar_task':
        await handleCreateTask(interaction, data, messageId);
        break;

      case 'calendar_notion':
        await handleNotionOnly(interaction, data, messageId);
        break;

      case 'calendar_cancel':
        await handleCancel(interaction, messageId);
        break;

      default:
        logger.warn('未知的按鈕動作', { action, messageId });
    }
  } catch (error) {
    logger.error('按鈕處理失敗', { action, error: error.message });

    await interaction.editReply({
      embeds: [createErrorEmbed('操作失敗', error.message)],
      components: []
    });
  }
}

/**
 * 建立 Google Calendar 事件
 */
async function handleCreateCalendarEvent(interaction, data, messageId) {
  // 檢查 Google 服務是否可用
  if (!config.google.clientId || !config.google.clientSecret) {
    await interaction.editReply({
      embeds: [createServiceUnavailableEmbed('Google Calendar')],
      components: []
    });
    return;
  }

  // 建立 Google Calendar 事件
  const calendarResult = await createCalendarEvent({
    title: data.title,
    description: data.description,
    startDate: data.startDate,
    endDate: data.endDate || data.startDate,
    startTime: data.startTime,
    endTime: data.endTime,
    isAllDay: data.isAllDay,
    location: data.location
  });

  // 同時儲存到 Notion
  const notionResult = await createTaskPage({
    title: data.title,
    summary: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    type: 'event',
    googleLink: calendarResult?.htmlLink
  });

  // 清除快取
  cacheDelete(messageId);

  // 更新訊息
  await interaction.editReply({
    embeds: [createCalendarEventSuccessEmbed({
      title: data.title,
      calendarLink: calendarResult?.htmlLink,
      notionUrl: notionResult?.url
    })],
    components: []
  });

  logger.info('Google Calendar 事件建立成功', {
    title: data.title,
    eventId: calendarResult?.id
  });
}

/**
 * 建立 Google Tasks 任務
 */
async function handleCreateTask(interaction, data, messageId) {
  // 檢查 Google 服務是否可用
  if (!config.google.clientId || !config.google.clientSecret) {
    await interaction.editReply({
      embeds: [createServiceUnavailableEmbed('Google Tasks')],
      components: []
    });
    return;
  }

  // 建立 Google Task
  const taskResult = await createTask({
    title: data.title,
    summary: data.description,
    startDate: data.startDate
  });

  // 同時儲存到 Notion
  const notionResult = await createTaskPage({
    title: data.title,
    summary: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    type: 'task'
  });

  // 清除快取
  cacheDelete(messageId);

  // 更新訊息
  await interaction.editReply({
    embeds: [createTaskSuccessEmbed({
      title: data.title,
      notionUrl: notionResult?.url
    })],
    components: []
  });

  logger.info('Google Task 建立成功', {
    title: data.title,
    taskId: taskResult?.id
  });
}

/**
 * 僅儲存至 Notion
 */
async function handleNotionOnly(interaction, data, messageId) {
  // 儲存到 Notion
  const notionResult = await createTaskPage({
    title: data.title,
    summary: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    type: 'note'
  });

  // 清除快取
  cacheDelete(messageId);

  // 更新訊息
  await interaction.editReply({
    embeds: [createNotionOnlySuccessEmbed({
      title: data.title,
      notionUrl: notionResult?.url
    })],
    components: []
  });

  logger.info('Notion 記錄建立成功', { title: data.title });
}

/**
 * 取消操作
 */
async function handleCancel(interaction, messageId) {
  // 清除快取
  cacheDelete(messageId);

  // 更新訊息
  await interaction.editReply({
    embeds: [createCancelledEmbed()],
    components: []
  });

  logger.info('使用者取消了行事曆操作');
}

/**
 * 檢查是否為行事曆相關按鈕
 * @param {string} customId - 按鈕 customId
 * @returns {boolean}
 */
export function isCalendarButton(customId) {
  return customId.startsWith('calendar_');
}

export default {
  handleButtonInteraction,
  isCalendarButton
};
