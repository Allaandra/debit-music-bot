import { Readable } from 'stream';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

// 20ms frame of 48kHz 16-bit stereo PCM = 960 stereo samples * 4 bytes = 3840 bytes
export const PCM_SAMPLE_RATE = 48000;
export const PCM_CHANNELS = 2;
export const PCM_BYTES_PER_SAMPLE = 2;
export const PCM_STEREO_FRAME_BYTES = PCM_CHANNELS * PCM_BYTES_PER_SAMPLE; // 4 bytes
export const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE * PCM_STEREO_FRAME_BYTES; // 192,000 bytes/sec
export const TICK_MS = 20;
export const FRAME_BYTES = (PCM_BYTES_PER_SECOND * TICK_MS) / 1000; // 3840 bytes

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
}

/**
 * Soft-knee limiter above ±28000 so simultaneous music + SFX never produce harsh digital clipping
 */
function softClipInt16(sample: number): number {
    const threshold = 28000;
    if (sample > threshold) {
        const excess = sample - threshold;
        return Math.min(32767, threshold + Math.round((4767 * excess) / (excess + 4767)));
    }
    if (sample < -threshold) {
        const excess = -sample - threshold;
        return Math.max(-32768, -threshold - Math.round((4768 * excess) / (excess + 4768)));
    }
    return sample;
}

/**
 * Prepares a decoded SFX PCM buffer:
 * 1. Ensures 4-byte stereo frame alignment.
 * 2. Trims dead MP3 encoder silence at start/end so short sounds don't "choke" when looped.
 * 3. Applies static constant-gain peak normalization (no pumping/loudness jumps).
 * 4. Applies a 5ms micro-fade at start and end to eliminate any boundary clicks.
 */
function prepareCleanSfxBuffer(raw: Buffer): Buffer {
    const alignedLen = raw.length & ~3;
    if (alignedLen < PCM_STEREO_FRAME_BYTES * 8) {
        return raw.subarray(0, alignedLen);
    }

    const totalFrames = alignedLen / PCM_STEREO_FRAME_BYTES;
    const silenceThreshold = 80; // ~ -52 dBFS
    const padFrames = Math.min(240, Math.floor(totalFrames * 0.05)); // Keep up to 5ms natural pad

    let firstActiveFrame = 0;
    while (firstActiveFrame < totalFrames - 1) {
        const idx = firstActiveFrame * 4;
        const l = Math.abs(raw.readInt16LE(idx));
        const r = Math.abs(raw.readInt16LE(idx + 2));
        if (l > silenceThreshold || r > silenceThreshold) break;
        firstActiveFrame++;
    }

    let lastActiveFrame = totalFrames - 1;
    while (lastActiveFrame > firstActiveFrame) {
        const idx = lastActiveFrame * 4;
        const l = Math.abs(raw.readInt16LE(idx));
        const r = Math.abs(raw.readInt16LE(idx + 2));
        if (l > silenceThreshold || r > silenceThreshold) break;
        lastActiveFrame--;
    }

    const startFrame = Math.max(0, firstActiveFrame - padFrames);
    const endFrame = Math.min(totalFrames, lastActiveFrame + padFrames + 1);
    const trimmed = Buffer.from(raw.subarray(startFrame * 4, endFrame * 4));
    const frameCount = trimmed.length / 4;
    if (frameCount === 0) return trimmed;

    // Static peak detection
    let peak = 0;
    for (let i = 0; i < trimmed.length; i += 2) {
        const val = Math.abs(trimmed.readInt16LE(i));
        if (val > peak) peak = val;
    }

    // Target peak ~24000 (-2.7 dBFS), max boost 3.5x so quiet ambient tails aren't over-amplified
    const targetPeak = 24000;
    const gain = peak > 0 ? Math.min(3.5, targetPeak / peak) : 1.0;

    // 5ms (240 frames) micro fade-in/out to prevent clicks
    const fadeFrames = Math.min(240, Math.floor(frameCount / 4));

    for (let f = 0; f < frameCount; f++) {
        let env = 1.0;
        if (fadeFrames > 0) {
            if (f < fadeFrames) {
                env = f / fadeFrames;
            } else if (f >= frameCount - fadeFrames) {
                env = (frameCount - 1 - f) / fadeFrames;
            }
        }
        const mult = gain * env;
        const byteIdx = f * 4;
        const l = Math.max(-32768, Math.min(32767, Math.round(trimmed.readInt16LE(byteIdx) * mult)));
        const r = Math.max(-32768, Math.min(32767, Math.round(trimmed.readInt16LE(byteIdx + 2) * mult)));
        trimmed.writeInt16LE(l, byteIdx);
        trimmed.writeInt16LE(r, byteIdx + 2);
    }

    return trimmed;
}

