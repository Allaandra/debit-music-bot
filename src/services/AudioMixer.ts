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
    public musicVolume: number = 1.0;

    constructor(initialMusicVolume: number = 1.0) {
        super();
        this.musicVolume = initialMusicVolume;
    }

    setMusicVolume(volume: number) {
        this.musicVolume = Math.max(0, Math.min(volume, 2.0));
    }

    addSfx(id: number, buffer: Buffer, volume: number = 1.0, loop: boolean = false) {
        const existing = this.activeSfx.find(s => s.id === id);
        if (existing) {
            existing.volume = volume;
            existing.loop = loop;
            if (!loop) {
                existing.offset = 0;
            }
            return;
        }
        this.activeSfx.push({ id, buffer, offset: 0, volume, loop });
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
        const chunkLen = chunk.length;
        const vol = this.musicVolume;
        const hasSfx = this.activeSfx.length > 0;

        if (vol === 1.0 && !hasSfx) {
            callback(null, chunk);
            return;
        }

        const mixed = Buffer.from(chunk);

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
                    const bytesToMix = Math.min(chunkRemaining, remainingSfx);

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
                            break;
                        }
                    }
                }
            }
        }

        callback(null, mixed);
    }
}

// In-memory cache for decoded SFX PCM buffers
const pcmCache = new Map<string, Buffer>();

export async function getSfxPcmBuffer(filePath: string): Promise<Buffer> {
    if (pcmCache.has(filePath)) {
        return pcmCache.get(filePath)!;
    }

    return new Promise((resolve, reject) => {
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
            if (code === 0) {
                const buf = Buffer.concat(chunks);
                pcmCache.set(filePath, buf);
                resolve(buf);
            } else {
                reject(new Error(`Failed to decode SFX to PCM (exit code ${code})`));
            }
        });
        proc.on('error', reject);
    });
}
