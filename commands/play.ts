import { Command } from '../types';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import path from 'path';

export const command: Command = {
    name: '!play',
    execute: (message) => {
        const voiceChannel = message.member?.voice.channel;
        
        if (!voiceChannel) {
            message.reply('Ошибка: Вы должны находиться в голосовом канале.');
            return;
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guildId!,
                adapterCreator: message.guild!.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            // Обрати внимание: путь изменен, так как файл теперь лежит в папке commands
            const resource = createAudioResource(path.join(__dirname, '..', 'sounds', 'test.mp3'));

            player.play(resource);
            connection.subscribe(player);

            player.once(AudioPlayerStatus.Playing, () => {
                message.reply('Аудиопоток успешно запущен.');
            });
        } catch (error) {
            console.error('Ошибка потока:', error);
            message.reply('Произошла системная ошибка.');
        }
    }
};