import { AudioPlayer, createAudioPlayer, VoiceConnection, createAudioResource, StreamType } from '@discordjs/voice';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import { Track } from './types';
import { EventEmitter } from 'events';
import { AudioMixer, getSfxPcmBuffer } from './AudioMixer';

export class AudioStreamer extends EventEmitter {
    player: AudioPlayer;
    connection: VoiceConnection | null = null;
    
    currentTrack: Track | null = null;
    isPlaying: boolean = false;
    isPaused: boolean = false;
    volume: number = 0.8;
    
    // For seek tracking
    startTimestamp: number = 0;
    seekOffset: number = 0; 
    
    private currentFfmpegProcess: any = null;
    private currentEncoderProcess: any = null;
    private currentSfxProcess: any = null;
    private mixer: AudioMixer | null = null;

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

        // Decode to raw 16-bit 48kHz stereo PCM for the mixer
        ffmpegArgs.push(
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        );
        
        this.currentFfmpegProcess = spawn(ffmpegPath as string, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        this.currentFfmpegProcess.stderr.on('data', (data: any) => {
            const msg = data.toString();
            if (msg.includes('Error') && !msg.includes('-10054') && !msg.includes('Will reconnect')) {
                console.error('FFmpeg Decoder Error:', msg);
            }
        });

        this.currentFfmpegProcess.on('error', (err: any) => {
            console.error('FFmpeg Decoder spawn error:', err.message);
            this.emit('error', err);
        });

        this.mixer = new AudioMixer(this.volume);

        const encoderArgs = [
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', 'pipe:0',
            '-c:a', 'libopus',
            '-b:a', '128k',
            '-f', 'ogg',
            '-af', 'dynaudnorm=f=200:g=5:r=0.9',
            'pipe:1'
        ];

        this.currentEncoderProcess = spawn(ffmpegPath as string, encoderArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

        this.currentEncoderProcess.stderr.on('data', (data: any) => {
            const msg = data.toString();
            if (msg.includes('Error') && !msg.includes('-10054')) {
                console.error('FFmpeg Encoder Error:', msg);
            }
        });

        this.currentEncoderProcess.on('error', (err: any) => {
            console.error('FFmpeg Encoder spawn error:', err.message);
            this.emit('error', err);
        });

        this.currentFfmpegProcess.stdout.pipe(this.mixer).pipe(this.currentEncoderProcess.stdin);
        
        const resource = createAudioResource(this.currentEncoderProcess.stdout, { inputType: StreamType.OggOpus });
        this.player.play(resource);
        this.emit('play', track);
    }

    async playSfx(sfxFilePath: string, volume: number = 1.0) {
        try {
            const pcmBuf = await getSfxPcmBuffer(sfxFilePath);
            if (this.isPlaying && !this.isPaused && this.mixer) {
                // Overlay on top of playing music!
                this.mixer.addSfx(pcmBuf, volume);
            } else {
                // No music playing: play SFX directly
                if (this.currentSfxProcess) {
                    this.currentSfxProcess.kill();
                    this.currentSfxProcess = null;
                }
                const sfxArgs = [
                    '-i', sfxFilePath,
                    '-af', `loudnorm=I=-16:TP=-1.5:LRA=11,volume=${volume}`,
                    '-c:a', 'libopus',
                    '-b:a', '128k',
                    '-f', 'ogg',
                    'pipe:1'
                ];
                this.currentSfxProcess = spawn(ffmpegPath as string, sfxArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
                const resource = createAudioResource(this.currentSfxProcess.stdout, { inputType: StreamType.OggOpus });
                this.player.play(resource);
            }
        } catch (e: any) {
            console.error('Failed to play SFX:', e.message);
        }
    }

    stopCurrentProcesses() {
        if (this.currentFfmpegProcess) {
            this.currentFfmpegProcess.kill();
            this.currentFfmpegProcess = null;
        }
        if (this.currentEncoderProcess) {
            this.currentEncoderProcess.kill();
            this.currentEncoderProcess = null;
        }
        if (this.currentSfxProcess) {
            this.currentSfxProcess.kill();
            this.currentSfxProcess = null;
        }
        this.mixer = null;
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

    setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(vol, 2.0));
        if (this.mixer) {
            this.mixer.setMusicVolume(this.volume);
        }
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

