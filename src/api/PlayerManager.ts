import { AudioPlayer, createAudioPlayer, VoiceConnection, joinVoiceChannel, createAudioResource, StreamType } from '@discordjs/voice';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import youtubedl from 'youtube-dl-exec';
import play from 'play-dl';
import spotifyUrlInfo from 'spotify-url-info';
import path from 'path';

// @ts-ignore
const spotify = spotifyUrlInfo(fetch);

export interface Track {
    type: 'local' | 'url';
    query: string;
    title: string;
    artist: string;
    duration: number; // in seconds
    url?: string; // Resolved youtube url
    thumbnail?: string; // URL обложки
}

export class GuildPlayer {
    guildId: string;
    player: AudioPlayer;
    connection: VoiceConnection | null = null;
    
    queue: Track[] = [];
    originalQueue: Track[] = [];
    activePlaylistName: string = 'Main Library'; // Для восстановления после шафла
    history: Track[] = [];
    currentTrack: Track | null = null;
    
    isPlaying: boolean = false;
    isPaused: boolean = false;
    
    shuffle: boolean = false;
    repeatMode: 'off' | 'track' | 'all' = 'off';
    
    // For seek tracking
    startTimestamp: number = 0;
    seekOffset: number = 0; 
    
    private currentFfmpegProcess: any = null;

