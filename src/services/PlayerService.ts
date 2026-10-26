import { VoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { Client } from 'discord.js';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { prisma } from '../database';
import { Track } from './types';
import { TrackResolver } from './TrackResolver';
import { QueueManager } from './QueueManager';
import { AudioStreamer } from './AudioStreamer';

interface PersistedSettings {
    guildVolumes?: Record<string, { music?: number; sfx?: number }>;
}

const SETTINGS_FILE = path.resolve('settings.json');

function loadPersistedSettings(): PersistedSettings {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch {}
    return {};
}

function savePersistedSettings(settings: PersistedSettings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch {}
}

export class PlayerService extends EventEmitter {
    guildId: string;
    queueManager: QueueManager;
    streamer: AudioStreamer;

    constructor(guildId: string) {
        super();
        this.guildId = guildId;
        this.queueManager = new QueueManager();
        this.streamer = new AudioStreamer();

        const settings = loadPersistedSettings();
        const guildVol = settings.guildVolumes?.[guildId];
        if (guildVol) {
            if (typeof guildVol.music === 'number') {
                this.streamer.volume = guildVol.music;
            }
            if (typeof guildVol.sfx === 'number') {
                this.streamer.sfxVolume = guildVol.sfx;
            }
        }

        this.streamer.on('idle', () => {
            this.playNext();
        });

        this.streamer.on('error', (err) => {
            console.error(`Player error on guild ${this.guildId}:`, err.message);
            this.playNext();
        });

        this.streamer.on('streamForbidden', async (track: Track, elapsed: number) => {
            if (!track || track.type !== 'url') return;
            console.warn(`[PlayerService] Поток вернул 403 Forbidden во время проигрывания "${track.title}". Обновляем ссылку...`);
            try {
                TrackResolver.invalidateCache(track.type, track.query);
                const freshTrack = await TrackResolver.resolveTrack(track.type, track.query, true);
                await this.streamer.play(freshTrack, elapsed);
            } catch (err: any) {
                console.error('[PlayerService] Не удалось обновить истёкший поток:', err.message);
                this.playNext();
            }
        });

        // Продвигаем события дальше для WebSocket
        this.streamer.on('play', () => this.emit('stateUpdate', this.getStatus()));
        this.streamer.on('pause', () => this.emit('stateUpdate', this.getStatus()));
        this.streamer.on('stop', () => this.emit('stateUpdate', this.getStatus()));
    }

    get connection(): VoiceConnection | null {
        return this.streamer.connection;
    }

    set connection(conn: VoiceConnection | null) {
        this.streamer.connection = conn;
        if (conn) {
            conn.subscribe(this.streamer.player);
        }
    }

    async resolveTrack(type: 'local' | 'url', query: string): Promise<Track> {
        return TrackResolver.resolveTrack(type, query);
    }

    prefetchUpcoming() {
        const nextTrack = this.queueManager.queue[0];
        if (nextTrack && nextTrack.query) {
            TrackResolver.prefetchTrack(nextTrack.type, nextTrack.query);
        }
    }

    async play(track: Track, offsetSeconds: number = 0) {
        if (offsetSeconds === 0 && this.streamer.currentTrack) {
            this.queueManager.addToHistory(this.streamer.currentTrack);
        }
        // Prefetch the upcoming track immediately in the background without waiting for playback to finish starting
        this.prefetchUpcoming();
        try {
            await this.streamer.play(track, offsetSeconds);
        } catch (err: any) {
            if (err?.isForbidden && track.type === 'url') {
                console.warn(`[PlayerService] Кэшированная ссылка устарела (403) для "${track.title}". Получаем свежий поток...`);
                TrackResolver.invalidateCache(track.type, track.query);
                const freshTrack = await TrackResolver.resolveTrack(track.type, track.query, true);
                await this.streamer.play(freshTrack, offsetSeconds);
            } else {
                throw err;
            }
        }
    }

    async playSfx(soundId: number, sfxFilePath: string, volume: number = 1.0, loop: boolean = false) {
        await this.streamer.playSfx(soundId, sfxFilePath, volume, loop);
        if (loop) {
            this.emit('stateUpdate', this.getStatus());
        }
    }

    stopLoopSfx(soundId: number) {
        this.streamer.stopLoopSfx(soundId);
        this.emit('stateUpdate', this.getStatus());
    }

    getLoopingSfxIds(): number[] {
        return this.streamer.getLoopingSfxIds();
    }

    async playNext() {
        const nextTrackDB = this.queueManager.getNext(this.streamer.currentTrack);

        if (nextTrackDB) {
            // Optimistically update status to show next track immediately to frontend via WebSocket
            this.streamer.currentTrack = nextTrackDB;
            this.streamer.seekOffset = 0;
            this.emit('stateUpdate', this.getStatus());

            try {
                const nextTrack = await this.resolveTrack(nextTrackDB.type, nextTrackDB.query);
                await this.play(nextTrack);
            } catch (err: any) {
                console.error('Не удалось разрешить следующий трек, пропускаем:', err.message);
                if (this.queueManager.repeatMode === 'track') {
                    this.queueManager.repeatMode = 'off';
                }
                await this.playNext();
            }
        } else {
            this.streamer.stop();
        }
        this.emit('stateUpdate', this.getStatus());
    }

    async playPrevious() {
        const prevTrack = this.queueManager.getPrevious(this.streamer.currentTrack);
        if (prevTrack) {
            try {
                const resolved = await this.resolveTrack(prevTrack.type, prevTrack.query);
                this.streamer.currentTrack = null;
                await this.play(resolved);
            } catch (err) {
                console.error('Не удалось разрешить предыдущий трек:', err);
            }
        } else {
            await this.seek(0);
        }
        this.emit('stateUpdate', this.getStatus());
    }

    toggleShuffle() {
        this.queueManager.toggleShuffle();
        this.prefetchUpcoming();
        this.emit('stateUpdate', this.getStatus());
    }

    toggleRepeat() {
        this.queueManager.toggleRepeat();
        this.emit('stateUpdate', this.getStatus());
    }

    pause() {
        this.streamer.pause();
    }

    async resume() {
        if (!this.streamer.isPaused || !this.streamer.currentTrack) return;

        // Fast-path: instant 0ms resume from live decoder/mixer buffer
        const resumedInstantly = await this.streamer.resume();
        if (resumedInstantly) {
            return;
        }

        // Fallback if decoder process closed while paused for a long time
        let trackToPlay = this.streamer.currentTrack;
        const resumeOffset = this.streamer.getElapsed();
        if (trackToPlay.type === 'url' && (!trackToPlay.url || !trackToPlay.url.startsWith('http'))) {
            try {
                trackToPlay = await this.resolveTrack('url', trackToPlay.query);
            } catch (e) {
                console.error('Failed to re-resolve track on resume', e);
            }
        }
        await this.play(trackToPlay, resumeOffset);
    }

    async seek(seconds: number) {
        if (!this.streamer.currentTrack) return;
        let track = this.streamer.currentTrack;
        if (track.type === 'url') {
            const cached = TrackResolver.getCachedTrack(track.type, track.query);
            if (cached && cached.url) {
                track = cached;
            }
        }
        await this.play(track, seconds);
    }

    setVolume(volume: number) {
        this.streamer.setVolume(volume);
        const settings = loadPersistedSettings();
        if (!settings.guildVolumes) settings.guildVolumes = {};
        if (!settings.guildVolumes[this.guildId]) settings.guildVolumes[this.guildId] = {};
        settings.guildVolumes[this.guildId].music = this.streamer.volume;
        savePersistedSettings(settings);
        this.emit('stateUpdate', this.getStatus());
    }

    setSfxVolume(volume: number) {
        this.streamer.setSfxVolume(volume);
        const settings = loadPersistedSettings();
        if (!settings.guildVolumes) settings.guildVolumes = {};
        if (!settings.guildVolumes[this.guildId]) settings.guildVolumes[this.guildId] = {};
        settings.guildVolumes[this.guildId].sfx = this.streamer.sfxVolume;
        savePersistedSettings(settings);
    }

    getStatus() {
        return {
            isPlaying: this.streamer.isPlaying,
            isPaused: this.streamer.isPaused,
            currentTrack: this.streamer.currentTrack,
            elapsed: this.streamer.getElapsed(),
            volume: this.streamer.volume,
            queue: this.queueManager.queue,
            activePlaylistName: this.queueManager.activePlaylistName,
            queueLength: this.queueManager.queue.length,
            shuffle: this.queueManager.shuffle,
            repeatMode: this.queueManager.repeatMode,
            loopingSfx: this.streamer.getLoopingSfxIds()
        };
    }

    stop() {
        this.streamer.stop();
        this.queueManager.setQueue([]);
        this.emit('stateUpdate', this.getStatus());
    }

    onBotDisconnected() {
        this.streamer.stopAllSfxLoops();
        if (this.connection) {
            try {
                this.connection.destroy();
            } catch {}
            this.connection = null;
        }
        this.stop();
    }

    destroy() {
        this.onBotDisconnected();
    }
}

export class PlayerManagerClass extends EventEmitter {
    players: Map<string, PlayerService> = new Map();

    getPlayer(guildId: string): PlayerService {
        if (!this.players.has(guildId)) {
            const player = new PlayerService(guildId);
            this.players.set(guildId, player);
            player.on('stateUpdate', (state) => {
                this.emit('stateUpdate', { guildId, state });
            });
        }
        return this.players.get(guildId)!;
    }

    async ensureUserConnection(client: Client, userId: string): Promise<{ guildPlayer: PlayerService; guildId: string; channelId: string }> {
        const session = await prisma.activeSession.findUnique({
            where: { userId }
        });

        if (!session) {
            const err: any = new Error('Бот не привязан к голосовому каналу (зайдите в голосовой канал Discord)');
            err.statusCode = 404;
            throw err;
        }

        const { guildId, channelId } = session;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            const err: any = new Error('Сервер Discord не найден');
            err.statusCode = 404;
            throw err;
        }

        const guildPlayer = this.getPlayer(guildId);

        if (
            !guildPlayer.connection ||
            guildPlayer.connection.state.status === 'destroyed' ||
            guildPlayer.connection. state.status === 'disconnected' ||
            guildPlayer.connection.joinConfig.channelId !== channelId
        ) {
            guildPlayer.connection = joinVoiceChannel({
                channelId,
                guildId,
                adapterCreator: guild.voiceAdapterCreator,
            });
        }

        return { guildPlayer, guildId, channelId };
    }

    stopAll() {
        for (const [guildId, player] of this.players.entries()) {
            try {
                player.destroy();
            } catch (e) {
                console.error(`Error stopping player for guild ${guildId}:`, e);
            }
        }
        this.players.clear();
    }
}

export const PlayerManager = new PlayerManagerClass();
