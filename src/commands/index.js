/**
 * Slash 指令註冊與管理
 */

import { REST, Routes, Collection } from 'discord.js';
import { config } from '../config/index.js';
import * as logger from '../utils/logger.js';

// 匯入所有指令
import notifyCommand from './notify.js';
import statusCommand from './status.js';
import addEventCommand from './addEvent.js';
import addTaskCommand from './addTask.js';
import todayCommand from './today.js';
import aiCommand from './ai.js';

// 指令集合
const commands = new Collection();

// 註冊所有指令
const commandList = [
  notifyCommand,
  statusCommand,
  addEventCommand,
  addTaskCommand,
  todayCommand,
  aiCommand
];

commandList.forEach(cmd => {
  commands.set(cmd.data.name, cmd);
});

/**
 * 向 Discord 註冊 Slash 指令
 * @param {import('discord.js').Client} client - Discord Client
 */
export async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    logger.info('開始註冊 Slash 指令...');

    const commandData = commandList.map(cmd => cmd.data.toJSON());

    // 註冊到所有已加入的伺服器（Guild Commands，即時生效）
    const guilds = client.guilds.cache;

    for (const [guildId, guild] of guilds) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, guildId),
        { body: commandData }
      );
      logger.info(`已在 ${guild.name} 註冊 ${commandData.length} 個指令`);
    }

    logger.info('Slash 指令註冊完成', {
      commands: commandData.map(c => c.name)
    });

  } catch (error) {
    logger.error('Slash 指令註冊失敗', error);
  }
}

/**
 * 取得指令
 * @param {string} name - 指令名稱
 */
export function getCommand(name) {
  return commands.get(name);
}

export { commands };
export default { registerCommands, getCommand, commands };
