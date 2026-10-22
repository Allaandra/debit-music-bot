import { Router } from 'express';
import { prisma } from '../../database';
import path from 'path';
import fs from 'fs';
import { syncUserSoundsThrottled } from './files';
import { TrackResolver } from '../../services/TrackResolver';

export default function tracksRoutes() {
    const router = Router();

    router.get('/', async (req, res) => {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        try {
            await syncUserSoundsThrottled(userId);
            const tracks = await prisma.track.findMany({
                where: { ownerId: userId },
                orderBy: [
                    { addedAt: 'desc' },
                    { id: 'desc' }
                ],
                include: {
                    playlists: {
                        include: {
                            playlist: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            });
            const formatted = tracks.map(({ playlists, ...t }) => ({
                ...t,
                playlistIds: playlists.map(p => p.playlistId),
                playlistNames: playlists.map(p => p.playlist.name)
            }));
            res.json(formatted);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/', async (req, res) => {
        const { query, type } = req.body;
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        try {
            if (type === 'url') {
                if (TrackResolver.isYoutubePlaylist(query)) {
                    const youtubedl = (await import('youtube-dl-exec')).default;
                    const info = await youtubedl(query, { dumpSingleJson: true, flat: true } as any);
                    return res.json({ status: 'playlist_detected', title: (info as any).title || 'YouTube Playlist', total_tracks: (info as any).entries?.length || 0 });
                }
                if (TrackResolver.isSpotifyPlaylistOrAlbum(query)) {
                    // @ts-ignore
                    const spotifyUrlInfo = (await import('spotify-url-info')).default || (await import('spotify-url-info'));
                    // @ts-ignore
                    const spotify = spotifyUrlInfo(fetch);
                    const data = await spotify.getData(query);
                    if (data.type === 'playlist' || data.type === 'album') {
                        const tracks = await spotify.getTracks(query);
                        return res.json({ status: 'playlist_detected', title: data.name || data.title || 'Spotify Playlist', total_tracks: tracks.length });
                    }
                }
            }

            const track = await TrackResolver.resolveTrack(type, query);
            
            const result = await prisma.track.create({
                data: {
                    title: track.title,
                    artist: track.artist || 'Unknown',
                    type: track.type,
                    query: track.query,
                    duration: track.duration,
                    thumbnail: track.thumbnail,
                    ownerId: userId
                }
            });
            res.json({ status: 'success', id: result.id, track });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/import_playlist', async (req, res) => {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { query, createPlaylist, playlistName } = req.body;
        if (!query) return res.status(400).json({ error: 'No query' });
        
        try {
            const isYtPlaylist = TrackResolver.isYoutubePlaylist(query);
            const isSpotifyList = TrackResolver.isSpotifyPlaylistOrAlbum(query);
            let tracksToImport: any[] = [];
            let ytInfo: any = null;
            let fetchedPlaylistCover: string | null = null;

            if (isYtPlaylist) {
                const youtubedl = (await import('youtube-dl-exec')).default;
                ytInfo = await youtubedl(query, { dumpSingleJson: true, flat: true } as any);
                const tracks = ytInfo.entries || [];
                tracksToImport = tracks.map((t: any) => ({
                    title: t.title,
                    artist: t.uploader || t.channel || 'Unknown',
                    query: t.url || `https://www.youtube.com/watch?v=${t.id}`,
                    duration: Math.round(t.duration || 0),
                    thumbnail: t.thumbnails ? t.thumbnails[0]?.url : null
                }));
            } else if (isSpotifyList) {
                // @ts-ignore
                const spotifyUrlInfo = (await import('spotify-url-info')).default || (await import('spotify-url-info'));
                // @ts-ignore
                const spotify = spotifyUrlInfo(fetch);
                const data = await spotify.getData(query);
                fetchedPlaylistCover = data.coverArt?.sources?.[0]?.url || data.visualIdentity?.image?.[0]?.url || null;
                const tracks = await spotify.getTracks(query);
                tracksToImport = tracks.map((t: any) => ({
                    title: t.name,
                    artist: t.artist || (t.artists && t.artists[0]?.name) || 'Unknown',
                    query: t.uri || t.external_urls?.spotify || query,
                    duration: Math.round((t.duration || t.duration_ms || 0) / 1000),
                    thumbnail: fetchedPlaylistCover // Use playlist cover as fallback
                }));
            }

            const reversedTracks = tracksToImport.map((t, i) => ({ ...t, originalPos: i + 1 })).reverse();

            // Выполняем создание плейлиста и всех треков в единой транзакции SQLite
            const targetPlaylistId = await prisma.$transaction(async (tx) => {
                let playlistId: number | null = null;

                if (createPlaylist) {
                    let pIcon: string | null = null;
                    if (tracksToImport.length > 0 && tracksToImport[0].thumbnail) pIcon = tracksToImport[0].thumbnail;
                    if (isYtPlaylist && ytInfo?.thumbnails?.length > 0) {
                        pIcon = ytInfo.thumbnails[0].url;
                    }
                    if (isSpotifyList) {
                        pIcon = tracksToImport.length > 0 ? tracksToImport[0].thumbnail : null;
                    }

                    const created = await tx.playlist.create({
                        data: {
                            name: playlistName || 'Imported Playlist',
                            ownerId: userId,
                            icon: pIcon
                        }
                    });
                    playlistId = created.id;
                }

                for (const t of reversedTracks) {
                    const result = await tx.track.create({
                        data: {
                            title: t.title || 'Unknown',
                            artist: t.artist || 'Unknown',
                            type: 'url',
                            query: t.query,
                            duration: t.duration || 0,
                            thumbnail: t.thumbnail,
                            ownerId: userId
                        }
                    });
                    t.dbId = result.id;

                    if (playlistId) {
                        await tx.playlistTrack.create({
                            data: {
                                playlistId,
                                trackId: result.id,
                                position: t.originalPos
                            }
                        });
                    }
                }

                return playlistId;
            });

            // Background task to fetch real thumbnails for Spotify tracks
            if (isSpotifyList) {
                setTimeout(async () => {
                    try {
                        // @ts-ignore
                        const spotifyUrlInfo = (await import('spotify-url-info')).default || (await import('spotify-url-info'));
                        // @ts-ignore
                        const spotify = spotifyUrlInfo(fetch);
                        
                        for (const t of reversedTracks) {
                            try {
                                const preview = await spotify.getPreview(t.query);
                                if (preview && preview.image) {
                                    await prisma.track.updateMany({
                                        where: { 
                                            id: t.dbId,
                                            thumbnail: t.thumbnail 
                                        },
                                        data: { thumbnail: preview.image }
                                    });
                                }
                            } catch (err) {
                                // Ignore preview fetch errors for individual tracks
                            }
                        }
                    } catch (e) {
                        console.error('Background spotify thumbnail fetch failed', e);
                    }
                }, 0);
            }

            res.json({ status: 'success', imported: tracksToImport.length, playlistId: targetPlaylistId });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const track = await prisma.track.findFirst({
                where: { 
                    id: parseInt(req.params.id), 
                    ownerId: userId 
                }
            });
            if (!track) return res.status(404).json({ error: 'Трек не найден' });
            
            if (track.type === 'local') {
                const soundsDir = path.resolve(__dirname, '../../..', 'sounds');
                const filePath = path.resolve(soundsDir, track.query);
                if (filePath.startsWith(soundsDir) && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            
            await prisma.playlistTrack.deleteMany({
                where: { trackId: track.id }
            });
            await prisma.track.delete({
                where: { id: track.id }
            });
            res.json({ status: 'success' });
        } catch (e: any) { 
            res.status(500).json({ error: e.message }); 
        }
    });

    return router;
}
