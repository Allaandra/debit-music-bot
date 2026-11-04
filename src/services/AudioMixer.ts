import { Readable } from 'stream';
import {
    PCM_STEREO_FRAME_BYTES,
    PCM_BYTES_PER_SECOND,
    TICK_MS,
    FRAME_BYTES,
    softClipInt16,
    createSeamlessLoopBuffer,
    invalidateSfxPcmCache,
    getSfxPcmBuffer
} from './SfxPcmCache';

export {
    PCM_SAMPLE_RATE,
    PCM_CHANNELS,
    PCM_BYTES_PER_SAMPLE,
    PCM_STEREO_FRAME_BYTES,
    PCM_BYTES_PER_SECOND,
    TICK_MS,
    FRAME_BYTES,
    softClipInt16,
    prepareCleanSfxBuffer,
    createSeamlessLoopBuffer,
    invalidateSfxPcmCache,
    getSfxPcmBuffer
} from './SfxPcmCache';

// Buffer 8s–15s of decoded music PCM in RAM to absorb network jitter without stalling TLS sockets
const MUSIC_HIGH_WATER_BYTES = PCM_BYTES_PER_SECOND * 15; // ~2.88 MB (15 sec)
const MUSIC_LOW_WATER_BYTES = PCM_BYTES_PER_SECOND * 8;   // ~1.53 MB (8 sec)

interface ActiveSfx {
    instanceId: number;
    id: number;
    buffer: Buffer;
    offset: number;
    volume: number;
    loop: boolean;
}

export class AudioMixer extends Readable {
    private activeSfx: ActiveSfx[] = [];
    private nextInstanceId: number = 1;
    public musicVolume: number = 1.0;
    public sfxVolume: number = 1.0;

    private musicSource: Readable | null = null;
    private musicChunks: Buffer[] = [];
    private musicChunkOffset: number = 0;
    private musicBufferedBytes: number = 0;
    private musicRemainder: Buffer | null = null;
    private musicSourceEnded: boolean = false;
    private musicSourcePauseApplied: boolean = false;
    private musicActive: boolean = false;
    private musicPaused: boolean = false;
    private musicPrebuffering: boolean = false;
    private playedMusicBytes: number = 0;

    private tickTimer: ReturnType<typeof setTimeout> | null = null;
    private nextTickTime: number = 0;
    private isRunning: boolean = false;
    private isDestroyedMixer: boolean = false;

    constructor(initialMusicVolume: number = 1.0) {
        super({ highWaterMark: FRAME_BYTES * 4 });
        this.musicVolume = Math.max(0, Math.min(initialMusicVolume, 2.0));
    }

    override _read(): void {
        // Driven by real-time 20ms timer
    }

    start() {
        if (this.isRunning || this.isDestroyedMixer) return;
        this.isRunning = true;
        this.nextTickTime = Date.now();
        this.scheduleNextTick();
    }

