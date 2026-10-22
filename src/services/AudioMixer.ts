import { Transform, TransformCallback } from 'stream';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

interface ActiveSfx {
    id: number;
    buffer: Buffer;
    offset: number;
    volume: number;
    loop: boolean;
}

export class AudioMixer extends Transform {
    private activeSfx: ActiveSfx[] = [];
    private remainder: Buffer | null = null;
    public musicVolume: number = 1.0;

    constructor(initialMusicVolume: number = 1.0) {
        super();
        this.musicVolume = initialMusicVolume;
    }

    setMusicVolume(volume: number) {
        this.musicVolume = Math.max(0, Math.min(volume, 2.0));
    }

    addSfx(id: number, buffer: Buffer, volume: number = 1.0, loop: boolean = false) {
        // Ensure buffer is 2-byte aligned for s16le
        const alignedBuffer = buffer.length % 2 === 0 ? buffer : buffer.subarray(0, buffer.length - 1);
        if (alignedBuffer.length === 0) return;

        const existing = this.activeSfx.find(s => s.id === id);
        if (existing) {
            existing.volume = volume;
            existing.loop = loop;
            if (!loop) {
                existing.offset = 0;
            }
            return;
        }
        this.activeSfx.push({ id, buffer: alignedBuffer, offset: 0, volume, loop });
    }

    removeSfx(id: number) {
        const idx = this.activeSfx.findIndex(s => s.id === id);
        if (idx !== -1) {
            this.activeSfx.splice(idx, 1);
        }
    }

    clearSfx() {
        this.activeSfx = [];
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

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        let working = this.remainder ? Buffer.concat([this.remainder, chunk]) : chunk;
        const remainderBytes = working.length % 2;
        if (remainderBytes !== 0) {
            this.remainder = working.subarray(working.length - remainderBytes);
            working = working.subarray(0, working.length - remainderBytes);
        } else {
            this.remainder = null;
        }

        const chunkLen = working.length;
        if (chunkLen === 0) {
            callback();
            return;
        }

        const vol = this.musicVolume;
        const hasSfx = this.activeSfx.length > 0;

        if (vol === 1.0 && !hasSfx) {
            callback(null, working);
            return;
        }

        const mixed = Buffer.from(working);

        // Масштабирование громкости музыки
        if (vol !== 1.0) {
            for (let i = 0; i < chunkLen; i += 2) {
                let sample = mixed.readInt16LE(i);
                sample = Math.round(sample * vol);
                if (sample > 32767) sample = 32767;
                else if (sample < -32768) sample = -32768;
                mixed.writeInt16LE(sample, i);
            }
        }

        // Наложение звуковых эффектов (SFX)
        if (hasSfx) {
            for (let sfxIdx = this.activeSfx.length - 1; sfxIdx >= 0; sfxIdx--) {
                const sfx = this.activeSfx[sfxIdx];
                let chunkOffset = 0;
                let chunkRemaining = chunkLen;

                while (chunkRemaining > 0) {
                    const remainingSfx = sfx.buffer.length - sfx.offset;
                    const bytesToMix = Math.min(chunkRemaining, remainingSfx) & ~1;

                    if (bytesToMix <= 0) {
                        if (sfx.loop) {
                            sfx.offset = 0;
                            continue;
                        } else {
                            this.activeSfx.splice(sfxIdx, 1);
                            break;
                        }
                    }

                    for (let i = 0; i < bytesToMix; i += 2) {
                        const m = mixed.readInt16LE(chunkOffset + i);
                        const s = Math.round(sfx.buffer.readInt16LE(sfx.offset + i) * sfx.volume);
                        let sum = m + s;
                        if (sum > 32767) sum = 32767;
                        else if (sum < -32768) sum = -32768;
                        mixed.writeInt16LE(sum, chunkOffset + i);
                    }

                    sfx.offset += bytesToMix;
                    chunkOffset += bytesToMix;
                    chunkRemaining -= bytesToMix;

                    if (sfx.offset >= sfx.buffer.length) {
                        if (sfx.loop) {
                            // Бесшовное зацикливание: сброс в начало буфера
                            sfx.offset = 0;
                        } else {
                            // Одиночный звук завершился
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

        callback(null, mixed);
    }
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
            '-i', filePath,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
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
                const aligned = raw.length % 2 === 0 ? raw : raw.subarray(0, raw.length - 1);
                storeInPcmCache(filePath, aligned);
                resolve(aligned);
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
