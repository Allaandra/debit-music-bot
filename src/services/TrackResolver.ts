import path from 'path';
import youtubedl from 'youtube-dl-exec';
import spotifyUrlInfo from 'spotify-url-info';
import { Track } from './types';

// @ts-ignore
const spotify = spotifyUrlInfo(fetch);

export class TrackResolver {
    static async resolveTrack(type: 'local' | 'url', query: string): Promise<Track> {
        let title = query;
        let artist = 'Unknown';
        let duration = 0;
        let streamUrl = query;
        let thumbnail = undefined;

        let platform = undefined;

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
        } else if (type === 'url') {
            let watchUrl = query;
            let isDirectQuery = false;

            if (query.includes('spotify.com') || query.startsWith('spotify:')) {
                const data = await spotify.getPreview(query);
                title = data.title;
                artist = data.artist;
                thumbnail = data.image; // Use Spotify cover art if available
                watchUrl = `scsearch1:${title} ${artist}`; // Bypass YT completely
                isDirectQuery = true;
            } else if (!query.includes('youtube.com') && !query.includes('youtu.be') && !query.includes('soundcloud.com')) {
                // If it's a simple text query, skip play-dl YouTube search and go straight to SoundCloud
                watchUrl = `scsearch1:${query}`;
                isDirectQuery = true;
            }

            const ytDlpOptions: any = { 
                dumpJson: true, 
                f: 'bestaudio', 
                noWarnings: true,
                noPlaylist: true,
                noCallHome: true,
                skipDownload: true,
            };

            if (process.env.YOUTUBE_COOKIES_FILE) {
                ytDlpOptions.cookies = path.resolve(process.env.YOUTUBE_COOKIES_FILE);
            } else if (process.env.YOUTUBE_BROWSER_COOKIES) {
                ytDlpOptions.cookiesFromBrowser = process.env.YOUTUBE_BROWSER_COOKIES;
            }

            try {
                const info = await youtubedl(watchUrl, ytDlpOptions);
                if (!title || title === query) title = (info as any).title || query;
                if (artist === 'Unknown') artist = (info as any).uploader || 'Unknown';
                streamUrl = (info as any).url || watchUrl;
                if (!duration) duration = (info as any).duration || 0;
                if (!thumbnail) thumbnail = (info as any).thumbnail;
                platform = watchUrl.startsWith('scsearch') || (info as any).extractor_key === 'SoundCloud' ? 'SoundCloud' : 'YouTube';
            } catch (youtubeErr: any) {
                console.error(`[YouTube] Error for ${watchUrl}:`, youtubeErr.message || youtubeErr);
                console.warn(`Attempting SoundCloud fallback...`);
                
                let scQueryStr = '';
                if (isDirectQuery) {
                    scQueryStr = watchUrl.replace('scsearch1:', '');
                } else if (title && title !== query && title !== 'Unknown') {
                    scQueryStr = `${title} ${artist !== 'Unknown' ? artist : ''}`.trim();
                } else if (!query.includes('http')) {
                    scQueryStr = query;
                } else if (query.includes('youtube.com') || query.includes('youtu.be')) {
                    // Fetch title via oEmbed to bypass IP bans
                    try {
                        const res = await fetch(`https://www.youtube.com/oembed?url=${query}&format=json`);
                        const json = await res.json();
                        if (json && json.title) {
                            scQueryStr = json.title;
                        }
                    } catch (e) {
                        console.error("Failed to fetch oEmbed title for fallback");
                    }
                }

                if (scQueryStr) {
                    try {
                        const scInfo = await youtubedl(`scsearch1:${scQueryStr}`, { dumpJson: true, f: 'bestaudio', noWarnings: true } as any);
                        if (!title || title === query) title = (scInfo as any).title || scQueryStr;
                        if (artist === 'Unknown') artist = (scInfo as any).uploader || 'Unknown';
                        streamUrl = (scInfo as any).url;
                        if (!duration) duration = (scInfo as any).duration || 0;
                        if (!thumbnail) thumbnail = (scInfo as any).thumbnail;
                        platform = 'SoundCloud';
                        console.log(`[SoundCloud] Fallback success: ${title}`);
                    } catch (scErr: any) {
                        throw new Error(`Failed to resolve track on both YouTube and SoundCloud. YouTube Error: ${youtubeErr.message.split('\n')[0]}`);
                    }
                } else {
                    throw new Error(`YouTube blocked the request and cannot fallback to SoundCloud for direct URLs: ${youtubeErr.message.split('\n')[0]}`);
                }
            }
        }

        return { type, query, title, artist, duration, url: streamUrl, thumbnail, platform };
    }
}
