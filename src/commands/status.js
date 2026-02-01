/**
 * /status 指令 - 查看機器人狀態
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../config/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('查看機器人狀態與設定'),

  async execute(interaction) {
    const client = interaction.client;

    // 檢查各項設定
    const checks = {
      'Discord Token': !!config.discord.token,
      'Notion API': !!config.notion.apiKey,
      '資訊收集頻道': !!config.discord.infoCollectChannelId,
      '行事曆頻道': !!config.discord.calendarChannelId,
      '通知頻道': !!config.discord.notifyChannelId,
      '通知標記用戶': !!config.discord.notifyUserId,
      'Notion 資訊收集 DB': !!config.notion.databaseIds.info,
      'Notion 行事曆 DB': !!config.notion.databaseIds.calendar,
      'Gemini AI': !!config.gemini.apiKey,
      'Apify 爬蟲': !!config.apify.apiKey,
      'Google 服務': !!config.google.clientId
    };

    // 建立狀態文字
    const statusLines = Object.entries(checks).map(([name, ok]) => {
      return `${ok ? '✅' : '❌'} ${name}`;
    });

    // 計算 uptime
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🤖 機器人狀態')
      .addFields(
        {
          name: '📊 基本資訊',
          value: [
            `**名稱：** ${client.user.tag}`,
            `**延遲：** ${client.ws.ping}ms`,
            `**運行時間：** ${uptimeStr}`,
            `**伺服器數：** ${client.guilds.cache.size}`
          ].join('\n'),
          inline: false
        },
        {
          name: '⚙️ 設定狀態',
          value: statusLines.join('\n'),
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Cyclone Discord Bot' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
