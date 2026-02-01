/**
 * /add-task 指令 - 快速新增任務到 Notion
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createTaskPage } from '../services/notion.js';

export default {
  data: new SlashCommandBuilder()
    .setName('add-task')
    .setDescription('新增任務到 Notion')
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('任務名稱')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('deadline')
        .setDescription('截止日期 (YYYY-MM-DD)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('priority')
        .setDescription('優先級')
        .setRequired(false)
        .addChoices(
          { name: '🔴 高', value: '高' },
          { name: '🟡 中', value: '中' },
          { name: '⚪ 低', value: '低' }
        )
    )
    .addStringOption(option =>
      option
        .setName('summary')
        .setDescription('任務說明')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const title = interaction.options.getString('title');
      const deadline = interaction.options.getString('deadline');
      const priority = interaction.options.getString('priority') || '中';
      const summary = interaction.options.getString('summary');

      // 驗證日期格式（如果有填）
      if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
        await interaction.editReply({
          content: '❌ 日期格式錯誤，請使用 YYYY-MM-DD 格式（例：2026-02-15）'
        });
        return;
      }

      const result = await createTaskPage({
        title,
        type: 'task',
        startDate: deadline || null,
        summary,
        priority
      });

      const priorityEmoji = priority === '高' ? '🔴' : priority === '中' ? '🟡' : '⚪';

      const embed = new EmbedBuilder()
        .setColor(0x00D26A)
        .setTitle('✅ 任務已新增')
        .addFields(
          { name: '📋 任務名稱', value: title, inline: false },
          { name: '⏰ 截止日期', value: deadline || '未設定', inline: true },
          { name: '📊 優先級', value: `${priorityEmoji} ${priority}`, inline: true }
        )
        .setTimestamp();

      if (summary) {
        embed.addFields({ name: '📝 說明', value: summary, inline: false });
      }

      embed.addFields({
        name: '🔗 Notion 連結',
        value: `[點擊開啟](${result.url})`,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('新增任務失敗:', error);
      await interaction.editReply({
        content: `❌ 新增失敗：${error.message}`
      });
    }
  }
};
