/**
 * Notion 資料庫查詢服務
 * 用於每日報告查詢
 */

import { Client } from '@notionhq/client';
import { config } from '../config/index.js';

const notion = new Client({
  auth: config.notion.apiKey
});

const CALENDAR_DATABASE_ID = config.notion.databaseIds.calendar;
const INFO_DATABASE_ID = config.notion.databaseIds.info;

/**
 * 查詢未來 7 天內 + 逾期未完成的活動
 * @param {string} todayStr - 今天日期 YYYY-MM-DD（用於判斷逾期）
 * @returns {Promise<Array<{title: string, date: string, time: string|null, isOverdue: boolean}>>}
 */
export async function queryCalendarEvents(todayStr) {
  if (!CALENDAR_DATABASE_ID) {
    return [];
  }

  // 計算 7 天後的日期
  const today = new Date(todayStr);
  const weekLater = new Date(today);
  weekLater.setDate(weekLater.getDate() + 7);
  const weekLaterStr = formatDate(weekLater);

  try {
    const response = await notion.databases.query({
      database_id: CALENDAR_DATABASE_ID,
      filter: {
        and: [
          {
            property: '類型',
            select: {
              equals: '活動'
            }
          },
          {
            // 排除已完成
            property: '狀態',
            select: {
              does_not_equal: '已完成'
            }
          },
          {
            // 7 天內或逾期（日期 <= 7天後）
            property: '日期',
            date: {
              on_or_before: weekLaterStr
            }
          }
        ]
      },
      sorts: [
        {
          property: '日期',
          direction: 'ascending'
        }
      ]
    });

    return response.results.map(page => {
      const title = page.properties.Name?.title?.[0]?.text?.content || '未命名事件';
      const dateObj = page.properties['日期']?.date;
      const dateStr = dateObj?.start?.split('T')[0] || null;

      // 提取時間（如果有）
      let time = null;
      if (dateObj?.start && dateObj.start.includes('T')) {
        const timePart = dateObj.start.split('T')[1];
        if (timePart) {
          time = timePart.substring(0, 5); // HH:mm
        }
      }

      // 判斷是否逾期
      const isOverdue = dateStr && dateStr < todayStr;

      return { title, date: dateStr, time, isOverdue };
    });

  } catch (error) {
    console.error('查詢行事曆事件失敗:', error.message);
    return [];
  }
}

/**
 * 查詢所有未完成的任務（包含逾期）
 * @param {string} todayStr - 今天日期 YYYY-MM-DD（用於判斷逾期）
 * @returns {Promise<Array<{title: string, priority: string, deadline: string|null, status: string, isOverdue: boolean}>>}
 */
export async function queryTasks(todayStr) {
  if (!CALENDAR_DATABASE_ID) {
    return [];
  }

  try {
    const response = await notion.databases.query({
      database_id: CALENDAR_DATABASE_ID,
      filter: {
        and: [
          {
            property: '類型',
            select: {
              equals: '任務'
            }
          },
          {
            // 排除已完成
            property: '狀態',
            select: {
              does_not_equal: '已完成'
            }
          }
        ]
      },
      sorts: [
        {
          property: '日期',
          direction: 'ascending'
        },
        {
          property: '優先級',
          direction: 'ascending' // 高 -> 中 -> 低
        }
      ]
    });

    return response.results.map(page => {
      const title = page.properties.Name?.title?.[0]?.text?.content || '未命名任務';
      const priority = page.properties['優先級']?.select?.name || '中';
      const status = page.properties['狀態']?.select?.name || '待處理';
      const dateObj = page.properties['日期']?.date;
      const deadline = dateObj?.start?.split('T')[0] || null;
      const summary = page.properties['摘要']?.rich_text?.[0]?.text?.content || null;

      // 判斷是否逾期
      const isOverdue = deadline && deadline < todayStr;

      return { title, priority, deadline, status, isOverdue, summary };
    });

  } catch (error) {
    console.error('查詢任務失敗:', error.message);
    return [];
  }
}

/**
 * 查詢資訊收集統計
 * @returns {Promise<{today: number, week: number, byType: Object}>}
 */
export async function queryInfoStats() {
  if (!INFO_DATABASE_ID) {
    return { today: 0, week: 0, byType: {} };
  }

  const today = new Date();
  const todayStr = formatDate(today);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = formatDate(weekAgo);

  try {
    // 查詢本週所有資料
    const response = await notion.databases.query({
      database_id: INFO_DATABASE_ID,
      filter: {
        property: 'date',
        date: {
          on_or_after: weekAgoStr
        }
      }
    });

    let todayCount = 0;
    const byType = {};

    response.results.forEach(page => {
      const dateObj = page.properties.date?.date;
      const pageDate = dateObj?.start?.split('T')[0];
      const type = page.properties.type?.select?.name || '其他';

      // 統計今日
      if (pageDate === todayStr) {
        todayCount++;
      }

      // 統計分類
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      today: todayCount,
      week: response.results.length,
      byType
    };

  } catch (error) {
    console.error('查詢資訊統計失敗:', error.message);
    return { today: 0, week: 0, byType: {} };
  }
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

export default {
  queryCalendarEvents,
  queryTasks,
  queryInfoStats
};
