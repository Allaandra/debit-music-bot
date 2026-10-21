import { VoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { EventEmitter } from 'events';
import { Track } from './types';
import { TrackResolver } from './TrackResolver';
import { QueueManager } from './QueueManager';
import { AudioStreamer } from './AudioStreamer';

export class PlayerService extends EventEmitter {
    guildId: string;
    queueManager: QueueManager;
    streamer: AudioStreamer;

    constructor(guildId: string) {
        super();
        this.guildId = guildId;
        this.queueManager = new QueueManager();
        this.streamer = new AudioStreamer();

        this.streamer.on('idle', () => {
            this.playNext();
        });

        this.streamer.on('error', (err) => {
            console.error(`Player error on guild ${this.guildId}:`, err.message);
            this.playNext();
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

    async play(track: Track, offsetSeconds: number = 0) {
        if (offsetSeconds === 0 && this.streamer.currentTrack) {
            this.queueManager.addToHistory(this.streamer.currentTrack);
        }
        await this.streamer.play(track, offsetSeconds);
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
            try {
                const nextTrack = await this.resolveTrack(nextTrackDB.type, nextTrackDB.query);
                await this.play(nextTrack);
            } catch (err: any) {
                console.error('Не удалось разрешить следующий трек, пропускаем:', err.message);
                if (this.queueManager.repeatMode === 'track') {
                    this.queueManager.repeatMode = 'off';
                }
                this.playNext();
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
            this.seek(0);
        }
        this.emit('stateUpdate', this.getStatus());
    }

    toggleShuffle() {
        this.queueManager.toggleShuffle();
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
        
        let trackToPlay = this.streamer.currentTrack;
        if (trackToPlay.type === 'url') {
            try {
                trackToPlay = await this.resolveTrack('url', trackToPlay.query);
            } catch (e) {
                console.error('Failed to re-resolve track on resume', e);
            }
        }
        this.play(trackToPlay, this.streamer.seekOffset);
    }

    seek(seconds: number) {
        if (this.streamer.currentTrack) {
            this.play(this.streamer.currentTrack, seconds);
        }
    }

    setVolume(volume: number) {
        this.streamer.setVolume(volume);
        this.emit('stateUpdate', this.getStatus());
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

    destroy() {
        this.streamer.stopAllSfxLoops();
        this.stop();
        if (this.connection) {
            try {
                this.connection.destroy();
            } catch (e) {}
            this.connection = null;
        }
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
