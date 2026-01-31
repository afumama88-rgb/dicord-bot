/**
 * 日誌工具
 */

import { config } from '../config/index.js';

const isDev = config.server.nodeEnv === 'development';

/**
 * 格式化時間戳記
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 格式化日誌訊息
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = getTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

/**
 * 資訊日誌
 */
export function info(message, meta = {}) {
  console.log(formatMessage('INFO', message, meta));
}

/**
 * 警告日誌
 */
export function warn(message, meta = {}) {
  console.warn(formatMessage('WARN', message, meta));
}

/**
 * 錯誤日誌
 */
export function error(message, meta = {}) {
  // 如果 meta 是 Error 物件，提取資訊
  if (meta instanceof Error) {
    meta = {
      name: meta.name,
      message: meta.message,
      stack: isDev ? meta.stack : undefined
    };
  }
  console.error(formatMessage('ERROR', message, meta));
}

/**
 * 除錯日誌（僅在開發環境輸出）
 */
export function debug(message, meta = {}) {
  if (isDev) {
    console.log(formatMessage('DEBUG', message, meta));
  }
}

/**
 * Discord 事件日誌
 */
export function discordEvent(eventName, details = {}) {
  if (isDev) {
    console.log(formatMessage('DISCORD', eventName, details));
  }
}

/**
 * API 呼叫日誌
 */
export function apiCall(service, method, success, duration = null) {
  const meta = { service, method, success };
  if (duration !== null) {
    meta.duration = `${duration}ms`;
  }

  if (success) {
    debug('API 呼叫成功', meta);
  } else {
    warn('API 呼叫失敗', meta);
  }
}

export default {
  info,
  warn,
  error,
  debug,
  discordEvent,
  apiCall
};
