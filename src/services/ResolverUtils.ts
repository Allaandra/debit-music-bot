import path from 'path';
import fs from 'fs';
import youtubedl from 'youtube-dl-exec';
import { Track } from './types';

// Maximum cache TTL (capped by actual signed URL expiration time minus 60s safety margin)
export const RESOLVE_CACHE_TTL_MS = 45 * 60 * 1000;
export const MAX_RESOLVE_CACHE_SIZE = 500;
export const resolvedCache = new Map<string, { track: Track; expiresAt: number }>();

export const YOUTUBE_AUTH_COOKIE_NAMES = [
    'SID',
    'HSID',
    'SSID',
    'APISID',
    'SAPISID',
    '__Secure-1PSID',
    '__Secure-3PSID',
    'LOGIN_INFO'
];

export function resolveCookieFilePath(): string | null {
    const envPath = process.env.YOUTUBE_COOKIES_FILE;
    if (envPath) {
        const resolved = path.resolve(envPath);
        if (fs.existsSync(resolved)) return resolved;
    }
    const candidates = [
        path.resolve('cookies.txt'),
        path.join(process.cwd(), 'cookies.txt'),
        path.resolve(__dirname, '..', '..', 'cookies.txt'),
        'D:\\Bot\\cookies.txt'
    ];
    for (const cand of candidates) {
        if (fs.existsSync(cand)) return cand;
    }
    return null;
}

export function getCacheKey(type: 'local' | 'url', query: string): string {
    return `${type}:${query.trim()}`;
}

/**
 * Extracts the real expiration timestamp (ms) from a signed SoundCloud CloudFront Policy or YouTube expire param,
 * subtracting a 60-second safety margin so expired stream URLs are never served from cache.
 */
export function getStreamUrlExpiresAt(streamUrl: string): number {
    const defaultExpiry = Date.now() + RESOLVE_CACHE_TTL_MS;
    if (!streamUrl || !streamUrl.startsWith('http')) {
        return defaultExpiry;
    }
    try {
        const u = new URL(streamUrl);
        const policyParam = u.searchParams.get('Policy');
        if (policyParam) {
            const b64 = policyParam.replace(/-/g, '+').replace(/_/g, '/').replace(/~/g, '=');
            const raw = Buffer.from(b64, 'base64').toString('utf8');
            const epochMatch = raw.match(/"AWS:EpochTime"\s*:\s*(\d+)/);
            if (epochMatch && epochMatch[1]) {
                const epochSec = Number(epochMatch[1]);
                if (epochSec > 0) {
                    return Math.min(defaultExpiry, epochSec * 1000 - 60_000);
                }
            }
        }
        const expParam = u.searchParams.get('expire') || u.searchParams.get('expires');
        if (expParam && /^\d+$/.test(expParam)) {
            return Math.min(defaultExpiry, Number(expParam) * 1000 - 60_000);
        }
    } catch {}
    return defaultExpiry;
}

/**
 * SoundCloud's outer playlist.m3u8 URL has a CloudFront Policy valid for only ~4 minutes (260s),
 * whereas the segment URLs inside playlist.m3u8 carry a wildcard /* Policy valid for 2 hours (7340s).
 * Upgrading playlist.m3u8 with the wildcard query string prevents 403 Forbidden errors on cached/paused tracks.
 */
