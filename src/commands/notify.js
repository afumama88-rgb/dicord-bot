/**
 * /notify 指令 - 立即發送每日通知
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { triggerReport } from '../services/scheduler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('notify')
    .setDescription('立即發送每日通知')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('通知類型')
        .setRequired(false)
        .addChoices(
          { name: '🌙 明日預覽', value: 'preview' },
          { name: '☀️ 今日提醒', value: 'reminder' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type') || 'preview';
    const typeName = type === 'preview' ? '明日預覽' : '今日提醒';

    await interaction.deferReply({ ephemeral: true });

    try {
      await triggerReport(type);

      await interaction.editReply({
        content: `✅ 已發送「${typeName}」通知！`
      });

    } catch (error) {
      console.error('手動觸發通知失敗:', error);
      await interaction.editReply({
        content: `❌ 發送失敗：${error.message}`
      });
    }
  }
};
