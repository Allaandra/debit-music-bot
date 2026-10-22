import { Command } from '../types';
import { PlayerManager } from '../services/PlayerService';
import { prisma } from '../database';

export const command: Command = {
    name: '!leave',
    execute: async (message) => {
        const guildId = message.guildId;
        if (!guildId) return;

        try {
            // 1. Принудительно останавливаем воспроизведение, убиваем FFmpeg процессы и отключаем плеер
            const player = PlayerManager.getPlayer(guildId);
            player.destroy();

            // 2. Сбрасываем активные сессии гильдии в базе данных
            await prisma.activeSession.deleteMany({
                where: { guildId }
            });

            message.reply('🛑 Бот отключился от голосового канала. Воспроизведение остановлено, а очередь очищена.');
        } catch (error) {
            console.error('Ошибка при отключении бота:', error);
            message.reply('Произошла системная ошибка при отключении.');
        }
    }
};
