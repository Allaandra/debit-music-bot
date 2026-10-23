import { Command } from '../types';
import { PlayerManager } from '../services/PlayerService';
import { prisma } from '../database';

export const command: Command = {
    name: '!leave',
    execute: async (message) => {
        const guildId = message.guildId;
        if (!guildId) return;

        try {
            // 1. Принудительно останавливаем воспроизведение, убиваем FFmpeg процессы и рассылаем stateUpdate по WebSocket
            const player = PlayerManager.getPlayer(guildId);
            player.onBotDisconnected();

            // 2. Удаляем сессию самого бота, если она была записана
            if (message.client.user?.id) {
                await prisma.activeSession.deleteMany({
                    where: { userId: message.client.user.id }
                });
            }

            message.reply('🛑 Бот отключился от голосового канала. Воспроизведение остановлено, а очередь очищена.');
        } catch (error) {
            console.error('Ошибка при отключении бота:', error);
            message.reply('Произошла системная ошибка при отключении.');
        }
    }
};
