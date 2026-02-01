/**
 * /today 指令 - 查看今日行程與任務
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queryCalendarEvents, queryTasks } from '../services/notionQuery.js';

/**
 * 取得台北時區的今天日期
 */
function getTaipeiToday() {
  const options = {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const formatter = new Intl.DateTimeFormat('zh-TW', options);
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

/**
 * 取得星期幾
 */
function getWeekday(dateStr) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(dateStr + 'T00:00:00+08:00');
  return weekdays[date.getDay()];
}

export default {
  data: new SlashCommandBuilder()
    .setName('today')
    .setDescription('查看今日行程與任務'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const todayStr = getTaipeiToday();
      const weekday = getWeekday(todayStr);

      const [events, tasks] = await Promise.all([
        queryCalendarEvents(todayStr),
        queryTasks(todayStr)
      ]);

      // 篩選今日活動
      const todayEvents = events.filter(e => e.date === todayStr);
      const overdueEvents = events.filter(e => e.isOverdue);

      // 篩選今日截止任務
      const todayTasks = tasks.filter(t => t.deadline === todayStr);
      const overdueTasks = tasks.filter(t => t.isOverdue);

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`📅 今日概覽｜${todayStr}（${weekday}）`)
        .setTimestamp();

      // 今日活動
      let eventText = '';
      if (todayEvents.length === 0 && overdueEvents.length === 0) {
        eventText = '今天沒有活動安排 🎉';
      } else {
        const lines = [];

        if (overdueEvents.length > 0) {
          lines.push('⚠️ **逾期活動：**');
          overdueEvents.forEach(e => {
            const time = e.time || '全天';
            lines.push(`• ~~${e.date}~~ ${time}　${e.title}`);
          });
        }

        if (todayEvents.length > 0) {
          if (overdueEvents.length > 0) lines.push('');
          lines.push('📌 **今日活動：**');
          todayEvents.forEach(e => {
            const time = e.time || '全天';
            lines.push(`• ${time}　${e.title}`);
          });
        }

        eventText = lines.join('\n');
      }
      embed.addFields({ name: `🗓️ 活動（今日 ${todayEvents.length} / 逾期 ${overdueEvents.length}）`, value: eventText });

      // 今日任務
      let taskText = '';
      if (todayTasks.length === 0 && overdueTasks.length === 0) {
        taskText = '今天沒有待處理任務 🎉';
      } else {
        const lines = [];

        if (overdueTasks.length > 0) {
          lines.push('⚠️ **逾期任務：**');
          overdueTasks.slice(0, 5).forEach(t => {
            const priority = t.priority === '高' ? '🔴' : t.priority === '中' ? '🟡' : '⚪';
            lines.push(`${priority} ~~${t.deadline}~~ ${t.title}`);
          });
          if (overdueTasks.length > 5) {
            lines.push(`...還有 ${overdueTasks.length - 5} 項逾期`);
          }
        }

        if (todayTasks.length > 0) {
          if (overdueTasks.length > 0) lines.push('');
          lines.push('📋 **今日截止：**');
          todayTasks.forEach(t => {
            const priority = t.priority === '高' ? '🔴' : t.priority === '中' ? '🟡' : '⚪';
            const status = t.status === '進行中' ? ' [進行中]' : '';
            lines.push(`${priority} ${t.title}${status}`);
          });
        }

        taskText = lines.join('\n');
      }
      embed.addFields({ name: `✅ 任務（今日 ${todayTasks.length} / 逾期 ${overdueTasks.length}）`, value: taskText });

      // 統計
      const totalPending = tasks.length;
      const highPriority = tasks.filter(t => t.priority === '高').length;
      embed.addFields({
        name: '📊 總覽',
        value: `待處理任務：${totalPending} 項（高優先：${highPriority} 項）`,
        inline: false
      });

      embed.setFooter({ text: 'Cyclone Discord Bot' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('查詢今日資料失敗:', error);
      await interaction.editReply({
        content: `❌ 查詢失敗：${error.message}`
      });
    }
  }
};