    pauseClock() {
        this.isRunning = false;
        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
            this.tickTimer = null;
        }
    }

    stop() {
        this.isDestroyedMixer = true;
        this.pauseClock();
        this.detachMusicSource();
        this.activeSfx = [];
        this.push(null);
    }

    private scheduleNextTick() {
        if (!this.isRunning || this.isDestroyedMixer) return;
        const now = Date.now();
        this.nextTickTime += TICK_MS;
        // Prevent burst catch-up if event loop was blocked for > 100ms
        if (this.nextTickTime < now - 80) {
            this.nextTickTime = now;
        }
        const delay = Math.max(1, this.nextTickTime - now);
        this.tickTimer = setTimeout(() => {
            this.tickTimer = null;
            this.onTick();
            this.scheduleNextTick();
        }, delay);
    }

    setMusicSource(source: Readable | null) {
        this.detachMusicSource();
        if (!source) return;

        this.musicSource = source;
        this.musicChunks = [];
        this.musicChunkOffset = 0;
        this.musicBufferedBytes = 0;
        this.musicRemainder = null;
        this.musicSourceEnded = false;
        this.musicSourcePauseApplied = false;
        this.musicActive = true;
        this.musicPaused = false;
        // Wait for at least 3 frames (60ms) before starting playback to prevent initial underrun click
        this.musicPrebuffering = true;
        this.playedMusicBytes = 0;

        const onData = (chunk: Buffer) => {
            if (this.musicSource !== source) return;
            let working = this.musicRemainder ? Buffer.concat([this.musicRemainder, chunk]) : chunk;
            const rem = working.length % PCM_STEREO_FRAME_BYTES;
            if (rem !== 0) {
                this.musicRemainder = working.subarray(working.length - rem);
                working = working.subarray(0, working.length - rem);
            } else {
                this.musicRemainder = null;
            }

            if (working.length > 0) {
                this.musicChunks.push(working);
                this.musicBufferedBytes += working.length;
                if (this.musicPrebuffering && this.musicBufferedBytes >= FRAME_BYTES) {
                    this.musicPrebuffering = false;
                    this.emit('musicStart');
                }
            }

            if (this.musicBufferedBytes >= MUSIC_HIGH_WATER_BYTES && !this.musicSourcePauseApplied) {
                this.musicSourcePauseApplied = true;
                try {
                    source.pause();
                } catch {}
            }
        };

        const onEnd = () => {
            if (this.musicSource !== source) return;
            this.musicSourceEnded = true;
            this.musicPrebuffering = false;
            // Only emit musicEnd if the track actually played audio.
            // If the decoder exited with 0 bytes (e.g. seek re-spawn or error), do NOT skip the track.
            if (this.musicBufferedBytes === 0 && this.musicActive) {
                this.musicActive = false;
                if (this.playedMusicBytes > 0) {
                    this.emit('musicEnd');
                }
            }
        };

        const onError = (err: Error) => {
            if (this.musicSource !== source) return;
            this.musicSourceEnded = true;
            this.musicPrebuffering = false;
            console.error('Music source stream error:', err.message);
        };

        source.on('data', onData);
        source.once('end', onEnd);
        source.once('close', onEnd);
        source.on('error', onError);
    }

    detachMusicSource() {
        if (this.musicSource) {
            try {
                this.musicSource.removeAllListeners('data');
                this.musicSource.removeAllListeners('end');
                this.musicSource.removeAllListeners('close');
                this.musicSource.removeAllListeners('error');
            } catch {}
            this.musicSource = null;
        }
        this.musicChunks = [];
        this.musicChunkOffset = 0;
        this.musicBufferedBytes = 0;
        this.musicRemainder = null;
        this.musicSourceEnded = false;
        this.musicSourcePauseApplied = false;
        this.musicActive = false;
        this.musicPrebuffering = false;
    }

    setMusicPaused(paused: boolean) {
        this.musicPaused = paused;
        if (!paused && this.musicSource && this.musicSourcePauseApplied && this.musicBufferedBytes < MUSIC_LOW_WATER_BYTES) {
            this.musicSourcePauseApplied = false;
            try {
                this.musicSource.resume();
            } catch {}
        }
    }

    getPlayedMusicSeconds(): number {
        return Math.floor(this.playedMusicBytes / PCM_BYTES_PER_SECOND);
    }

    setMusicVolume(volume: number) {
        this.musicVolume = Math.max(0, Math.min(volume, 2.0));
    }

    setSfxVolume(volume: number) {
        const clamped = Math.max(0, Math.min(volume, 2.0));
        this.sfxVolume = clamped;
        for (const sfx of this.activeSfx) {
            sfx.volume = clamped;
        }
    }

    addSfx(id: number, rawOrLoopedBuffer: Buffer, volume: number = 1.0, loop: boolean = false) {
        const alignedLen = rawOrLoopedBuffer.length & ~3;
        if (alignedLen === 0) return;
        const alignedBuffer = alignedLen === rawOrLoopedBuffer.length
            ? rawOrLoopedBuffer
            : rawOrLoopedBuffer.subarray(0, alignedLen);

        if (loop) {
            const existingLoop = this.activeSfx.find(s => s.id === id && s.loop);
            if (existingLoop) {
                existingLoop.volume = volume;
                return;
            }
            const loopBuffer = createSeamlessLoopBuffer(alignedBuffer);
            this.activeSfx.push({
                instanceId: this.nextInstanceId++,
                id,
                buffer: loopBuffer,
                offset: 0,
                volume,
                loop: true
            });
        } else {
            // Allow triggering a one-shot without breaking an existing ambient loop of the same sound,
            // or restart an existing non-looping instance of the same sound to prevent stacking 20 identical hits
            const existingOneShot = this.activeSfx.find(s => s.id === id && !s.loop);
            if (existingOneShot) {
                existingOneShot.volume = volume;
                existingOneShot.offset = 0;
                return;
            }
            this.activeSfx.push({
                instanceId: this.nextInstanceId++,
                id,
                buffer: alignedBuffer,
                offset: 0,
                volume,
                loop: false
            });
        }
    }

    removeSfx(id: number) {
        for (let i = this.activeSfx.length - 1; i >= 0; i--) {
            if (this.activeSfx[i].id === id && this.activeSfx[i].loop) {
                this.activeSfx.splice(i, 1);
            }
        }
        if (this.activeSfx.length === 0) {
            this.emit('empty');
        }
    }

    clearSfx() {
        this.activeSfx = [];
        this.emit('empty');
    }

    isSfxActive(id: number): boolean {
        return this.activeSfx.some(s => s.id === id);
    }

    isSfxLooping(id: number): boolean {
        return this.activeSfx.some(s => s.id === id && s.loop);
    }

    getActiveLoopIds(): number[] {
        return this.activeSfx.filter(s => s.loop).map(s => s.id);
    }

    hasActiveSfx(): boolean {
        return this.activeSfx.length > 0;
    }

    private pullMusicBytes(target: Buffer): number {
        if (!this.musicActive || this.musicPaused || this.musicPrebuffering) {
            return 0;
        }
        if (!this.musicSourceEnded && this.musicBufferedBytes < FRAME_BYTES) {
            // Brief network starvation: wait until full frame is available rather than tearing
            return 0;
        }

        let written = 0;
        while (written < FRAME_BYTES && this.musicChunks.length > 0) {
            const head = this.musicChunks[0];
            const available = head.length - this.musicChunkOffset;
            const toCopy = Math.min(FRAME_BYTES - written, available);

            head.copy(target, written, this.musicChunkOffset, this.musicChunkOffset + toCopy);
            written += toCopy;
            this.musicChunkOffset += toCopy;
            this.musicBufferedBytes -= toCopy;

            if (this.musicChunkOffset >= head.length) {
                this.musicChunks.shift();
                this.musicChunkOffset = 0;
            }
        }

        this.playedMusicBytes += written;

        if (
            this.musicSource &&
            this.musicSourcePauseApplied &&
            !this.musicSourceEnded &&
            this.musicBufferedBytes < MUSIC_LOW_WATER_BYTES
        ) {
            this.musicSourcePauseApplied = false;
            try {
                this.musicSource.resume();
            } catch {}
        }

        if (this.musicSourceEnded && this.musicBufferedBytes === 0 && this.musicActive) {
            this.musicActive = false;
            // Emit on next tick so current frame finishes pushing first, only if audio actually played
            if (this.playedMusicBytes > 0) {
                setImmediate(() => this.emit('musicEnd'));
            }
        }

        return written;
    }

    private onTick() {
        if (this.isDestroyedMixer) return;

        const frame = Buffer.alloc(FRAME_BYTES);
        const musicBytes = this.pullMusicBytes(frame);
        const vol = this.musicVolume;

        if (musicBytes > 0 && vol !== 1.0) {
            for (let i = 0; i < musicBytes; i += 2) {
                let sample = Math.round(frame.readInt16LE(i) * vol);
                if (sample > 32767) sample = 32767;
                else if (sample < -32768) sample = -32768;
                frame.writeInt16LE(sample, i);
            }
        }

        if (this.activeSfx.length > 0) {
            for (let sfxIdx = this.activeSfx.length - 1; sfxIdx >= 0; sfxIdx--) {
                const sfx = this.activeSfx[sfxIdx];
                let chunkOffset = 0;
                let chunkRemaining = FRAME_BYTES;

                while (chunkRemaining > 0) {
                    const remainingSfx = sfx.buffer.length - sfx.offset;
                    const bytesToMix = Math.min(chunkRemaining, remainingSfx) & ~3;

                    if (bytesToMix <= 0) {
                        if (sfx.loop) {
                            sfx.offset = 0;
                            continue;
                        } else {
                            this.activeSfx.splice(sfxIdx, 1);
                            if (this.activeSfx.length === 0) {
                                this.emit('empty');
                            }
                            break;
                        }
                    }

                    const sfxVol = sfx.volume;
                    for (let i = 0; i < bytesToMix; i += 2) {
                        const m = frame.readInt16LE(chunkOffset + i);
                        const s = Math.round(sfx.buffer.readInt16LE(sfx.offset + i) * sfxVol);
                        const sum = softClipInt16(m + s);
                        frame.writeInt16LE(sum, chunkOffset + i);
                    }

                    sfx.offset += bytesToMix;
                    chunkOffset += bytesToMix;
                    chunkRemaining -= bytesToMix;

                    if (sfx.offset >= sfx.buffer.length) {
                        if (sfx.loop) {
                            sfx.offset = 0;
                        } else {
                            this.activeSfx.splice(sfxIdx, 1);
                            if (this.activeSfx.length === 0) {
                                this.emit('empty');
                            }
                            break;
                        }
                    }
                }
            }
        }

        this.push(frame);
    }

    static invalidateSfxPcmCache(filePath: string): void {
        invalidateSfxPcmCache(filePath);
    }

    static getSfxPcmBuffer(filePath: string): Promise<Buffer> {
        return getSfxPcmBuffer(filePath);
    }
}

