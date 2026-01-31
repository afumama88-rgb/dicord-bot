/**
 * 資訊收集處理器
 * 處理包含 URL 的訊息，爬取內容並儲存至 Notion
 */

import { parseUrl, extractUrls, getNotionType } from '../utils/urlParser.js';
import { getYouTubeInfo } from '../services/youtube.js';
import { scrapeSocialMedia, isApifyAvailable } from '../services/apify.js';
import { scrapeWebPage } from '../services/scraper.js';
import { createInfoPage } from '../services/notion.js';
import { cacheNotionMapping } from '../utils/cache.js';
import {
  createInfoCollectEmbed,
  createInfoCollectErrorEmbed,
  createProcessingEmbed
} from '../components/embeds/index.js';
import * as logger from '../utils/logger.js';

/**
 * 處理資訊收集訊息
 * @param {import('discord.js').Message} message - Discord 訊息
 */
export async function handleInfoCollect(message) {
  const urls = extractUrls(message.content);

  if (urls.length === 0) {
    return; // 沒有 URL，不處理
  }

  // 處理每個 URL
  for (const url of urls) {
    await processUrl(message, url);
  }
}

/**
 * 處理單一 URL
 * @param {import('discord.js').Message} message - Discord 訊息
 * @param {string} url - 要處理的 URL
 */
async function processUrl(message, url) {
  const parsed = parseUrl(url);

  if (!parsed) {
    logger.debug('無法解析的 URL', { url });
    return;
  }

  // 發送處理中訊息
  const processingMsg = await message.reply({
    embeds: [createProcessingEmbed(url)]
  });

  try {
    // 根據類型取得內容
    const content = await fetchContent(parsed);

    if (!content) {
      throw new Error('無法取得內容');
    }

    // 儲存到 Notion
    const notionResult = await createInfoPage({
      title: content.title,
      url: content.url,
      type: getNotionType(parsed.type),
      description: content.description,
      thumbnail: content.thumbnail,
      author: content.author,
      content: content.content
    });

    // 快取 Notion 頁面 ID 對應
    if (notionResult?.id) {
      cacheNotionMapping(processingMsg.id, notionResult.id);
    }

    // 更新為成功訊息
    await processingMsg.edit({
      embeds: [createInfoCollectEmbed({
        title: content.title,
        description: content.description,
        url: content.url,
        type: parsed.type,
        thumbnail: content.thumbnail,
        author: content.author,
        notionUrl: notionResult?.url
      })]
    });

    logger.info('資訊收集成功', {
      url,
      type: parsed.type,
      notionId: notionResult?.id
    });

    // 添加成功反應
    await message.react('✅');

  } catch (error) {
    logger.error('資訊收集失敗', { url, error: error.message });

    // 更新為錯誤訊息
    await processingMsg.edit({
      embeds: [createInfoCollectErrorEmbed(url, error.message)]
    });

    // 添加失敗反應
    await message.react('❌');
  }
}

/**
 * 根據 URL 類型取得內容
 * @param {{ type: string, url: string, match: RegExpMatchArray | null }} parsed - 解析結果
 * @returns {Promise<Object|null>} 內容物件
 */
async function fetchContent(parsed) {
  const { type, url } = parsed;

  switch (type) {
    case 'youtube':
      return await getYouTubeInfo(url);

    case 'facebook':
    case 'instagram':
    case 'threads': {
      // 嘗試使用 Apify，失敗則使用一般爬蟲
      if (isApifyAvailable()) {
        try {
          return await scrapeSocialMedia(url, type);
        } catch (error) {
          logger.warn(`Apify 爬取失敗，嘗試一般爬蟲`, { type, error: error.message });
          return await scrapeWebPage(url);
        }
      }
      return await scrapeWebPage(url);
    }

    case 'web':
    default:
      return await scrapeWebPage(url);
  }
}

/**
 * 檢查訊息是否應該由資訊收集處理
 * @param {import('discord.js').Message} message - Discord 訊息
 * @returns {boolean}
 */
export function shouldHandleInfoCollect(message) {
  // 檢查是否有 URL
  const urls = extractUrls(message.content);
  return urls.length > 0;
}

export default {
  handleInfoCollect,
  shouldHandleInfoCollect
};
