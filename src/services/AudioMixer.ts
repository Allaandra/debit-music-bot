import { Transform, TransformCallback } from 'stream';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

interface ActiveSfx {
    buffer: Buffer;
    offset: number;
    volume: number;
}

export class AudioMixer extends Transform {
    private activeSfx: ActiveSfx[] = [];

    constructor() {
        super();
    }

    addSfx(buffer: Buffer, volume: number = 1.0) {
        this.activeSfx.push({ buffer, offset: 0, volume });
    }

    hasActiveSfx(): boolean {
        return this.activeSfx.length > 0;
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        if (this.activeSfx.length === 0) {
            callback(null, chunk);
            return;
        }

        const mixed = Buffer.from(chunk);
        const chunkLen = mixed.length;

        for (let sfxIdx = this.activeSfx.length - 1; sfxIdx >= 0; sfxIdx--) {
            const sfx = this.activeSfx[sfxIdx];
            const remainingSfx = sfx.buffer.length - sfx.offset;
            const bytesToMix = Math.min(chunkLen, remainingSfx);

            for (let i = 0; i < bytesToMix; i += 2) {
                const m = mixed.readInt16LE(i);
                const s = Math.round(sfx.buffer.readInt16LE(sfx.offset + i) * sfx.volume);
                let sum = m + s;
                if (sum > 32767) sum = 32767;
                else if (sum < -32768) sum = -32768;
                mixed.writeInt16LE(sum, i);
            }

            sfx.offset += bytesToMix;
            if (sfx.offset >= sfx.buffer.length) {
                this.activeSfx.splice(sfxIdx, 1);
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
