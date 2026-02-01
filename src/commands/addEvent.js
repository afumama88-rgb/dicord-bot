/**
 * /add-event 指令 - 快速新增活動到 Notion
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createTaskPage } from '../services/notion.js';

export default {
  data: new SlashCommandBuilder()
    .setName('add-event')
    .setDescription('新增活動到 Notion 行事曆')
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('活動名稱')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('日期 (YYYY-MM-DD)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('時間 (HH:MM)，不填則為全天活動')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('location')
        .setDescription('地點')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('summary')
        .setDescription('備註說明')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const title = interaction.options.getString('title');
      const date = interaction.options.getString('date');
      const time = interaction.options.getString('time');
      const location = interaction.options.getString('location');
      const summary = interaction.options.getString('summary');

      // 驗證日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        await interaction.editReply({
          content: '❌ 日期格式錯誤，請使用 YYYY-MM-DD 格式（例：2026-02-15）'
        });
        return;
      }

      // 驗證時間格式（如果有填）
      if (time && !/^\d{2}:\d{2}$/.test(time)) {
        await interaction.editReply({
          content: '❌ 時間格式錯誤，請使用 HH:MM 格式（例：14:30）'
        });
        return;
      }

      // 組合日期時間
      const startDate = time ? `${date}T${time}:00` : date;

      const result = await createTaskPage({
        title,
        type: 'event',
        startDate,
        location,
        summary,
        priority: '中'
      });

      const embed = new EmbedBuilder()
        .setColor(0x00D26A)
        .setTitle('✅ 活動已新增')
        .addFields(
          { name: '📌 活動名稱', value: title, inline: false },
          { name: '📅 日期', value: time ? `${date} ${time}` : `${date}（全天）`, inline: true },
          { name: '📍 地點', value: location || '未設定', inline: true }
        )
        .setTimestamp();

      if (summary) {
        embed.addFields({ name: '📝 備註', value: summary, inline: false });
      }

      embed.addFields({
        name: '🔗 Notion 連結',
        value: `[點擊開啟](${result.url})`,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('新增活動失敗:', error);
      await interaction.editReply({
        content: `❌ 新增失敗：${error.message}`
      });
    }
  }
};
