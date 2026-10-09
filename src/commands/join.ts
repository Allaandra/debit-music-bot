import { Command } from '../types';
import { joinVoiceChannel } from '@discordjs/voice';
import { prisma } from '../database';

export const command: Command = {
    name: '!join',
    execute: async (message) => {
        const voiceChannel = message.member?.voice.channel;
        
        if (!voiceChannel) {
            message.reply('Вы должны находиться в голосовом канале');
            return;
        }

        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guildId!,
                adapterCreator: message.guild!.voiceAdapterCreator,
            });

            // Используем Prisma для upsert (создать или обновить сессию)
            await prisma.activeSession.upsert({
                where: { userId: message.author.id },
                update: {
                    guildId: message.guildId!,
                    channelId: voiceChannel.id
                },
                create: {
                    userId: message.author.id,
                    guildId: message.guildId!,
                    channelId: voiceChannel.id
                }
            });

            message.reply('✅ Бот успешно подключился! Ваша сессия привязана к веб-панели.');
            
        }
        catch (error) {
            console.error('Ошибка при входе в канал:', error);
            message.reply('Произошла системная ошибка при подключении.');
        }
    }
};