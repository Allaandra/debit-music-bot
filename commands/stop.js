"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = void 0;
const voice_1 = require("@discordjs/voice");
exports.command = {
    name: '!stop',
    execute: (message) => {
        const connection = (0, voice_1.getVoiceConnection)(message.guildId);
        if (connection) {
            connection.destroy();
            message.reply('Отключение завершено');
        }
        else {
            message.reply('Активное подключение не обнаружено');
        }
    }
};
