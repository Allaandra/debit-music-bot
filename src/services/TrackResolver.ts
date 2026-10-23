import path from 'path';
import fs from 'fs';
import youtubedl from 'youtube-dl-exec';
import spotifyUrlInfo from 'spotify-url-info';
import { Track } from './types';

// @ts-ignore
const spotify = spotifyUrlInfo(fetch);

// Cache resolved stream URLs for 45 minutes (YouTube/SoundCloud URLs stay valid for 1-6 hours)
const RESOLVE_CACHE_TTL_MS = 45 * 60 * 1000;
const MAX_RESOLVE_CACHE_SIZE = 500;
const resolvedCache = new Map<string, { track: Track; expiresAt: number }>();
const inFlightResolutions = new Map<string, Promise<Track>>();

// Background prefetch queue (single concurrency so it never competes with active user actions)
const prefetchQueue: Array<{ type: 'local' | 'url'; query: string }> = [];
const queuedPrefetchKeys = new Set<string>();
let isPrefetchRunning = false;

// Self-healing flag: if the configured cookies file is expired ("The page needs to be reloaded"),
// automatically disable it so every resolution doesn't waste 6.5s failing on stale cookies.
let cookiesMarkedInvalid = false;

function getCacheKey(type: 'local' | 'url', query: string): string {
    return `${type}:${query.trim()}`;
}

function storeResolvedTrack(key: string, track: Track) {
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
        expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS
    });
}

function extractTrackInfo(info: any) {
    if (!info) return null;
    let entry = info;
    if (Array.isArray(info.entries)) {
        if (info.entries.length === 0) return null;
        entry = info.entries[0];
    }
    const streamUrl = entry?.url;
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

function buildYtDlpOptions(includeCookies: boolean): any {
    const opts: any = {
        dumpSingleJson: true,
        f: 'bestaudio',
        noWarnings: true,
        noPlaylist: true,
        skipDownload: true,
        noCheckCertificates: true
    };

    if (includeCookies && !cookiesMarkedInvalid) {
        if (process.env.YOUTUBE_COOKIES_FILE) {
            const resolvedCookiePath = path.resolve(process.env.YOUTUBE_COOKIES_FILE);
            if (fs.existsSync(resolvedCookiePath)) {
                opts.cookies = resolvedCookiePath;
            }
        } else if (process.env.YOUTUBE_BROWSER_COOKIES) {
            opts.cookiesFromBrowser = process.env.YOUTUBE_BROWSER_COOKIES;
        }
    }

    return opts;
}

async function runYtDlpWithCookieHeal(target: string): Promise<any> {
    const hasCookiesConfigured = !cookiesMarkedInvalid && !!(process.env.YOUTUBE_COOKIES_FILE || process.env.YOUTUBE_BROWSER_COOKIES);
    try {
        return await youtubedl(target, buildYtDlpOptions(hasCookiesConfigured));
    } catch (err: any) {
        const msg = err?.message || '';
        if (
            hasCookiesConfigured &&
            (msg.includes('The page needs to be reloaded') ||
                msg.includes('cookies are no longer valid') ||
                msg.includes('This video is unavailable'))
        ) {
            console.warn('[TrackResolver] YouTube cookies file appears expired/invalid. Disabling cookies and retrying directly...');
            cookiesMarkedInvalid = true;
            return await youtubedl(target, buildYtDlpOptions(false));
        }
        throw err;
    }
}

export class TrackResolver {
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
        let thumbnail = undefined;
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

        // Check if Spotify link
        if (searchQuery.includes('spotify.com') || searchQuery.startsWith('spotify:')) {
            try {
                const data = await spotify.getPreview(searchQuery);
                title = data.title;
                artist = data.artist;
                thumbnail = data.image;
                searchQuery = `${title} ${artist}`;
                isDirectUrl = false;
            } catch (spotifyErr: any) {
                console.error('[Spotify] Failed to get preview:', spotifyErr.message || spotifyErr);
            }
        }

        if (!isDirectUrl) {
            // 1. Try YouTube search first
            try {
                const ytInfo = await runYtDlpWithCookieHeal(`ytsearch1:${searchQuery}`);
                const res = extractTrackInfo(ytInfo);
                if (res) {
                    title = title !== query && title ? title : res.title;
                    artist = artist !== 'Unknown' && artist ? artist : res.artist;
                    duration = duration || res.duration;
                    streamUrl = res.streamUrl;
                    thumbnail = thumbnail || res.thumbnail;
                    platform = 'YouTube';
                    return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
                }
            } catch (ytErr: any) {
                console.warn(`[YouTube] Search error for "${searchQuery}":`, ytErr.message?.split('\n')[0]);
            }

            // 2. Fallback to SoundCloud search
            try {
                const scInfo = await youtubedl(`scsearch1:${searchQuery}`, buildYtDlpOptions(false));
                const scRes = extractTrackInfo(scInfo);
                if (scRes) {
                    title = title !== query && title ? title : scRes.title;
                    artist = artist !== 'Unknown' && artist ? artist : scRes.artist;
                    duration = duration || scRes.duration;
                    streamUrl = scRes.streamUrl;
                    thumbnail = thumbnail || scRes.thumbnail;
                    platform = 'SoundCloud';
                    return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
                }
            } catch (scErr: any) {
                console.warn(`[SoundCloud] Search error for "${searchQuery}":`, scErr.message?.split('\n')[0]);
            }

            throw new Error(`Не удалось найти трек "${query}" ни на YouTube, ни на SoundCloud.`);
        } else {
            // Direct URL (YouTube, SoundCloud, or other web source)
            try {
                const info = await runYtDlpWithCookieHeal(searchQuery);
                const res = extractTrackInfo(info);
                if (res) {
                    title = res.title;
                    artist = res.artist;
                    duration = res.duration;
                    streamUrl = res.streamUrl;
                    thumbnail = res.thumbnail;
                    platform = res.extractor?.includes('SoundCloud') ? 'SoundCloud' : 'YouTube';
                    return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
                }
            } catch (urlErr: any) {
                console.error(`[TrackResolver] Failed to resolve direct URL ${searchQuery}:`, urlErr.message?.split('\n')[0]);

                // If YouTube direct link blocked, try oEmbed + SoundCloud fallback
                if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
                    try {
                        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(searchQuery)}&format=json`);
                        const oembedJson: any = await oembedRes.json();
                        if (oembedJson?.title) {
                            console.log(`[YouTube oEmbed] Retrieved title "${oembedJson.title}", falling back to SoundCloud search...`);
                            const scInfo = await youtubedl(`scsearch1:${oembedJson.title}`, buildYtDlpOptions(false));
                            const scRes = extractTrackInfo(scInfo);
                            if (scRes) {
                                return {
                                    type,
                                    query,
                                    title: scRes.title,
                                    artist: scRes.artist,
                                    duration: scRes.duration,
                                    url: scRes.streamUrl,
                                    thumbnail: scRes.thumbnail,
                                    platform: 'SoundCloud'
                                };
                            }
                        }
                    } catch (oembedErr) {
                        console.error('[YouTube oEmbed] Fallback failed:', oembedErr);
                    }
                }
                throw new Error(`Не удалось воспроизвести ссылку: ${urlErr.message?.split('\n')[0]}`);
            }

            throw new Error(`Не удалось получить аудио-поток по ссылке: ${query}`);
        }
    }
}
