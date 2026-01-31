/**
 * 重試工具
 */

/**
 * 帶重試的非同步函式執行
 * @param {Function} fn - 要執行的非同步函式
 * @param {Object} options - 選項
 * @param {number} options.maxRetries - 最大重試次數（預設 3）
 * @param {number} options.delay - 初始延遲毫秒數（預設 1000）
 * @param {number} options.backoff - 退避倍數（預設 2）
 * @param {Function} options.onRetry - 重試時的回呼函式
 * @param {Function} options.shouldRetry - 判斷是否應該重試的函式
 * @returns {Promise<any>} 函式執行結果
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry = () => {},
    shouldRetry = defaultShouldRetry
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 判斷是否應該重試
      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        onRetry(attempt, waitTime, error);
        await sleep(waitTime);
      }
    }
  }

  throw lastError;
}

/**
 * 預設的重試判斷邏輯
 * @param {Error} error - 錯誤物件
 * @returns {boolean} 是否應該重試
 */
function defaultShouldRetry(error) {
  // 不重試的 HTTP 狀態碼
  const noRetryStatuses = [400, 401, 403, 404, 422];

  if (error.status && noRetryStatuses.includes(error.status)) {
    return false;
  }

  // 不重試的錯誤類型
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return false;
  }

  return true;
}

/**
 * 延遲函式
 * @param {number} ms - 延遲毫秒數
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 帶超時的 Promise
 * @param {Promise} promise - 原始 Promise
 * @param {number} ms - 超時毫秒數
 * @param {string} message - 超時錯誤訊息
 * @returns {Promise<any>}
 */
export function withTimeout(promise, ms, message = '操作超時') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]);
}

export default {
  withRetry,
  sleep,
  withTimeout
};
