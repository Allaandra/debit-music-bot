import path from 'path';
import youtubedl from 'youtube-dl-exec';
import spotifyUrlInfo from 'spotify-url-info';
import { Track } from './types';

// @ts-ignore
const spotify = spotifyUrlInfo(fetch);

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

export class TrackResolver {
    static async resolveTrack(type: 'local' | 'url', query: string): Promise<Track> {
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

        const ytDlpOptions: any = {
            dumpSingleJson: true,
            f: 'bestaudio',
            noWarnings: true,
            noPlaylist: true,
            skipDownload: true,
        };

        if (process.env.YOUTUBE_COOKIES_FILE) {
            ytDlpOptions.cookies = path.resolve(process.env.YOUTUBE_COOKIES_FILE);
        } else if (process.env.YOUTUBE_BROWSER_COOKIES) {
            ytDlpOptions.cookiesFromBrowser = process.env.YOUTUBE_BROWSER_COOKIES;
        }

        if (!isDirectUrl) {
            // 1. Try YouTube search first
            try {
                const ytInfo = await youtubedl(`ytsearch1:${searchQuery}`, ytDlpOptions);
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
                const scInfo = await youtubedl(`scsearch1:${searchQuery}`, ytDlpOptions);
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
                const info = await youtubedl(searchQuery, ytDlpOptions);
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
                            const scInfo = await youtubedl(`scsearch1:${oembedJson.title}`, ytDlpOptions);
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
