/**
 * Ready 事件處理
 */

import * as logger from '../utils/logger.js';
import { config } from '../config/index.js';
import { registerCommands } from '../commands/index.js';

/**
 * 處理 Bot 就緒事件
 * @param {import('discord.js').Client} client - Discord Client
 */
export async function handleReady(client) {
  // 註冊 Slash 指令
  await registerCommands(client);
  logger.info(`Discord Bot 已登入`, {
    tag: client.user.tag,
    id: client.user.id
  });

  // 設定 Bot 狀態
  client.user.setPresence({
    status: 'online',
    activities: [{
      name: '等待指令...',
      type: 4 // Custom Status
    }]
  });

  // 記錄配置資訊
  logger.info('Bot 配置', {
    infoCollectChannel: config.discord.infoCollectChannelId ? '已設定' : '未設定',
    calendarChannel: config.discord.calendarChannelId ? '已設定' : '未設定',
    notionInfoDb: config.notion.databaseIds.info ? '已設定' : '未設定',
    notionCalendarDb: config.notion.databaseIds.calendar ? '已設定' : '未設定',
    googleService: config.google.clientId ? '已設定' : '未設定',
    apifyService: config.apify.apiKey ? '已設定' : '未設定'
  });

  // 記錄伺服器資訊
  const guilds = client.guilds.cache;
  logger.info(`已連接到 ${guilds.size} 個伺服器`, {
    guilds: guilds.map(g => ({ name: g.name, id: g.id }))
  });
}

export default handleReady;
