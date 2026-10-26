import { AudioPlayer, createAudioPlayer, VoiceConnection, createAudioResource, StreamType } from '@discordjs/voice';
import { spawn, ChildProcess } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import { Track } from './types';
import { EventEmitter } from 'events';
import { AudioMixer, getSfxPcmBuffer } from './AudioMixer';

const AMBIENCE_IDLE_TIMEOUT_MS = 5000;
const STREAM_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export class AudioStreamer extends EventEmitter {
    player: AudioPlayer;
    connection: VoiceConnection | null = null;

    currentTrack: Track | null = null;
    isPlaying: boolean = false;
    isPaused: boolean = false;
    volume: number = 0.8;
    sfxVolume: number = 0.8;

    // For seek tracking
    startTimestamp: number = 0;
    seekOffset: number = 0;

    private currentFfmpegProcess: ChildProcess | null = null;
    private currentEncoderProcess: ChildProcess | null = null;
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
                // If encoder died unexpectedly while music was playing
                if (!this.currentEncoderProcess) {
                    this.emit('idle');
                }
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

        if (this.isPlaying && this.isPaused && !this.mixer?.hasActiveSfx()) {
            // Music is paused and all one-shot SFX finished: pause clock & player to hide speaking indicator
            this.mixer?.pauseClock();
            this.player.pause();
            return;
        }

        this.ambienceIdleTimer = setTimeout(() => {
            this.ambienceIdleTimer = null;
            if (!this.isPlaying && this.loopingSfx.size === 0 && !this.mixer?.hasActiveSfx()) {
                this.stopAllProcesses();
            }
        }, AMBIENCE_IDLE_TIMEOUT_MS);
    }

    private createEncoderProcess(label: string): ChildProcess {
        // Low-latency OggOpus encoder without dynaudnorm (prevents 20s buffering and volume pumping)
        const encoderArgs = [
            '-hide_banner',
            '-loglevel', 'error',
            '-probesize', '32',
            '-analyzeduration', '0',
            '-fflags', '+nobuffer',
            '-flags', 'low_delay',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', 'pipe:0',
            '-c:a', 'libopus',
            '-b:a', '128k',
            '-vbr', 'on',
            '-compression_level', '5',
            '-frame_duration', '20',
            '-application', 'audio',
            '-page_duration', '20000',
            '-flush_packets', '1',
            '-f', 'ogg',
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
        mixer.sfxVolume = this.sfxVolume;

        mixer.on('error', (err: Error) => {
            console.error('AudioMixer stream error:', err.message || err);
        });

        mixer.on('empty', () => {
            this.scheduleAmbienceIdleCheck();
        });

        mixer.on('musicEnd', () => {
            if (!this.isPlaying || this.isPaused) return;
            this.isPlaying = false;
            this.scheduleAmbienceIdleCheck();
            this.emit('idle');
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

    async warmupPipeline(): Promise<void> {
        await this.ensurePipeline();
    }

    private async ensurePipeline(): Promise<void> {
        if (this.mixer && this.currentEncoderProcess && !this.currentEncoderProcess.killed) {
            this.mixer.start();
            if (this.player.state.status === 'paused' || this.player.state.status === 'autopaused') {
                this.player.unpause();
            }
            return;
        }

        this.stopEncoderAndMixer();

        this.mixer = await this.createMixerWithLoops();
        this.currentEncoderProcess = this.createEncoderProcess('Main');

        if (this.currentEncoderProcess.stdin) {
            this.mixer.pipe(this.currentEncoderProcess.stdin);
        }

        this.mixer.start();
        const resource = createAudioResource(this.currentEncoderProcess.stdout!, { inputType: StreamType.OggOpus });
        this.player.play(resource);
    }

    async play(track: Track, offsetSeconds: number = 0) {
        this.clearAmbienceIdleTimer();
        this.stopMusicDecoder();

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
        const isM3u8 = input.includes('.m3u8');
        const ffmpegArgs: string[] = [
            '-hide_banner',
            '-loglevel', 'error',
            '-fflags', '+nobuffer+discardcorrupt+fastseek',
            '-flags', 'low_delay',
            '-probesize', '32768',
            '-analyzeduration', '0'
        ];

        if (isUrl) {
            ffmpegArgs.push(
                '-user_agent', STREAM_USER_AGENT,
                '-reconnect', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '5',
                '-reconnect_on_network_error', '1',
                '-reconnect_on_http_error', '4xx,5xx'
            );
            if (isM3u8) {
                ffmpegArgs.push('-http_persistent', '1', '-multiple_requests', '1');
            }
        }

        // Fast input seek before -i for direct files/YouTube streams (near 0ms latency);
        // output seek after -i for SoundCloud HLS (.m3u8) streams to ensure playlist segment demuxing
        if (offsetSeconds > 0 && !isM3u8) {
            ffmpegArgs.push('-ss', offsetSeconds.toString());
        }

        ffmpegArgs.push('-i', input);

        if (offsetSeconds > 0 && isM3u8) {
            ffmpegArgs.push('-ss', offsetSeconds.toString());
        }

        ffmpegArgs.push(
            '-vn',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        );

        await this.ensurePipeline();

        const decoderProc = spawn(ffmpegPath as string, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        this.currentFfmpegProcess = decoderProc;

        let sawForbidden = false;
        let hasStartedAudio = false;

        decoderProc.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString();
            if (msg.includes('403 Forbidden') || msg.includes('Server returned 403')) {
                sawForbidden = true;
                if (hasStartedAudio && this.currentFfmpegProcess === decoderProc) {
                    this.emit('streamForbidden', track, this.getElapsed());
                }
                return;
            }
            if (
                msg.includes('Error') &&
                !msg.includes('-10054') &&
                !msg.includes('Will reconnect') &&
                !msg.includes('Error in the pull function') &&
                !msg.includes('Input/output error')
            ) {
                console.error('FFmpeg Decoder Error:', msg.trim());
            }
        });

        decoderProc.on('error', (err: Error) => {
            if (this.currentFfmpegProcess !== decoderProc) return;
            console.error('FFmpeg Decoder spawn error:', err.message);
            this.emit('error', err);
        });

        decoderProc.stdout?.on('error', (err: Error) => {
            console.error('FFmpeg Decoder stdout error:', err.message || err);
        });

        if (this.mixer && decoderProc.stdout) {
            this.mixer.setMusicSource(decoderProc.stdout);
        }

        // Wait until the first 60ms of decoded PCM audio enters the mixer (so progress bar starts at exact 0:00),
        // or reject immediately if FFmpeg fails with 403 Forbidden so PlayerService can refresh the URL.
        await new Promise<void>((resolve, reject) => {
            const mixerRef = this.mixer;
            let settled = false;

            const cleanup = () => {
                clearTimeout(timeoutId);
                mixerRef?.off('musicStart', onMusicStart);
                decoderProc.off('close', onClose);
            };

            const onMusicStart = () => {
                if (settled) return;
                settled = true;
                hasStartedAudio = true;
                cleanup();
                resolve();
            };

            const onClose = (code: number | null) => {
                if (this.currentFfmpegProcess === decoderProc) {
                    this.currentFfmpegProcess = null;
                }
                if (settled) return;
                settled = true;
                cleanup();
                if (sawForbidden) {
                    const err: any = new Error('Stream URL returned 403 Forbidden');
                    err.isForbidden = true;
                    reject(err);
                } else if (!hasStartedAudio) {
                    reject(new Error(`FFmpeg decoder closed before producing audio frames (code ${code})`));
                } else {
                    resolve();
                }
            };

            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                hasStartedAudio = true;
                cleanup();
                resolve();
            }, 2500);

            mixerRef?.once('musicStart', onMusicStart);
            decoderProc.once('close', onClose);
        });

        this.startTimestamp = Date.now();
        this.emit('play', track);
    }

    async playSfx(soundId: number, sfxFilePath: string, volume: number = 1.0, loop: boolean = false) {
        try {
            this.clearAmbienceIdleTimer();
            const pcmBuf = await getSfxPcmBuffer(sfxFilePath);
            if (loop) {
                this.loopingSfx.set(soundId, { filePath: sfxFilePath, volume });
            }

            await this.ensurePipeline();

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
        this.scheduleAmbienceIdleCheck();
    }

    stopAllSfxLoops() {
        this.clearAmbienceIdleTimer();
        this.loopingSfx.clear();
        if (this.mixer) {
            this.mixer.clearSfx();
        }
        this.scheduleAmbienceIdleCheck();
    }

    getLoopingSfxIds(): number[] {
        return Array.from(this.loopingSfx.keys());
    }

    private stopMusicDecoder() {
        if (this.mixer) {
            this.mixer.detachMusicSource();
        }
        if (this.currentFfmpegProcess) {
            const proc = this.currentFfmpegProcess;
            this.currentFfmpegProcess = null;
            try {
                proc.stdout?.removeAllListeners();
                proc.kill();
            } catch {}
        }
    }

    private stopEncoderAndMixer() {
        if (this.mixer) {
            try {
                this.mixer.unpipe();
                this.mixer.stop();
            } catch {}
            this.mixer = null;
        }
        if (this.currentEncoderProcess) {
            const enc = this.currentEncoderProcess;
            this.currentEncoderProcess = null;
            try {
                enc.stdin?.end();
                enc.kill();
            } catch {}
        }
    }

    stopAllProcesses() {
        this.clearAmbienceIdleTimer();
        this.stopMusicDecoder();
        this.stopEncoderAndMixer();
        this.player.stop();
    }

    pause() {
        if (!this.isPlaying || this.isPaused) return;
        this.isPaused = true;

        if (this.mixer) {
            this.mixer.setMusicPaused(true);
            if (!this.mixer.hasActiveSfx() && this.loopingSfx.size === 0) {
                this.mixer.pauseClock();
                this.player.pause();
            }
        }
        this.emit('pause');
    }

    async resume(): Promise<boolean> {
        if (!this.isPlaying || !this.isPaused || !this.currentTrack) return false;

        // Instant zero-latency resume if the decoder or buffered PCM is still available
        if (this.mixer && (this.currentFfmpegProcess || this.mixer.getPlayedMusicSeconds() >= 0)) {
            this.isPaused = false;
            this.mixer.setMusicPaused(false);
            this.mixer.start();
            this.player.unpause();
            this.emit('play', this.currentTrack);
            return true;
        }

        return false;
    }

    stop() {
        this.currentTrack = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.seekOffset = 0;
        this.stopMusicDecoder();

        if (this.loopingSfx.size > 0 || this.mixer?.hasActiveSfx()) {
            this.scheduleAmbienceIdleCheck();
        } else {
            this.stopAllProcesses();
        }
        this.emit('stop');
    }

    setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(vol, 2.0));
        if (this.mixer) {
            this.mixer.setMusicVolume(this.volume);
        }
    }

    setSfxVolume(vol: number) {
        this.sfxVolume = Math.max(0, Math.min(vol, 2.0));
        for (const [, loopItem] of this.loopingSfx.entries()) {
            loopItem.volume = this.sfxVolume;
        }
        if (this.mixer) {
            this.mixer.setSfxVolume(this.sfxVolume);
        }
    }

    getElapsed(): number {
        if (!this.currentTrack || !this.isPlaying) {
            return 0;
        }
        if (this.mixer) {
            return this.seekOffset + this.mixer.getPlayedMusicSeconds();
        }
        return this.seekOffset;
    }
}