/**
 * Builds a seamless cyclical loop buffer by overlapping and crossfading the tail into the head.
 * At wrap-around (end -> 0), sample N-F-1 flows directly into sample N-F with zero seam!
 */
function createSeamlessLoopBuffer(src: Buffer): Buffer {
    const totalFrames = Math.floor(src.length / 4);
    // Crossfade up to 35ms (1680 frames) or 15% of short clips
    const crossfadeFrames = Math.min(1680, Math.floor(totalFrames * 0.15));
    if (crossfadeFrames < 32 || totalFrames < 200) {
        return src;
    }

    const loopFrames = totalFrames - crossfadeFrames;
    const out = Buffer.allocUnsafe(loopFrames * 4);

    for (let k = 0; k < crossfadeFrames; k++) {
        // Equal-power / smooth cosine crossfade from tail (N - F + k) into head (k)
        const t = k / crossfadeFrames;
        const fadeIn = Math.sin(t * Math.PI * 0.5);
        const fadeOut = Math.cos(t * Math.PI * 0.5);

        const headIdx = k * 4;
        const tailIdx = (loopFrames + k) * 4;

        const l = Math.round(src.readInt16LE(headIdx) * fadeIn + src.readInt16LE(tailIdx) * fadeOut);
        const r = Math.round(src.readInt16LE(headIdx + 2) * fadeIn + src.readInt16LE(tailIdx + 2) * fadeOut);

        out.writeInt16LE(Math.max(-32768, Math.min(32767, l)), headIdx);
        out.writeInt16LE(Math.max(-32768, Math.min(32767, r)), headIdx + 2);
    }

    // Copy the middle body (F .. N - F - 1) directly
    src.copy(out, crossfadeFrames * 4, crossfadeFrames * 4, loopFrames * 4);
    return out;
}

// Bounded LRU cache for decoded SFX PCM buffers (max 64 MB)
const MAX_PCM_CACHE_BYTES = 64 * 1024 * 1024;
const pcmCache = new Map<string, Buffer>();
const inFlightDecodes = new Map<string, Promise<Buffer>>();
let currentCacheBytes = 0;

function storeInPcmCache(filePath: string, buf: Buffer) {
    if (pcmCache.has(filePath)) {
        currentCacheBytes -= pcmCache.get(filePath)!.length;
        pcmCache.delete(filePath);
    }
    if (buf.length > MAX_PCM_CACHE_BYTES) {
        return; // Too large to cache in RAM
    }
    while (currentCacheBytes + buf.length > MAX_PCM_CACHE_BYTES && pcmCache.size > 0) {
        const oldestKey = pcmCache.keys().next().value;
        if (!oldestKey) break;
        const oldestBuf = pcmCache.get(oldestKey)!;
        currentCacheBytes -= oldestBuf.length;
        pcmCache.delete(oldestKey);
    }
    pcmCache.set(filePath, buf);
    currentCacheBytes += buf.length;
}

export function invalidateSfxPcmCache(filePath: string) {
    const existing = pcmCache.get(filePath);
    if (existing) {
        currentCacheBytes -= existing.length;
        pcmCache.delete(filePath);
    }
}

export async function getSfxPcmBuffer(filePath: string): Promise<Buffer> {
    if (pcmCache.has(filePath)) {
        const buf = pcmCache.get(filePath)!;
        // Refresh LRU order
        pcmCache.delete(filePath);
        pcmCache.set(filePath, buf);
        return buf;
    }

    if (inFlightDecodes.has(filePath)) {
        return inFlightDecodes.get(filePath)!;
    }

    const decodePromise = new Promise<Buffer>((resolve, reject) => {
        const proc = spawn(ffmpegPath as string, [
            '-hide_banner',
            '-loglevel', 'error',
            '-i', filePath,
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        const chunks: Buffer[] = [];
        proc.stdout.on('data', (c: Buffer) => chunks.push(c));
        proc.stderr.on('data', () => {});
        proc.on('close', (code) => {
            inFlightDecodes.delete(filePath);
            if (code === 0) {
                const raw = Buffer.concat(chunks);
                const prepared = prepareCleanSfxBuffer(raw);
                storeInPcmCache(filePath, prepared);
                resolve(prepared);
            } else {
                reject(new Error(`Failed to decode SFX to PCM (exit code ${code})`));
            }
        });
        proc.on('error', (err) => {
            inFlightDecodes.delete(filePath);
            reject(err);
        });
    });

    inFlightDecodes.set(filePath, decodePromise);
    return decodePromise;
}
