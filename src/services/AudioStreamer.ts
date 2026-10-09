import { AudioPlayer, createAudioPlayer, VoiceConnection, createAudioResource, StreamType } from '@discordjs/voice';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import { Track } from './types';
import { EventEmitter } from 'events';

export class AudioStreamer extends EventEmitter {
    player: AudioPlayer;
    connection: VoiceConnection | null = null;
    
    currentTrack: Track | null = null;
    isPlaying: boolean = false;
    isPaused: boolean = false;
    
    // For seek tracking
    startTimestamp: number = 0;
    seekOffset: number = 0; 
    
    private currentFfmpegProcess: any = null;

    constructor() {
        super();
        this.player = createAudioPlayer();
        
        this.player.on('error', (err) => {
            this.emit('error', err);
        });

        this.player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle' && oldState.status !== 'idle') {
                if (this.isPaused) return; // Не переключаем трек, если мы просто поставили на паузу
                this.emit('idle');
            }
        });
    }

    async play(track: Track, offsetSeconds: number = 0) {
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
            // Флаги для автоматического переподключения
            ffmpegArgs.push(
                '-reconnect', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '5',
                '-reconnect_on_network_error', '1',
                '-reconnect_on_http_error', '4xx,5xx'
            );
        }

        if (isFileOrUrl && !isUrl && offsetSeconds > 0) {
            ffmpegArgs.push('-ss', offsetSeconds.toString());
        }

        ffmpegArgs.push('-i', input);

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
        
        this.currentFfmpegProcess = spawn(ffmpegPath as string, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        this.currentFfmpegProcess.stderr.on('data', (data: any) => {
            const msg = data.toString();
            if (msg.includes('Error') && !msg.includes('-10054') && !msg.includes('Will reconnect')) {
                console.error('FFmpeg Error:', msg);
            }
        });

        this.currentFfmpegProcess.on('error', (err: any) => console.error('FFmpeg spawn error:', err.message));
        
        const resource = createAudioResource(this.currentFfmpegProcess.stdout, { inputType: StreamType.OggOpus });
        this.player.play(resource);
        this.emit('play', track);
    }

    stopCurrentProcesses() {
        if (this.currentFfmpegProcess) {
            this.currentFfmpegProcess.kill();
            this.currentFfmpegProcess = null;
        }
    }

    pause() {
        if (!this.isPlaying || this.isPaused) return;
        this.isPaused = true;
        this.seekOffset = this.seekOffset + Math.floor((Date.now() - this.startTimestamp) / 1000);
        
        this.stopCurrentProcesses();
        this.player.stop(); 
        this.emit('pause');
    }

    stop() {
        this.currentTrack = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.stopCurrentProcesses();
        this.player.stop();
        this.emit('stop');
    }

    getElapsed(): number {
        let elapsed = 0;
        if (this.currentTrack && this.isPlaying && !this.isPaused) {
            elapsed = this.seekOffset + Math.floor((Date.now() - this.startTimestamp) / 1000);
        } else if (this.currentTrack && this.isPaused) {
            elapsed = this.seekOffset;
        }
        return elapsed;
    }
}
