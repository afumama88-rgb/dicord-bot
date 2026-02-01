/**
 * Interaction Create 事件處理
 */

import { handleButtonInteraction, isCalendarButton } from '../handlers/buttonHandler.js';
import { getCommand } from '../commands/index.js';
import * as logger from '../utils/logger.js';

/**
 * 處理互動事件
 * @param {import('discord.js').Interaction} interaction - Discord 互動
 */
export async function handleInteractionCreate(interaction) {
  // 處理 Slash 指令
  if (interaction.isChatInputCommand()) {
    logger.discordEvent('interactionCreate', {
      type: 'command',
      commandName: interaction.commandName,
      userId: interaction.user.id
    });

    const command = getCommand(interaction.commandName);

    if (!command) {
      logger.warn('未知的指令', { commandName: interaction.commandName });
      await interaction.reply({
        content: '❌ 未知的指令',
        ephemeral: true
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error('指令執行失敗', error);

      const errorMessage = '❌ 執行指令時發生錯誤';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
    return;
  }

  // 處理按鈕互動
  if (interaction.isButton()) {
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
      logger.error('按鈕互動處理失敗', error);

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
}

export default handleInteractionCreate;
