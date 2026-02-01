/**
 * Notion API 服務
 * 使用 @notionhq/client v2.2.15
 */

import { Client } from '@notionhq/client';
import { config } from '../config/index.js';

// 初始化 Notion 客戶端
const notion = new Client({
  auth: config.notion.apiKey
});

const INFO_DATABASE_ID = config.notion.databaseIds.info;
const CALENDAR_DATABASE_ID = config.notion.databaseIds.calendar;

/**
 * 格式化 Notion 頁面 URL（確保桌面版瀏覽器能正確開啟）
 * @param {string} pageId - 頁面 ID
 * @returns {string} 格式化後的 URL
 */
function formatNotionUrl(pageId) {
  // 移除連字號，使用純 ID 格式
  const cleanId = pageId.replace(/-/g, '');
  return `https://www.notion.so/${cleanId}`;
}

/**
 * 取得建立時間戳記（台北時區）
 * @returns {string} 格式化的時間戳 [YYYY-MM-DD HH:mm]
 */
function getCreatedTimestamp() {
  const now = new Date();
  // 使用台北時區
  const options = {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('zh-TW', options);
  const parts = formatter.formatToParts(now);

  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;

  return `[${year}-${month}-${day} ${hour}:${minute}]`;
}

/**
 * 清理作者名稱（移除 multi_select 不接受的字元）
 * @param {string} author - 原始作者名稱
 * @returns {string} 清理後的名稱
 */
function sanitizeAuthor(author) {
  if (!author) return null;
  // 移除逗號（multi_select 分隔符）和其他特殊字元
  return author
    .replace(/[,，]/g, ' ')  // 逗號換成空格
    .replace(/[\n\r\t]/g, ' ')  // 換行換成空格
    .trim()
    .slice(0, 100);  // 限制長度
}

/**
 * 建立資訊收集頁面（#資訊收集 頻道用）
 * @param {Object} data - 頁面資料
 * @returns {Promise<{id: string, url: string}>}
 */
export async function createInfoPage(data) {
  // 清理和驗證資料
  const cleanTitle = (data.title || '無標題').slice(0, 100);
  const cleanDescription = data.description ? data.description.slice(0, 2000) : null;
  const cleanAuthor = sanitizeAuthor(data.author);

  const properties = {
    title: {
      title: [{ text: { content: cleanTitle } }]
    },
    date: {
      date: { start: new Date().toISOString() }  // 包含時間：2026-02-01T14:30:00.000Z
    },
    type: {
      select: { name: data.type || '網路文章' }
    },
    url: {
      url: data.url || null
    }
  };

  // 摘要（如果有）
  if (cleanDescription) {
    properties['摘要'] = {
      rich_text: [{ text: { content: cleanDescription } }]
    };
  }

  // 作者（如果有且有效）
  if (cleanAuthor && cleanAuthor.length > 0) {
    properties.Author = {
      multi_select: [{ name: cleanAuthor }]
    };
  }

  try {
    const response = await notion.pages.create({
      parent: { database_id: INFO_DATABASE_ID },
      properties: properties,
      children: buildInfoPageContent(data)
    });

    return {
      id: response.id,
      url: formatNotionUrl(response.id)
    };
  } catch (error) {
    // 記錄詳細錯誤資訊以便除錯
    console.error('Notion 建立頁面失敗:', {
      error: error.message,
      code: error.code,
      title: cleanTitle,
      author: cleanAuthor,
      type: data.type,
      url: data.url
    });
    throw error;
  }
}

/**
 * 建立行事曆/任務頁面（#行事曆助手 頻道用）
 * @param {Object} data - 頁面資料
 * @returns {Promise<{id: string, url: string}>}
 */
export async function createTaskPage(data) {
  if (!CALENDAR_DATABASE_ID) {
    throw new Error('NOTION_DATABASE_ID_CALENDAR 未設定');
  }

  const properties = {
    Name: {
      title: [{ text: { content: data.title } }]
    },
    '日期': {
      date: {
        start: data.startDate,
        end: data.endDate || undefined
      }
    },
    '類型': {
      select: { name: data.type === 'event' ? '活動' : '任務' }
    },
    '優先級': {
      select: { name: data.priority || '中' }
    },
    '狀態': {
      select: { name: '待處理' }
    }
  };

  const response = await notion.pages.create({
    parent: { database_id: CALENDAR_DATABASE_ID },
    properties: properties,
    children: buildTaskPageContent(data)
  });

  return {
    id: response.id,
    url: formatNotionUrl(response.id)
  };
}

/**
 * 更新頁面屬性
 * @param {string} pageId - 頁面 ID
 * @param {Object} properties - 要更新的屬性
 */
export async function updatePage(pageId, properties) {
  return await notion.pages.update({
    page_id: pageId,
    properties: properties
  });
}

/**
 * 封存頁面（軟刪除）
 * @param {string} pageId - 頁面 ID
 */
export async function archivePage(pageId) {
  return await notion.pages.update({
    page_id: pageId,
    archived: true
  });
}

/**
 * 建立資訊頁面內容區塊
 */
function buildInfoPageContent(data) {
  const blocks = [];

  // 摘要（如果有）
  if (data.description) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: data.description.slice(0, 2000) }
        }]
      }
    });
  }

  // YouTube 嵌入（如果是 YT 類型）
  if (data.type === 'YT' && data.url) {
    blocks.push({
      object: 'block',
      type: 'video',
      video: {
        type: 'external',
        external: { url: data.url }
      }
    });
  }

  // 分隔線
  blocks.push({
    object: 'block',
    type: 'divider',
    divider: {}
  });

  // 來源標記
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: `由 Cyclone Discord Bot 建立 ${getCreatedTimestamp()}` },
        annotations: { italic: true, color: 'gray' }
      }]
    }
  });

  return blocks;
}

