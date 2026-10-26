import path from 'path';
import fs from 'fs';
import youtubedl from 'youtube-dl-exec';
import spotifyUrlInfo from 'spotify-url-info';
import { prisma } from '../database';
import { Track } from './types';

// @ts-ignore
const spotify = spotifyUrlInfo(fetch);

// Maximum cache TTL (capped by actual signed URL expiration time minus 60s safety margin)
const RESOLVE_CACHE_TTL_MS = 45 * 60 * 1000;
const MAX_RESOLVE_CACHE_SIZE = 500;
const resolvedCache = new Map<string, { track: Track; expiresAt: number }>();
const inFlightResolutions = new Map<string, Promise<Track>>();

// Background prefetch queue (single concurrency so it never competes with active user actions)
const prefetchQueue: Array<{ type: 'local' | 'url'; query: string }> = [];
const queuedPrefetchKeys = new Set<string>();
let isPrefetchRunning = false;

const YOUTUBE_AUTH_COOKIE_NAMES = [
    'SID',
    'HSID',
    'SSID',
    'APISID',
    'SAPISID',
    '__Secure-1PSID',
    '__Secure-3PSID',
    'LOGIN_INFO'
];

function resolveCookieFilePath(): string | null {
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

function getCacheKey(type: 'local' | 'url', query: string): string {
    return `${type}:${query.trim()}`;
}

/**
 * Extracts the real expiration timestamp (ms) from a signed SoundCloud CloudFront Policy or YouTube expire param,
 * subtracting a 60-second safety margin so expired stream URLs are never served from cache.
 */
function getStreamUrlExpiresAt(streamUrl: string): number {
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
async function upgradeSoundCloudM3u8Url(streamUrl: string): Promise<string> {
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

function storeResolvedTrack(key: string, track: Track) {
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

function isPreviewEntry(entry: any): boolean {
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

function extractTrackInfo(info: any, rejectPreviews: boolean = false) {
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

function buildYtDlpOptions(includeCookies: boolean, isYoutube: boolean = false): any {
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
async function runYoutubeYtDlp(target: string): Promise<any> {
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

export class TrackResolver {
    /**
     * Checks and logs the status of YouTube cookies at server startup.
     */
    static verifyAndLogCookies(): void {
        const cookiePath = resolveCookieFilePath();
        if (cookiePath) {
            try {
                const raw = fs.readFileSync(cookiePath, 'utf8');
                const lines = raw.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
                const ytLines = lines.filter(l => l.includes('youtube.com') || l.includes('google.com'));
                const nowSec = Math.floor(Date.now() / 1000);

                const authSet = new Set(YOUTUBE_AUTH_COOKIE_NAMES);
                const foundAuth = new Set<string>();
                let expiredAuthCount = 0;

                for (const line of ytLines) {
                    const parts = line.split('\t');
                    const expiry = Number(parts[4]);
                    const name = parts[5];
                    if (name && authSet.has(name)) {
                        if (expiry > 0 && expiry < nowSec) {
                            expiredAuthCount++;
                        } else {
                            foundAuth.add(name);
                        }
                    }
                }

                if (foundAuth.size > 0 && expiredAuthCount === 0) {
                    console.log(
                        `[Cookies] ✅ Файл ${path.basename(cookiePath)} успешно собран и загружен: ` +
                        `${ytLines.length} куки YouTube (ключи авторизации: ${foundAuth.size}/${YOUTUBE_AUTH_COOKIE_NAMES.length} активны, JS-runtime: node).`
                    );
                } else if (foundAuth.size > 0 && expiredAuthCount > 0) {
                    console.warn(
                        `[Cookies] ⚠️ Файл ${path.basename(cookiePath)} загружен (${ytLines.length} куки), но ${expiredAuthCount} ключей авторизации истекли.`
                    );
                } else {
                    console.warn(
                        `[Cookies] ⚠️ Файл ${path.basename(cookiePath)} найден (${ytLines.length} куки), но в нём нет ключей авторизации аккаунта YouTube.`
                    );
                }
                return;
            } catch (err: any) {
                console.error(`[Cookies] ❌ Ошибка чтения файла cookies (${cookiePath}):`, err.message);
                return;
            }
        }

        if (process.env.YOUTUBE_BROWSER_COOKIES) {
            console.log(`[Cookies] ✅ Включено автоматическое извлечение cookies из браузера: ${process.env.YOUTUBE_BROWSER_COOKIES}`);
            return;
        }

        console.warn('[Cookies] ⚠️ Куки YouTube не настроены (файл cookies.txt не найден).');
    }

    /**
     * Warms up yt-dlp and prefetches the top tracks from the database in the background after server start
     * so the very first track connection has minimal latency.
     */
    static async warmupOnStartup(): Promise<void> {
        try {
            const recentTracks = await prisma.track.findMany({
                where: { type: 'url' },
                orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
                take: 1
            });
            for (const t of recentTracks) {
                if (t.query) {
                    this.prefetchTrack('url', t.query);
                }
            }
        } catch {}
    }

    static isYoutubePlaylist(query: string): boolean {
        try {
            const url = new URL(query.trim());
            const host = url.hostname.toLowerCase();
            if (!host.includes('youtube.com') && !host.includes('youtu.be')) return false;
            const listId = url.searchParams.get('list');
            if (!listId) return false;
            if (url.pathname.startsWith('/playlist')) return true;
            return !listId.startsWith('RD');
        } catch {
            return false;
        }
    }

    static isSpotifyPlaylistOrAlbum(query: string): boolean {
        return query.includes('spotify.com/playlist') || query.includes('spotify.com/album');
    }

    static getCachedTrack(type: 'local' | 'url', query: string): Track | null {
        const key = getCacheKey(type, query);
        const cached = resolvedCache.get(key);
        if (!cached) return null;
        if (Date.now() > cached.expiresAt) {
            resolvedCache.delete(key);
            return null;
        }
        return cached.track;
    }

    static invalidateCache(type: 'local' | 'url', query: string) {
        resolvedCache.delete(getCacheKey(type, query));
    }

    static prefetchTrack(type: 'local' | 'url', query: string) {
        if (!query) return;
        const key = getCacheKey(type, query);
        if (this.getCachedTrack(type, query) || inFlightResolutions.has(key) || queuedPrefetchKeys.has(key)) {
            return;
        }
        queuedPrefetchKeys.add(key);
        prefetchQueue.push({ type, query });
        this.processPrefetchQueue();
    }

    private static async processPrefetchQueue() {
        if (isPrefetchRunning) return;
        isPrefetchRunning = true;
        try {
            while (prefetchQueue.length > 0) {
                const next = prefetchQueue.shift()!;
                const key = getCacheKey(next.type, next.query);
                queuedPrefetchKeys.delete(key);
                if (this.getCachedTrack(next.type, next.query)) continue;
                try {
                    await this.resolveTrack(next.type, next.query);
                } catch {
                    // Ignore background prefetch errors
                }
            }
        } finally {
            isPrefetchRunning = false;
        }
    }

    static async resolveTrack(type: 'local' | 'url', query: string, forceRefresh: boolean = false): Promise<Track> {
        const key = getCacheKey(type, query);
        if (!forceRefresh) {
            const cached = this.getCachedTrack(type, query);
            if (cached) return cached;
        } else {
            resolvedCache.delete(key);
        }

        if (inFlightResolutions.has(key)) {
            return inFlightResolutions.get(key)!;
        }

        const promise = this.performResolve(type, query).then((resolved) => {
            inFlightResolutions.delete(key);
            storeResolvedTrack(key, resolved);
            return resolved;
        }).catch((err) => {
            inFlightResolutions.delete(key);
            throw err;
        });

        inFlightResolutions.set(key, promise);
        return promise;
    }

    private static async performResolve(type: 'local' | 'url', query: string): Promise<Track> {
        let title = query;
        let artist = 'Unknown';
        let duration = 0;
        let streamUrl = query;
        let thumbnail: string | undefined = undefined;
        let platform: string | undefined = undefined;

        if (type === 'local') {
            platform = 'Local';
            title = path.basename(query, path.extname(query));
            try {
                const mm = await import('music-metadata');
                const metadata = await mm.parseFile(path.join(__dirname, '..', '..', 'sounds', query));
                if (metadata.format.duration) duration = Math.round(metadata.format.duration);
                if (metadata.common.title) title = metadata.common.title;
                if (metadata.common.artist) artist = metadata.common.artist;
            } catch (e) {}
            return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
        }

        // URL or Search resolution
        let searchQuery = query.trim();
        let isDirectUrl = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');

        // Fast-path: check local SQLite database for already-known track metadata (saves ~1s network call to Spotify)
        try {
            const dbTrack = await prisma.track.findFirst({
                where: { query: searchQuery }
            });
            if (dbTrack && dbTrack.title && dbTrack.title !== searchQuery) {
                title = dbTrack.title;
                artist = dbTrack.artist || 'Unknown';
                duration = dbTrack.duration || 0;
                thumbnail = dbTrack.thumbnail || undefined;
            }
        } catch {}

        // Check if Spotify link
        if (searchQuery.includes('spotify.com') || searchQuery.startsWith('spotify:')) {
            if (title === query || artist === 'Unknown' || !thumbnail) {
                try {
                    const data = await spotify.getPreview(searchQuery);
                    title = data.title || title;
                    artist = data.artist || artist;
                    thumbnail = data.image || thumbnail;
                } catch (spotifyErr: any) {
                    console.error('[Spotify] Failed to get preview:', spotifyErr.message || spotifyErr);
                }
            }
            searchQuery = artist && artist !== 'Unknown' ? `${artist} - ${title}` : title;
            isDirectUrl = false;
        }

        if (!isDirectUrl) {
            // 1. PRIMARY: Search SoundCloud first (scsearch3 to skip any 30s Go+ preview if full track exists)
            try {
                const scInfo = await youtubedl(`scsearch3:${searchQuery}`, buildYtDlpOptions(false, false));
                const scRes = extractTrackInfo(scInfo, true);
                if (scRes) {
                    title = title !== query && title ? title : scRes.title;
                    artist = artist !== 'Unknown' && artist ? artist : scRes.artist;
                    duration = scRes.duration || duration;
                    streamUrl = await upgradeSoundCloudM3u8Url(scRes.streamUrl);
                    thumbnail = thumbnail || scRes.thumbnail;
                    platform = 'SoundCloud';
                    return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
                }
            } catch (scErr: any) {
                console.warn(`[SoundCloud] Search error for "${searchQuery}":`, scErr.message?.split('\n')[0]);
            }

            // 2. FALLBACK: Try YouTube search (with cookies) if SoundCloud had no full-length match
            try {
                const ytInfo = await runYoutubeYtDlp(`ytsearch1:${searchQuery}`);
                const res = extractTrackInfo(ytInfo);
                if (res) {
                    title = title !== query && title ? title : res.title;
                    artist = artist !== 'Unknown' && artist ? artist : res.artist;
                    duration = res.duration || duration;
                    streamUrl = res.streamUrl;
                    thumbnail = thumbnail || res.thumbnail;
                    platform = 'YouTube';
                    return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
                }
            } catch (ytErr: any) {
                console.warn(`[YouTube] Search error for "${searchQuery}":`, ytErr.message?.split('\n')[0]);
            }

            throw new Error(`Не удалось найти трек "${query}" ни на SoundCloud, ни на YouTube.`);
        } else {
            // Direct URL (SoundCloud, YouTube, or other web source)
            const isYoutubeUrl = searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be');

            // Direct extraction (YouTube URLs use cookies + jsRuntimes: 'node'; SoundCloud URLs upgrade m3u8 policy)
            try {
                const info = isYoutubeUrl
                    ? await runYoutubeYtDlp(searchQuery)
                    : await youtubedl(searchQuery, buildYtDlpOptions(false, false));
                const res = extractTrackInfo(info);
                if (res) {
                    title = title !== query && title ? title : res.title;
                    artist = artist !== 'Unknown' && artist ? artist : res.artist;
                    duration = res.duration || duration;
                    streamUrl = await upgradeSoundCloudM3u8Url(res.streamUrl);
                    thumbnail = thumbnail || res.thumbnail;
                    platform = res.extractor?.toLowerCase().includes('soundcloud') ? 'SoundCloud' : 'YouTube';
                    return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
                }
            } catch (urlErr: any) {
                // If direct YouTube URL failed, try SoundCloud fallback by title
                if (isYoutubeUrl && title && title !== query) {
                    try {
                        const fallbackQuery = artist && artist !== 'Unknown' ? `${artist} - ${title}` : title;
                        const scInfo = await youtubedl(`scsearch3:${fallbackQuery}`, buildYtDlpOptions(false, false));
                        const scRes = extractTrackInfo(scInfo, true);
                        if (scRes) {
                            streamUrl = await upgradeSoundCloudM3u8Url(scRes.streamUrl);
                            return {
                                type,
                                query,
                                title,
                                artist,
                                duration: scRes.duration || duration,
                                url: streamUrl,
                                thumbnail: thumbnail || scRes.thumbnail,
                                platform: 'SoundCloud'
                            };
                        }
                    } catch {}
                }
                console.error(`[TrackResolver] Failed to resolve direct URL ${searchQuery}:`, urlErr.message?.split('\n')[0]);
                throw new Error(`Не удалось воспроизвести ссылку: ${urlErr.message?.split('\n')[0]}`);
            }

            throw new Error(`Не удалось получить аудио-поток по ссылке: ${query}`);
        }
    }
}