    constructor(guildId: string) {
        this.guildId = guildId;
        this.player = createAudioPlayer();
        
        this.player.on('error', (err) => {
            console.error(`Player error on guild ${this.guildId}:`, err.message);
            this.playNext();
        });

        this.player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle' && oldState.status !== 'idle') {
                if (this.isPaused) return; // Не переключаем трек, если мы просто поставили на паузу
                this.playNext();
            }
        });
    }

    async resolveTrack(type: 'local' | 'url', query: string): Promise<Track> {
        let title = query;
        let artist = 'Unknown';
        let duration = 0;
        let streamUrl = query;
        let thumbnail = undefined;

        if (type === 'local') {
            title = path.basename(query, path.extname(query));
            try {
                const mm = await import('music-metadata');
                const metadata = await mm.parseFile(path.join(__dirname, '..', '..', 'sounds', query));
                if (metadata.format.duration) duration = Math.round(metadata.format.duration);
                if (metadata.common.title) title = metadata.common.title;
                if (metadata.common.artist) artist = metadata.common.artist;
            } catch (e) {}
        } else if (type === 'url') {
            let watchUrl = query;
            if (query.includes('spotify.com') || query.startsWith('spotify:')) {
                const data = await spotify.getPreview(query);
                const searchResult = await play.search(`${data.title} ${data.artist}`, { limit: 1 });
                if (searchResult && searchResult.length > 0) watchUrl = searchResult[0].url;
                title = data.title;
                artist = data.artist;
                thumbnail = data.image; // Use Spotify cover art if available
            } else if (!query.includes('youtube.com') && !query.includes('youtu.be') && !query.includes('soundcloud.com')) {
                const searchResult = await play.search(query, { limit: 1 });
                if (searchResult && searchResult.length > 0) watchUrl = searchResult[0].url;
            }

            // Ищем прямую ссылку через yt-dlp
            const info = await youtubedl(watchUrl, { dumpJson: true, f: 'bestaudio', noWarnings: true } as any);
            if (!title || title === query) title = (info as any).title || query;
            if (artist === 'Unknown') artist = (info as any).uploader || 'Unknown';
            streamUrl = (info as any).url || watchUrl;
            if (!duration) duration = (info as any).duration || 0;
            if (!thumbnail) thumbnail = (info as any).thumbnail;
        }

        return { type, query, title, artist, duration, url: streamUrl, thumbnail };
    }

    async play(track: Track, offsetSeconds: number = 0) {
        if (offsetSeconds === 0 && this.currentTrack) {
            this.history.push(this.currentTrack);
        }

        this.stopCurrentProcesses();
        
        this.currentTrack = track;
        this.seekOffset = offsetSeconds;
        this.startTimestamp = Date.now();
        this.isPlaying = true;
        this.isPaused = false;

        let input: any = null;

        if (track.type === 'local') {
            input = path.join(__dirname, '..', '..', 'sounds', track.query);
        } else {
            // track.url теперь содержит ПРЯМУЮ ссылку на медиа-файл (googlevideo.com/...)
            input = track.url;
        }

        const isFileOrUrl = typeof input === 'string';
        const isUrl = isFileOrUrl && input.startsWith('http');
        const ffmpegArgs = [];
        
        if (isUrl) {
            // Флаги для автоматического переподключения (спасает от обрыва стрима через 1 минуту)
            ffmpegArgs.push(
                '-reconnect', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '5',
                '-reconnect_on_network_error', '1',
                '-reconnect_on_http_error', '4xx,5xx'
            );
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

        ffmpegArgs.push(
            '-c:a', 'libopus',
            '-b:a', '128k',
            '-f', 'ogg',
            '-af', 'dynaudnorm=f=200:g=5:r=0.9',
            'pipe:1'
        );
        
        // Включаем stderr (pipe), чтобы видеть реальные ошибки ffmpeg в консоли
        this.currentFfmpegProcess = spawn(ffmpegPath as string, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        this.currentFfmpegProcess.stderr.on('data', (data: any) => {
            const msg = data.toString();
            // Игнорируем штатные отключения от YouTube (10054 Connection reset) и реконнекты
            if (msg.includes('Error') && !msg.includes('-10054') && !msg.includes('Will reconnect')) {
                console.error('FFmpeg Error:', msg);
            }
        });

        this.currentFfmpegProcess.on('error', (err: any) => console.error('FFmpeg spawn error:', err.message));
        
        const resource = createAudioResource(this.currentFfmpegProcess.stdout, { inputType: StreamType.OggOpus });
        this.player.play(resource);
    }

    stopCurrentProcesses() {
        if (this.currentFfmpegProcess) {
            this.currentFfmpegProcess.kill();
            this.currentFfmpegProcess = null;
        }
    }

    async playNext() {
        if (this.repeatMode === 'track' && this.currentTrack) {
            // Если включен повтор одного трека
            try {
                const nextTrack = await this.resolveTrack(this.currentTrack.type, this.currentTrack.query);
                await this.play(nextTrack);
            } catch (err: any) {
                console.error('Не удалось разрешить трек для повтора:', err.message);
                this.repeatMode = 'off'; // Выключаем во избежание бесконечного цикла ошибок
                this.playNext();
            }
            return;
        }

        if (this.queue.length > 0) {
            if (this.repeatMode === 'all' && this.currentTrack) {
                // Если повтор всей очереди, возвращаем текущий трек в конец
                this.queue.push(this.currentTrack);
                if (this.shuffle && this.originalQueue) {
                    this.originalQueue.push(this.currentTrack);
                }
            }
            const nextTrackDB = this.queue.shift()!;
            try {
                // Если трек из базы, у него может не быть resolved url
                const nextTrack = await this.resolveTrack(nextTrackDB.type, nextTrackDB.query);
                await this.play(nextTrack);
            } catch (err: any) {
                console.error('Не удалось разрешить следующий трек, пропускаем:', err.message);
                this.playNext(); // Рекурсивно переходим к следующему, если текущий битый
            }
        } else {
            if (this.repeatMode === 'all' && this.currentTrack) {
                // Очередь пуста, но включен повтор всего. Значит, играем этот же трек
                try {
                    const nextTrack = await this.resolveTrack(this.currentTrack.type, this.currentTrack.query);
                    await this.play(nextTrack);
                } catch (e) {
                    this.currentTrack = null;
                    this.isPlaying = false;
                    this.stopCurrentProcesses();
                }
            } else {
                this.currentTrack = null;
                this.isPlaying = false;
                this.stopCurrentProcesses();
            }
        }
    }

    async playPrevious() {
        if (this.history.length > 0) {
            const prevTrack = this.history.pop()!;
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
            } catch (err) {
                console.error('Не удалось разрешить предыдущий трек:', err);
            }
        } else {
            this.seek(0); // Если истории нет, просто начинаем трек сначала
        }
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        if (this.shuffle) {
            // Сохраняем оригинальный порядок
            this.originalQueue = [...this.queue];
            // Алгоритм Фишера-Йетса
            for (let i = this.queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
            }
        } else {
            // Возвращаем оригинальный порядок, убирая те, что уже проиграны
            // (это грубое восстановление, но рабочее для большинства кейсов)
            if (this.originalQueue.length > 0) {
                // Если мы что-то проиграли в шафле, оно ушло из originalQueue?
                // Нет, originalQueue не меняется при playNext, кроме repeat=all.
                // Так что если мы просто вернем originalQueue, мы можем повторно сыграть треки.
                // Лучший способ: найти текущий трек в оригинальной очереди и взять всё, что после него.
                // Но так как очередь могла измениться, просто вернем оригинал. 
                // Для идеала нужно фильтровать проигранное, но пока просто вернем как было.
                this.queue = [...this.originalQueue];
            }
        }
    }

    toggleRepeat() {
        if (this.repeatMode === 'off') this.repeatMode = 'all';
        else if (this.repeatMode === 'all') this.repeatMode = 'track';
        else this.repeatMode = 'off';
    }

    pause() {
        if (!this.isPlaying || this.isPaused) return;
        this.isPaused = true;
        // Запоминаем, на какой секунде мы остановились
        this.seekOffset = this.seekOffset + Math.floor((Date.now() - this.startTimestamp) / 1000);
        
        // Убиваем ffmpeg, чтобы он не забил буфер и не упал
        this.stopCurrentProcesses();
        // Останавливаем плеер (сработает событие idle, но мы перехватим его)
        this.player.stop(); 
    }

    async resume() {
        if (!this.isPaused || !this.currentTrack) return;
        this.isPaused = false;
        
        let trackToPlay = this.currentTrack;
        if (trackToPlay.type === 'url') {
            try {
                // Если ссылка протухла за время паузы, получаем свежую
                trackToPlay = await this.resolveTrack('url', trackToPlay.query);
            } catch (e) {
                console.error('Failed to re-resolve track on resume', e);
            }
        }
        
        // Запускаем трек заново с сохраненной секунды
        this.play(trackToPlay, this.seekOffset);
    }

    seek(seconds: number) {
        if (this.currentTrack) {
            this.play(this.currentTrack, seconds);
        }
    }

    getStatus() {
        let elapsed = 0;
        if (this.currentTrack && this.isPlaying && !this.isPaused) {
            elapsed = this.seekOffset + Math.floor((Date.now() - this.startTimestamp) / 1000);
        } else if (this.currentTrack && this.isPaused) {
            elapsed = this.seekOffset; // Точное время остановки
        }

        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTrack: this.currentTrack,
            elapsed,
            queue: this.queue,
            activePlaylistName: this.activePlaylistName,        // массив следующих треков для UI
            queueLength: this.queue.length,
            shuffle: this.shuffle,
            repeatMode: this.repeatMode
        };
    }
}

export class PlayerManager {
    static players: Map<string, GuildPlayer> = new Map();

    static getPlayer(guildId: string): GuildPlayer {
        if (!this.players.has(guildId)) {
            this.players.set(guildId, new GuildPlayer(guildId));
        }
        return this.players.get(guildId)!;
    }
}