/**
 * 建立任務頁面內容區塊
 */
function buildTaskPageContent(data) {
  const blocks = [];

  // 摘要 Callout
  if (data.summary) {
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{ type: 'text', text: { content: data.summary } }],
        icon: { type: 'emoji', emoji: '📋' }
      }
    });
  }

  // 時間資訊
  if (data.startTime) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '🕐 時間：' }, annotations: { bold: true } },
          {
            type: 'text',
            text: {
              content: data.endTime
                ? `${data.startTime} - ${data.endTime}`
                : data.startTime
            }
          }
        ]
      }
    });
  }

  // 地點（如果有）
  if (data.location) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '📍 地點：' }, annotations: { bold: true } },
          { type: 'text', text: { content: data.location } }
        ]
      }
    });
  }

  // 截止日期（如果有）
  if (data.deadline) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '⏰ 截止日期：' }, annotations: { bold: true } },
          {
            type: 'text',
            text: {
              content: data.deadlineDescription
                ? `${data.deadline} (${data.deadlineDescription})`
                : data.deadline
            }
          }
        ]
      }
    });
  }

  // 聯絡資訊（如果有）
  if (data.contact && (data.contact.name || data.contact.phone || data.contact.email)) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: '聯絡資訊' } }]
      }
    });

    const contactLines = [];
    if (data.contact.name) contactLines.push(`承辦人：${data.contact.name}`);
    if (data.contact.phone) contactLines.push(`電話：${data.contact.phone}`);
    if (data.contact.email) contactLines.push(`信箱：${data.contact.email}`);

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: contactLines.join('\n') } }]
      }
    });
  }

  // 分隔線
  blocks.push({
    object: 'block',
    type: 'divider',
    divider: {}
  });

  // 來源標記
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: `由 Cyclone Discord Bot 建立 ${getCreatedTimestamp()}` },
        annotations: { italic: true, color: 'gray' }
      }]
    }
  });

  return blocks;
}

export default {
  createInfoPage,
  createTaskPage,
  updatePage,
  archivePage
};
