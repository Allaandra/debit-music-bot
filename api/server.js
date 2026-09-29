"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startApi = startApi;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const voice_1 = require("@discordjs/voice");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const voice_2 = require("@discordjs/voice");
const player_1 = __importDefault(require("./routes/player"));
const tracks_1 = __importDefault(require("./routes/tracks"));
const playlists_1 = __importDefault(require("./routes/playlists"));
const files_1 = __importDefault(require("./routes/files"));
// @ts-ignore
const spotify = (0, spotify_url_info_1.default)(fetch);
function createNormalizedResource(input) {
    const isFile = typeof input === 'string';
    const args = [
        '-i', isFile ? input : 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-f', 'ogg',
        '-af', 'dynaudnorm=f=200:g=5:r=0.9', // Смарт-нормализатор громкости
        'pipe:1'
    ];
    const ffmpeg = (0, child_process_1.spawn)(ffmpeg_static_1.default, args, { stdio: ['pipe', 'pipe', 'ignore'] });
    if (!isFile) {
        input.pipe(ffmpeg.stdin);
        // Закрываем ffmpeg, если yt-dlp умер
        input.on('error', () => ffmpeg.kill());
        input.on('close', () => ffmpeg.kill());
    }
    ffmpeg.on('error', (err) => console.error('FFmpeg ошибка:', err.message));
    return (0, voice_1.createAudioResource)(ffmpeg.stdout, { inputType: voice_2.StreamType.OggOpus });
}
function startApi(client) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use('/api', (0, player_1.default)(client));
    app.use('/api/tracks', (0, tracks_1.default)());
    app.use('/api/playlists', (0, playlists_1.default)());
    app.use('/api', (0, files_1.default)());
    // Раздача статики React-приложения
    app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'frontend', 'dist')));
    app.get(/.*/, (req, res) => {
        res.sendFile(path_1.default.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    });
    const PORT = 3001;
    app.listen(PORT, () => {
        console.log(`Express-сервер слушает порт ${PORT}`);
    });
}
