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
    private silenceProcess: any = null;
    private mixer: AudioMixer | null = null;
    private loopingSfx: Map<number, { filePath: string; volume: number }> = new Map();

    constructor() {
        super();
        this.player = createAudioPlayer();
        
        this.player.on('error', (err) => {
            this.emit('error', err);
        });

        this.player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle' && oldState.status !== 'idle') {
                if (this.isPaused || !this.isPlaying) return;
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

        if (!input || typeof input !== 'string') {
            throw new Error('Некорректный адрес или файл для воспроизведения');
        }

        if (track.type === 'url' && !input.startsWith('http')) {
            throw new Error(`Не удалось получить прямой поток воспроизведения для трека: ${track.title}`);
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

        for (const [id, sfx] of this.loopingSfx.entries()) {
            try {
                const buf = await getSfxPcmBuffer(sfx.filePath);
                this.mixer.addSfx(id, buf, sfx.volume, true);
            } catch (err: any) {
                console.error(`Failed to reattach looping SFX ${id}:`, err.message);
            }
        }

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

        this.currentEncoderProcess.stdin.on('error', (err: any) => {
            if (err.code !== 'EPIPE' && err.code !== 'EOF') {
                console.error('FFmpeg Encoder stdin error:', err.message || err);
            }
        });

        this.mixer.on('error', (err: any) => {
            console.error('AudioMixer stream error:', err.message || err);
        });

        this.currentFfmpegProcess.stdout.on('error', (err: any) => {
            console.error('FFmpeg Decoder stdout error:', err.message || err);
        });

        this.currentFfmpegProcess.stdout.pipe(this.mixer).pipe(this.currentEncoderProcess.stdin);
        
        const resource = createAudioResource(this.currentEncoderProcess.stdout, { inputType: StreamType.OggOpus });
        this.player.play(resource);
        this.emit('play', track);
    }

    async playSfx(soundId: number, sfxFilePath: string, volume: number = 1.0, loop: boolean = false) {
        try {
            const pcmBuf = await getSfxPcmBuffer(sfxFilePath);
            if (loop) {
                this.loopingSfx.set(soundId, { filePath: sfxFilePath, volume });
            }

            if (this.isPlaying && !this.isPaused && this.mixer) {
                // Overlay on top of playing music!
                this.mixer.addSfx(soundId, pcmBuf, volume, loop);
            } else if (this.silenceProcess && this.mixer) {
                // Ambience stream is already running!
                this.mixer.addSfx(soundId, pcmBuf, volume, loop);
            } else if (loop) {
                // Start ambience stream for this loop!
                await this.startAmbienceStream();
            } else {
                // Single-shot SFX when nothing else is playing
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

    stopLoopSfx(soundId: number) {
        this.loopingSfx.delete(soundId);
        if (this.mixer) {
            this.mixer.removeSfx(soundId);
        }
        if (!this.isPlaying && this.loopingSfx.size === 0) {
            this.stopAmbienceStream();
        }
    }

    stopAllSfxLoops() {
        this.loopingSfx.clear();
        if (this.mixer) {
            this.mixer.clearSfx();
        }
        if (!this.isPlaying) {
            this.stopAmbienceStream();
        }
    }

    getLoopingSfxIds(): number[] {
        return Array.from(this.loopingSfx.keys());
    }

    async startAmbienceStream() {
        if (this.silenceProcess && this.currentEncoderProcess && this.mixer) {
            return;
        }

        this.stopCurrentProcesses();

        const silenceArgs = [
            '-re',
            '-f', 'lavfi',
            '-i', 'anullsrc=r=48000:cl=stereo',
            '-f', 's16le',
            'pipe:1'
        ];

        this.silenceProcess = spawn(ffmpegPath as string, silenceArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        this.silenceProcess.on('error', (err: any) => console.error('FFmpeg Silence spawn error:', err.message));

        this.mixer = new AudioMixer(this.volume);

        for (const [id, sfx] of this.loopingSfx.entries()) {
            try {
                const buf = await getSfxPcmBuffer(sfx.filePath);
                this.mixer.addSfx(id, buf, sfx.volume, true);
            } catch (err: any) {
                console.error(`Failed to attach looping SFX ${id}:`, err.message);
            }
        }

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
        this.currentEncoderProcess.on('error', (err: any) => console.error('FFmpeg Ambience Encoder spawn error:', err.message));
        this.currentEncoderProcess.stdin.on('error', (err: any) => {
            if (err.code !== 'EPIPE' && err.code !== 'EOF') {
                console.error('FFmpeg Ambience Encoder stdin error:', err.message || err);
            }
        });

        this.mixer.on('error', (err: any) => {
            console.error('Ambience AudioMixer stream error:', err.message || err);
        });

        this.silenceProcess.stdout.on('error', (err: any) => {
            console.error('FFmpeg Silence stdout error:', err.message || err);
        });

        this.silenceProcess.stdout.pipe(this.mixer).pipe(this.currentEncoderProcess.stdin);

        const resource = createAudioResource(this.currentEncoderProcess.stdout, { inputType: StreamType.OggOpus });
        this.player.play(resource);
    }

    stopAmbienceStream() {
        if (this.silenceProcess) {
            try {
                this.silenceProcess.stdout?.unpipe();
                this.silenceProcess.kill();
            } catch (e) {}
            this.silenceProcess = null;
        }
        if (this.currentEncoderProcess && !this.isPlaying) {
            try {
                this.currentEncoderProcess.stdin?.end();
                this.currentEncoderProcess.kill();
            } catch (e) {}
            this.currentEncoderProcess = null;
        }
        if (!this.isPlaying) {
            if (this.mixer) {
                try {
                    this.mixer.unpipe();
                } catch (e) {}
            }
            this.mixer = null;
            this.player.stop();
        }
    }

    stopCurrentProcesses() {
        if (this.currentFfmpegProcess) {
            try {
                this.currentFfmpegProcess.stdout?.unpipe();
                this.currentFfmpegProcess.kill();
            } catch (e) {}
            this.currentFfmpegProcess = null;
        }
        if (this.silenceProcess) {
            try {
                this.silenceProcess.stdout?.unpipe();
                this.silenceProcess.kill();
            } catch (e) {}
            this.silenceProcess = null;
        }
        if (this.currentEncoderProcess) {
            try {
                this.currentEncoderProcess.stdin?.end();
                this.currentEncoderProcess.kill();
            } catch (e) {}
            this.currentEncoderProcess = null;
        }
        if (this.currentSfxProcess) {
            try {
                this.currentSfxProcess.kill();
            } catch (e) {}
            this.currentSfxProcess = null;
        }
        if (this.mixer) {
            try {
                this.mixer.unpipe();
            } catch (e) {}
            this.mixer = null;
        }
    }

    pause() {
        if (!this.isPlaying || this.isPaused) return;
        this.isPaused = true;
        this.seekOffset = this.seekOffset + Math.floor((Date.now() - this.startTimestamp) / 1000);
        
        if (this.currentFfmpegProcess) {
            this.currentFfmpegProcess.kill();
            this.currentFfmpegProcess = null;
        }
        if (this.loopingSfx.size > 0) {
            this.startAmbienceStream();
        } else {
            this.stopCurrentProcesses();
            this.player.stop();
        }
        this.emit('pause');
    }

    stop() {
        this.currentTrack = null;
        this.isPlaying = false;
        this.isPaused = false;
        if (this.currentFfmpegProcess) {
            this.currentFfmpegProcess.kill();
            this.currentFfmpegProcess = null;
        }
        if (this.loopingSfx.size > 0) {
            this.startAmbienceStream();
        } else {
            this.stopCurrentProcesses();
            this.player.stop();
        }
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