export async function upgradeSoundCloudM3u8Url(streamUrl: string): Promise<string> {
    if (!streamUrl.includes('soundcloud.cloud') || !streamUrl.includes('playlist.m3u8')) {
        return streamUrl;
    }
    try {
        const res = await fetch(streamUrl);
        if (!res.ok) return streamUrl;
        const text = await res.text();
        const match = text.match(/(?:init\.mp4|data000\.\w+)\?(\S+)/);
        if (match && match[1]) {
            const cleanQuery = match[1].replace(/["']/g, '');
            const baseUrl = streamUrl.split('?')[0];
            return `${baseUrl}?${cleanQuery}`;
        }
    } catch {}
    return streamUrl;
}

export function storeResolvedTrack(key: string, track: Track) {
    const expiresAt = track.type === 'url' ? getStreamUrlExpiresAt(track.url || '') : Date.now() + RESOLVE_CACHE_TTL_MS;
    if (expiresAt <= Date.now()) {
        return;
    }
    if (resolvedCache.has(key)) {
        resolvedCache.delete(key);
    }
    while (resolvedCache.size >= MAX_RESOLVE_CACHE_SIZE) {
        const oldest = resolvedCache.keys().next().value;
        if (!oldest) break;
        resolvedCache.delete(oldest);
    }
    resolvedCache.set(key, {
        track,
        expiresAt
    });
}

export function isPreviewEntry(entry: any): boolean {
    if (!entry) return false;
    if (typeof entry.format_id === 'string' && entry.format_id.includes('preview')) {
        return true;
    }
    if (Array.isArray(entry.formats) && entry.formats.length > 0) {
        const allPreview = entry.formats.every(
            (f: any) => typeof f.format_id === 'string' && f.format_id.includes('preview')
        );
        if (allPreview) return true;
    }
    return false;
}

export function extractTrackInfo(info: any, rejectPreviews: boolean = false) {
    if (!info) return null;
    let entry = info;
    if (Array.isArray(info.entries)) {
        const validEntries = info.entries.filter(Boolean);
        if (validEntries.length === 0) return null;
        // Prefer the first full-length (non-30s Go+ preview) entry
        const fullEntry = validEntries.find((e: any) => !isPreviewEntry(e));
        if (fullEntry) {
            entry = fullEntry;
        } else if (rejectPreviews) {
            return null;
        } else {
            entry = validEntries[0];
        }
    } else if (rejectPreviews && isPreviewEntry(entry)) {
        return null;
    }

    // Prefer entry.url selected by yt-dlp according to -f bestaudio/best; fallback to progressive formats if entry.url missing
    let streamUrl = entry?.url;
    if (!streamUrl && Array.isArray(entry?.formats)) {
        const progressive = entry.formats.find(
            (f: any) =>
                typeof f.url === 'string' &&
                f.url.startsWith('http') &&
                (f.protocol === 'http' || f.protocol === 'https') &&
                f.acodec &&
                f.acodec !== 'none' &&
                !String(f.format_id || '').includes('preview')
        );
        if (progressive?.url) {
            streamUrl = progressive.url;
        }
    }

    if (!streamUrl || typeof streamUrl !== 'string' || !streamUrl.startsWith('http')) {
        return null;
    }
    return {
        title: entry.title,
        artist: entry.uploader || entry.channel || entry.artist || 'Unknown',
        duration: typeof entry.duration === 'number' ? Math.round(entry.duration) : 0,
        streamUrl,
        thumbnail: entry.thumbnail,
        extractor: entry.extractor_key || info.extractor_key || entry.extractor || info.extractor
    };
}

export function buildYtDlpOptions(includeCookies: boolean, isYoutube: boolean = false): any {
    const opts: any = {
        dumpSingleJson: true,
        f: isYoutube ? 'bestaudio/best' : 'bestaudio',
        noWarnings: true,
        noPlaylist: true,
        skipDownload: true,
        noCheckCertificates: true,
        jsRuntimes: 'node'
    };

    if (isYoutube) {
        opts.extractorArgs = 'youtube:player_client=web_embedded,web';
    }

    if (includeCookies) {
        const cookiePath = resolveCookieFilePath();
        if (cookiePath) {
            opts.cookies = cookiePath;
        } else if (process.env.YOUTUBE_BROWSER_COOKIES) {
            opts.cookiesFromBrowser = process.env.YOUTUBE_BROWSER_COOKIES;
        }
    }

    return opts;
}

/**
 * Runs yt-dlp for YouTube targets using the user's cookies + Node.js JS challenge solver (jsRuntimes: 'node').
 */
export async function runYoutubeYtDlp(target: string): Promise<any> {
    const cookiePath = resolveCookieFilePath();
    const hasCookies = !!(cookiePath || process.env.YOUTUBE_BROWSER_COOKIES);

    if (hasCookies) {
        try {
            const info = await youtubedl(target, buildYtDlpOptions(true, true));
            console.log(`[Cookies] 🍪 YouTube-поток успешно получен с использованием cookies (${target})`);
            return info;
        } catch (cookieErr: any) {
            const firstLine = cookieErr?.message?.split('\n').find((l: string) => l.includes('ERROR')) || cookieErr?.message?.split('\n')[0];
            console.error(`[Cookies] ❌ Ошибка при запросе к YouTube с cookies (${target}):`, firstLine);
            throw cookieErr;
        }
    }

    console.warn(`[Cookies] ⚠️ Запрос к YouTube выполняется без cookies (${target}) — рекомендуется настроить cookies.txt`);
    return await youtubedl(target, buildYtDlpOptions(false, true));
}
