/**
 * Interaction Create 事件處理
 */

import { handleButtonInteraction, isCalendarButton } from '../handlers/buttonHandler.js';
import * as logger from '../utils/logger.js';

/**
 * 處理互動事件
 * @param {import('discord.js').Interaction} interaction - Discord 互動
 */
export async function handleInteractionCreate(interaction) {
  // 只處理按鈕互動
  if (!interaction.isButton()) {
    return;
  }

  logger.discordEvent('interactionCreate', {
    type: 'button',
    customId: interaction.customId,
    userId: interaction.user.id
  });

  try {
    // 檢查是否為行事曆相關按鈕
    if (isCalendarButton(interaction.customId)) {
      await handleButtonInteraction(interaction);
      return;
    }

    // 未知的按鈕類型
    logger.warn('未處理的按鈕互動', { customId: interaction.customId });

  } catch (error) {
    logger.error('互動處理失敗', error);

    // 嘗試回覆錯誤
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ 處理互動時發生錯誤',
          components: []
        });
      } else {
        await interaction.reply({
          content: '❌ 處理互動時發生錯誤',
          ephemeral: true
        });
      }
    } catch {
      // 忽略回覆失敗
    }
  }
}

export default handleInteractionCreate;
