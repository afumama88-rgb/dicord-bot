/**
 * Discord Bot 入口點
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import express from 'express';
import { config } from './config/index.js';
import { handleReady, handleMessageCreate, handleInteractionCreate } from './events/index.js';
import * as logger from './utils/logger.js';

// 建立 Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,  // 需要啟用 Privileged Intent
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

// 註冊事件處理器
client.once('ready', () => handleReady(client));
client.on('messageCreate', handleMessageCreate);
client.on('interactionCreate', handleInteractionCreate);

// 錯誤處理
client.on('error', (error) => {
  logger.error('Discord Client 錯誤', error);
});

client.on('warn', (message) => {
  logger.warn('Discord Client 警告', { message });
});

// 建立 Express 伺服器（用於健康檢查）
const app = express();

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    bot: client.user?.tag || 'Not connected',
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  const isConnected = client.ws.status === 0; // 0 = READY
  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? 'healthy' : 'unhealthy',
    connected: isConnected,
    ping: client.ws.ping
  });
});

// 啟動伺服器
async function start() {
  try {
    // 啟動 Express
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`健康檢查伺服器已啟動`, { port });
    });

    // 登入 Discord
    logger.info('正在連接 Discord...');
    await client.login(config.discord.token);

  } catch (error) {
    logger.error('啟動失敗', error);
    process.exit(1);
  }
}

// 優雅關閉
process.on('SIGINT', async () => {
  logger.info('收到 SIGINT，正在關閉...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM，正在關閉...');
  client.destroy();
  process.exit(0);
});

// 未捕獲的錯誤處理
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未處理的 Promise 拒絕', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('未捕獲的例外', error);
  process.exit(1);
});

// 啟動
start();
