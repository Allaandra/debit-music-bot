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

/**
 * Soft-knee limiter above ±28000 so simultaneous music + SFX never produce harsh digital clipping
 */
export function softClipInt16(sample: number): number {
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
export function prepareCleanSfxBuffer(raw: Buffer): Buffer {
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

    // Target peak ~30000 (-0.77 dBFS), max boost 4.5x so quiet ambient tails aren't over-amplified
    const targetPeak = 30000;
    const gain = peak > 0 ? Math.min(4.5, targetPeak / peak) : 1.0;

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
export function createSeamlessLoopBuffer(src: Buffer): Buffer {
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
