import { AudioPlayer, createAudioPlayer, VoiceConnection, createAudioResource, StreamType } from '@discordjs/voice';
import { spawn, ChildProcess } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import { Track } from './types';
import { EventEmitter } from 'events';
import { AudioMixer, getSfxPcmBuffer } from './AudioMixer';

const AMBIENCE_IDLE_TIMEOUT_MS = 5000;

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
    
    private currentFfmpegProcess: ChildProcess | null = null;
    private currentEncoderProcess: ChildProcess | null = null;
    private silenceProcess: ChildProcess | null = null;
    private mixer: AudioMixer | null = null;
    private ambienceIdleTimer: ReturnType<typeof setTimeout> | null = null;
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

    private clearAmbienceIdleTimer() {
        if (this.ambienceIdleTimer) {
            clearTimeout(this.ambienceIdleTimer);
            this.ambienceIdleTimer = null;
        }
    }

    private scheduleAmbienceIdleCheck() {
        this.clearAmbienceIdleTimer();
        if (this.isPlaying && !this.isPaused) return;
        if (this.loopingSfx.size > 0) return;

        this.ambienceIdleTimer = setTimeout(() => {
            this.ambienceIdleTimer = null;
            if ((!this.isPlaying || this.isPaused) && this.loopingSfx.size === 0 && !this.mixer?.hasActiveSfx()) {
                this.stopAmbienceStream();
            }
        }, AMBIENCE_IDLE_TIMEOUT_MS);
    }

    private createEncoderProcess(label: string): ChildProcess {
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

        const proc = spawn(ffmpegPath as string, encoderArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

        proc.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString();
            if (msg.includes('Error') && !msg.includes('-10054')) {
                console.error(`FFmpeg ${label} Encoder Error:`, msg);
            }
        });

        proc.on('error', (err: Error) => {
            console.error(`FFmpeg ${label} Encoder spawn error:`, err.message);
            this.emit('error', err);
        });

        proc.stdin?.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code !== 'EPIPE' && err.code !== 'EOF') {
                console.error(`FFmpeg ${label} Encoder stdin error:`, err.message || err);
            }
        });

        return proc;
    }

    private async createMixerWithLoops(): Promise<AudioMixer> {
        const mixer = new AudioMixer(this.volume);
        mixer.on('error', (err: Error) => {
            console.error('AudioMixer stream error:', err.message || err);
        });
        mixer.on('empty', () => {
            this.scheduleAmbienceIdleCheck();
        });

        for (const [id, sfx] of this.loopingSfx.entries()) {
            try {
                const buf = await getSfxPcmBuffer(sfx.filePath);
                mixer.addSfx(id, buf, sfx.volume, true);
            } catch (err: any) {
                console.error(`Failed to attach looping SFX ${id}:`, err.message);
            }
        }

        return mixer;
    }

    async play(track: Track, offsetSeconds: number = 0) {
        this.clearAmbienceIdleTimer();
        this.stopCurrentProcesses();
        
        this.currentTrack = track;
        this.seekOffset = offsetSeconds;
        this.startTimestamp = Date.now();
        this.isPlaying = true;
        this.isPaused = false;

        const input = track.type === 'local'
            ? path.join(__dirname, '..', '..', 'sounds', track.query)
            : track.url;

        if (!input || typeof input !== 'string') {
            throw new Error('Некорректный адрес или файл для воспроизведения');
        }

        if (track.type === 'url' && !input.startsWith('http')) {
            throw new Error(`Не удалось получить прямой поток воспроизведения для трека: ${track.title}`);
        }

        const isUrl = input.startsWith('http');
        const ffmpegArgs: string[] = [];
        
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

        // Быстрый input-seek (-ss до -i) работает и для локальных файлов, и для HTTP-потоков через Range-запросы
        if (offsetSeconds > 0) {
            ffmpegArgs.push('-ss', offsetSeconds.toString());
        }

        ffmpegArgs.push('-i', input);

        // Decode to raw 16-bit 48kHz stereo PCM for the mixer
        ffmpegArgs.push(
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        );
        
        this.currentFfmpegProcess = spawn(ffmpegPath as string, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        this.currentFfmpegProcess.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString();
            if (msg.includes('Error') && !msg.includes('-10054') && !msg.includes('Will reconnect')) {
                console.error('FFmpeg Decoder Error:', msg);
            }
        });

        this.currentFfmpegProcess.on('error', (err: Error) => {
            console.error('FFmpeg Decoder spawn error:', err.message);
            this.emit('error', err);
        });

        this.currentFfmpegProcess.stdout?.on('error', (err: Error) => {
            console.error('FFmpeg Decoder stdout error:', err.message || err);
        });

        this.mixer = await this.createMixerWithLoops();
        this.currentEncoderProcess = this.createEncoderProcess('Music');

        if (this.currentFfmpegProcess.stdout && this.currentEncoderProcess.stdin) {
            this.currentFfmpegProcess.stdout.pipe(this.mixer).pipe(this.currentEncoderProcess.stdin);
        }
        
        const resource = createAudioResource(this.currentEncoderProcess.stdout!, { inputType: StreamType.OggOpus });
        this.player.play(resource);
        this.emit('play', track);
    }

    async playSfx(soundId: number, sfxFilePath: string, volume: number = 1.0, loop: boolean = false) {
        try {
            this.clearAmbienceIdleTimer();
            const pcmBuf = await getSfxPcmBuffer(sfxFilePath);
            if (loop) {
                this.loopingSfx.set(soundId, { filePath: sfxFilePath, volume });
            }

            // Если музыка не играет, используем (или запускаем) микшер эмбиент-потока —
            // это позволяет воспроизводить SFX мгновенно из RAM-кэша и накладывать несколько звуков друг на друга
            if ((!this.isPlaying || this.isPaused) && (!this.silenceProcess || !this.mixer)) {
                await this.startAmbienceStream();
            }

            if (this.mixer) {
                this.mixer.addSfx(soundId, pcmBuf, volume, loop);
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
        if (!this.isPlaying && this.loopingSfx.size === 0 && !this.mixer?.hasActiveSfx()) {
            this.stopAmbienceStream();
        }
    }

    stopAllSfxLoops() {
        this.clearAmbienceIdleTimer();
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
        this.silenceProcess.on('error', (err: Error) => console.error('FFmpeg Silence spawn error:', err.message));
        this.silenceProcess.stdout?.on('error', (err: Error) => {
            console.error('FFmpeg Silence stdout error:', err.message || err);
        });

        this.mixer = await this.createMixerWithLoops();
        this.currentEncoderProcess = this.createEncoderProcess('Ambience');

        if (this.silenceProcess.stdout && this.currentEncoderProcess.stdin) {
            this.silenceProcess.stdout.pipe(this.mixer).pipe(this.currentEncoderProcess.stdin);
        }

        const resource = createAudioResource(this.currentEncoderProcess.stdout!, { inputType: StreamType.OggOpus });
        this.player.play(resource);
    }

    stopAmbienceStream() {
        this.clearAmbienceIdleTimer();
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
        this.clearAmbienceIdleTimer();
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
