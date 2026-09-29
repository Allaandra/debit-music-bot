"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerManager = exports.GuildPlayer = void 0;
const voice_1 = require("@discordjs/voice");
const child_process_1 = require("child_process");
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const youtube_dl_exec_1 = __importDefault(require("youtube-dl-exec"));
const play_dl_1 = __importDefault(require("play-dl"));
const path_1 = __importDefault(require("path"));
// @ts-ignore
const spotify = (0, spotify_url_info_1.default)(fetch);
class GuildPlayer {
    guildId;
    player;
    connection = null;
    queue = [];
    history = [];
    currentTrack = null;
    isPlaying = false;
    isPaused = false;
    // For seek tracking
    startTimestamp = 0;
    seekOffset = 0;
    currentFfmpegProcess = null;
    constructor(guildId) {
        this.guildId = guildId;
        this.player = (0, voice_1.createAudioPlayer)();
        this.player.on('error', (err) => {
            console.error(`Player error on guild ${this.guildId}:`, err.message);
            this.playNext();
        });
        this.player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle' && oldState.status !== 'idle') {
                if (this.isPaused)
                    return; // Не переключаем трек, если мы просто поставили на паузу
                this.playNext();
            }
        });
    }
    async resolveTrack(type, query) {
        let title = query;
        let artist = 'Unknown';
        let duration = 0;
        let streamUrl = query;
        if (type === 'local') {
            title = path_1.default.basename(query, path_1.default.extname(query));
            try {
                const mm = await Promise.resolve().then(() => __importStar(require('music-metadata')));
                const metadata = await mm.parseFile(path_1.default.join(__dirname, '..', 'sounds', query));
                if (metadata.format.duration)
                    duration = Math.round(metadata.format.duration);
                if (metadata.common.title)
                    title = metadata.common.title;
                if (metadata.common.artist)
                    artist = metadata.common.artist;
            }
            catch (e) { }
        }
        else if (type === 'url') {
            let watchUrl = query;
            if (query.includes('spotify.com')) {
                const data = await spotify.getPreview(query);
                const searchResult = await play_dl_1.default.search(`${data.title} ${data.artist}`, { limit: 1 });
                if (searchResult && searchResult.length > 0)
                    watchUrl = searchResult[0].url;
            }
            else if (!query.includes('youtube.com') && !query.includes('youtu.be') && !query.includes('soundcloud.com')) {
                const searchResult = await play_dl_1.default.search(query, { limit: 1 });
                if (searchResult && searchResult.length > 0)
                    watchUrl = searchResult[0].url;
            }
            // Используем yt-dlp для получения чистой прямой ссылки на аудио
            const info = await (0, youtube_dl_exec_1.default)(watchUrl, { dumpJson: true, f: 'bestaudio', noWarnings: true });
            title = info.title || query;
            artist = info.uploader || 'Unknown';
            streamUrl = info.url || watchUrl; // Свежая прямая ссылка!
            duration = info.duration || 0;
        }
        return { type, query, title, artist, duration, url: streamUrl };
    }
    async play(track, offsetSeconds = 0) {
        if (offsetSeconds === 0 && this.currentTrack) {
            this.history.push(this.currentTrack);
        }
        this.stopCurrentProcesses();
        this.currentTrack = track;
        this.seekOffset = offsetSeconds;
        this.startTimestamp = Date.now();
        this.isPlaying = true;
        this.isPaused = false;
        let input = null;
        if (track.type === 'local') {
            input = path_1.default.join(__dirname, '..', 'sounds', track.query);
        }
        else {
            // track.url теперь содержит ПРЯМУЮ ссылку на медиа-файл (googlevideo.com/...)
            input = track.url;
        }
        const isFileOrUrl = typeof input === 'string';
        const isUrl = isFileOrUrl && input.startsWith('http');
        const ffmpegArgs = [];
        if (isUrl) {
            // Флаги для автоматического переподключения (спасает от обрыва стрима через 1 минуту)
            ffmpegArgs.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
        }
        // Для локальных файлов делаем быстрый seek до входа (быстро и без ошибок)
        if (isFileOrUrl && !isUrl && offsetSeconds > 0) {
            ffmpegArgs.push('-ss', offsetSeconds.toString());
        }
        ffmpegArgs.push('-i', input);
        // Для URL делаем точный seek после входа (медленнее, но не ломает HTTP потоки)
        if (isUrl && offsetSeconds > 0) {
            ffmpegArgs.push('-ss', offsetSeconds.toString());
        }
        ffmpegArgs.push('-c:a', 'libopus', '-b:a', '128k', '-f', 'ogg', '-af', 'dynaudnorm=f=200:g=5:r=0.9', 'pipe:1');
        // Включаем stderr (pipe), чтобы видеть реальные ошибки ffmpeg в консоли, если он падает
        this.currentFfmpegProcess = (0, child_process_1.spawn)(ffmpeg_static_1.default, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        this.currentFfmpegProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Error'))
                console.error('FFmpeg Error:', msg);
        });
        this.currentFfmpegProcess.on('error', (err) => console.error('FFmpeg spawn error:', err.message));
        const resource = (0, voice_1.createAudioResource)(this.currentFfmpegProcess.stdout, { inputType: voice_1.StreamType.OggOpus });
        this.player.play(resource);
    }
    stopCurrentProcesses() {
        if (this.currentFfmpegProcess) {
            this.currentFfmpegProcess.kill();
            this.currentFfmpegProcess = null;
        }
    }
    async playNext() {
        if (this.queue.length > 0) {
            const nextTrackDB = this.queue.shift();
            try {
                // Если трек из базы, у него может не быть resolved url
                const nextTrack = await this.resolveTrack(nextTrackDB.type, nextTrackDB.query);
                await this.play(nextTrack);
            }
            catch (err) {
                console.error('Не удалось разрешить следующий трек, пропускаем:', err.message);
                this.playNext(); // Рекурсивно переходим к следующему, если текущий битый
            }
        }
        else {
            this.currentTrack = null;
            this.isPlaying = false;
            this.stopCurrentProcesses();
        }
    }
    async playPrevious() {
        if (this.history.length > 0) {
            const prevTrack = this.history.pop();
            if (this.currentTrack) {
                // Возвращаем текущий трек в начало очереди, чтобы не потерять
                this.queue.unshift(this.currentTrack);
            }
            try {
                // Так как трек из истории мог протухнуть (YouTube ссылка),
                // лучше разрезолвить его заново, если это url
                const resolved = await this.resolveTrack(prevTrack.type, prevTrack.query);
                // Чтобы не зациклить history.push внутри play,
                // мы временно обнуляем currentTrack
                this.currentTrack = null;
                await this.play(resolved);
            }
            catch (err) {
                console.error('Не удалось разрешить предыдущий трек:', err);
            }
        }
        else {
            this.seek(0); // Если истории нет, просто начинаем трек сначала
        }
    }
    pause() {
        if (!this.isPlaying || this.isPaused)
            return;
        this.isPaused = true;
        // Запоминаем, на какой секунде мы остановились
        this.seekOffset = this.seekOffset + Math.floor((Date.now() - this.startTimestamp) / 1000);
        // Убиваем ffmpeg, чтобы он не забил буфер и не упал
        this.stopCurrentProcesses();
        // Останавливаем плеер (сработает событие idle, но мы перехватим его)
        this.player.stop();
    }
    async resume() {
        if (!this.isPaused || !this.currentTrack)
            return;
        this.isPaused = false;
        let trackToPlay = this.currentTrack;
        if (trackToPlay.type === 'url') {
            try {
                // Если ссылка протухла за время паузы, получаем свежую
                trackToPlay = await this.resolveTrack('url', trackToPlay.query);
            }
            catch (e) {
                console.error('Failed to re-resolve track on resume', e);
            }
        }
        // Запускаем трек заново с сохраненной секунды
        this.play(trackToPlay, this.seekOffset);
    }
    seek(seconds) {
        if (this.currentTrack) {
            this.play(this.currentTrack, seconds);
        }
    }
    getStatus() {
        let elapsed = 0;
        if (this.currentTrack && this.isPlaying && !this.isPaused) {
            elapsed = this.seekOffset + Math.floor((Date.now() - this.startTimestamp) / 1000);
        }
        else if (this.currentTrack && this.isPaused) {
            elapsed = this.seekOffset; // Точное время остановки
        }
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTrack: this.currentTrack,
            elapsed,
            queueLength: this.queue.length
        };
    }
}
exports.GuildPlayer = GuildPlayer;
class PlayerManager {
    static players = new Map();
    static getPlayer(guildId) {
        if (!this.players.has(guildId)) {
            this.players.set(guildId, new GuildPlayer(guildId));
        }
        return this.players.get(guildId);
    }
}
exports.PlayerManager = PlayerManager;
