import { Command } from '../types';
import { joinVoiceChannel } from '@discordjs/voice';
import { prisma } from '../database';
import { PlayerManager } from '../services/PlayerService';

export const command: Command = {
    name: '!join',
    execute: async (message) => {
        const voiceChannel = message.member?.voice.channel;
        
        if (!voiceChannel) {
            message.reply('⚠️ Вы должны находиться в голосовом канале!');
            return;
        }

        const guildId = message.guildId!;

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: message.guild!.voiceAdapterCreator,
            });

            // Привязываем соединение к плееру гильдии
            const player = PlayerManager.getPlayer(guildId);
            player.connection = connection;

            // Используем Prisma для upsert (создать или обновить сессию)
            await prisma.activeSession.upsert({
                where: { userId: message.author.id },
                update: {
                    guildId,
                    channelId: voiceChannel.id
                },
                create: {
                    userId: message.author.id,
                    guildId,
                    channelId: voiceChannel.id
                }
            });

            message.reply('✅ Бот успешно подключился к вашему каналу! Сессия привязана к веб-панели.');
        } catch (error) {
            console.error('Ошибка при входе в канал:', error);
            message.reply('Произошла системная ошибка при подключении.');
        }
    }
};
