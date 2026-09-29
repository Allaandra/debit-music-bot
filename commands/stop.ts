import { Command } from '../types';
import { getVoiceConnection } from '@discordjs/voice';

export const command: Command = {
    name: '!stop',
    execute: (message) => {
        const connection = getVoiceConnection(message.guildId!);

        if (connection) {
            connection.destroy();
            message.reply('Отключение завершено');
        } else {
            message.reply('Активное подключение не обнаружено');
        }
    }
};