import { Command } from '../types';
import { getVoiceConnection } from '@discordjs/voice';
import { prisma } from '../database';

export const command: Command = {
    name: '!leave',
    execute: async (message) => {
        try {
            const connection = getVoiceConnection(message.guildId!);
            
            if (connection) {
                connection.destroy();
            }

            // Удаляем сессию пользователя, чтобы сбросить панель
            await prisma.activeSession.deleteMany({
                where: { userId: message.author.id }
            });

            // Останавливаем плеер и очищаем очередь через PlayerManager
            const playerManager = (await import('../services/PlayerService')).PlayerManager;
            const guildPlayer = playerManager.getPlayer(message.guildId!);
            guildPlayer.stop();

            message.reply('🛑 Бот отключился. Очередь и сессия веб-панели очищены.');
            
        }
        catch (error) {
            console.error('Ошибка при выходе из канала:', error);
            message.reply('Произошла системная ошибка при отключении.');
        }
    }
};
