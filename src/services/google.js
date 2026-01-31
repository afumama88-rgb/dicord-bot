/**
 * Google Calendar / Tasks API 服務
 */

import { google } from 'googleapis';
import { config } from '../config/index.js';

// OAuth2 客戶端
let oauth2Client = null;
let calendarService = null;
let tasksService = null;

/**
 * 初始化 Google 服務
 */
function initializeServices() {
  if (!config.google.clientId || !config.google.clientSecret || !config.google.refreshToken) {
    console.warn('Google API 憑證未完整設定，Google Calendar/Tasks 功能將無法使用');
    return false;
  }

  oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: config.google.refreshToken
  });

  calendarService = google.calendar({ version: 'v3', auth: oauth2Client });
  tasksService = google.tasks({ version: 'v1', auth: oauth2Client });

  return true;
}

/**
 * 檢查 Google 服務是否可用
 */
export function isGoogleAvailable() {
  if (!oauth2Client) {
    return initializeServices();
  }
  return true;
}

/**
 * 建立 Google Calendar 活動
 * @param {Object} eventData - 活動資料
 * @returns {Promise<{id: string, htmlLink: string}>}
 */
export async function createCalendarEvent(eventData) {
  if (!isGoogleAvailable()) {
    throw new Error('Google Calendar 服務未設定');
  }

  const event = {
    summary: eventData.title,
    location: eventData.location || undefined,
    description: eventData.summary || undefined,
    start: buildDateTime(eventData.startDate, eventData.startTime),
    end: buildDateTime(
      eventData.endDate || eventData.startDate,
      eventData.endTime || (eventData.startTime ? addHour(eventData.startTime) : null)
    ),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },    // 1 小時前
        { method: 'popup', minutes: 1440 }   // 1 天前
      ]
    }
  };

  const response = await calendarService.events.insert({
    calendarId: 'primary',
    resource: event
  });

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink
  };
}

/**
 * 建立 Google Task
 * @param {Object} taskData - 任務資料
 * @returns {Promise<{id: string, title: string}>}
 */
export async function createTask(taskData) {
  if (!isGoogleAvailable()) {
    throw new Error('Google Tasks 服務未設定');
  }

  // 取得預設任務清單
  const taskLists = await tasksService.tasklists.list();
  const defaultList = taskLists.data.items?.[0];

  if (!defaultList) {
    throw new Error('找不到 Google Tasks 清單');
  }

  const dueDate = taskData.deadline || taskData.startDate;

  const task = {
    title: taskData.title,
    notes: taskData.summary || undefined,
    due: dueDate ? new Date(dueDate).toISOString() : undefined
  };

  const response = await tasksService.tasks.insert({
    tasklist: defaultList.id,
    resource: task
  });

  return {
    id: response.data.id,
    title: response.data.title
  };
}

/**
 * 建立日期時間物件
 */
function buildDateTime(date, time) {
  if (!date) {
    return undefined;
  }

  if (time) {
    return {
      dateTime: `${date}T${time}:00`,
      timeZone: config.google.timezone
    };
  }

  return {
    date: date,
    timeZone: config.google.timezone
  };
}

/**
 * 時間加一小時
 */
function addHour(time) {
  if (!time) return null;

  const [hours, minutes] = time.split(':').map(Number);
  const newHours = (hours + 1) % 24;
  return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default {
  isGoogleAvailable,
  createCalendarEvent,
  createTask
};
