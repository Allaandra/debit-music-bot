import { Command } from '../types';
import { joinVoiceChannel } from '@discordjs/voice';
import { openDb } from '../database';

export const command: Command = {
    name: '!joins',
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

            // Подключаемся к базе и записываем сессию
            const db = await openDb();
            
            // Используем хитрый апсерт, чтобы перезаписывать старую сессию
            await db.run(
                `INSERT INTO active_sessions (userId, guildId, channelId) 
                 VALUES (?, ?, ?)
                 ON CONFLICT(userId) DO UPDATE SET 
                 guildId = excluded.guildId, 
                 channelId = excluded.channelId`,
                [message.author.id, message.guildId, voiceChannel.id]
            );

            // Заготовка на будущее: здесь мы будем сохранять сессию пользователя
            message.reply(`ID для будущей базы данных: ${message.author.id}`);
            
        }
        catch (error) {
            console.error('Ошибка при входе в канал:', error);
            message.reply('Произошла системная ошибка');
        }
    }
};