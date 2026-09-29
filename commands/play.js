"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = void 0;
const voice_1 = require("@discordjs/voice");
const path_1 = __importDefault(require("path"));
exports.command = {
    name: '!play',
    execute: (message) => {
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            message.reply('Ошибка: Вы должны находиться в голосовом канале.');
            return;
        }
        try {
            const connection = (0, voice_1.joinVoiceChannel)({
                channelId: voiceChannel.id,
                guildId: message.guildId,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            const player = (0, voice_1.createAudioPlayer)();
            // Обрати внимание: путь изменен, так как файл теперь лежит в папке commands
            const resource = (0, voice_1.createAudioResource)(path_1.default.join(__dirname, '..', 'sounds', 'test.mp3'));
            player.play(resource);
            connection.subscribe(player);
            player.once(voice_1.AudioPlayerStatus.Playing, () => {
                message.reply('Аудиопоток успешно запущен.');
            });
        }
        catch (error) {
            console.error('Ошибка потока:', error);
            message.reply('Произошла системная ошибка.');
        }
    }
};
