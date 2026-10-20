import { Router } from 'express';
import { prisma } from '../../database';
import path from 'path';
import fs from 'fs';
import { syncUserSoundsThrottled } from './files';

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
                ]
            });
            res.json(tracks);
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
                const play = (await import('play-dl')).default;
                const validation = await play.validate(query);
                if (validation === 'yt_playlist') {
                    const youtubedl = (await import('youtube-dl-exec')).default;
                    const info = await youtubedl(query, { dumpSingleJson: true, flat: true } as any);
                    return res.json({ status: 'playlist_detected', title: (info as any).title || 'YouTube Playlist', total_tracks: (info as any).entries?.length || 0 });
                }
                if (query.includes('spotify.com/playlist') || query.includes('spotify.com/album')) {
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

            const playerManager = (await import('../../services/PlayerService')).PlayerManager;
            const guildPlayer = playerManager.getPlayer('default'); // Just for resolve
            const track = await guildPlayer.resolveTrack(type, query);
            
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
            let targetPlaylistId: number | null = null;
            
            if (createPlaylist) {
                const result = await prisma.playlist.create({
                    data: {
                        name: playlistName || 'Imported Playlist',
                        ownerId: userId
                    }
                });
                targetPlaylistId = result.id;
            }

            const play = (await import('play-dl')).default;
            const validation = await play.validate(query);
            let tracksToImport: any[] = [];
            let ytInfo: any = null;
            let fetchedPlaylistCover: string | null = null;

            if (validation === 'yt_playlist') {
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
            } else if (query.includes('spotify.com/playlist') || query.includes('spotify.com/album')) {
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
            for (const t of reversedTracks) {
                const result = await prisma.track.create({
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
                t.dbId = result.id; // Save the inserted ID to update later
                
                if (targetPlaylistId) {
                    await prisma.playlistTrack.create({
                        data: {
                            playlistId: targetPlaylistId,
                            trackId: result.id,
                            position: t.originalPos
                        }
                    });
                }
            }

            // Background task to fetch real thumbnails for Spotify tracks
            if (query.includes('spotify.com/playlist') || query.includes('spotify.com/album')) {
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
                                    // Update the track with the new thumbnail, if it hasn't been changed manually
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

            if (createPlaylist && targetPlaylistId) {
                let pIcon = null;
                if (tracksToImport.length > 0 && tracksToImport[0].thumbnail) pIcon = tracksToImport[0].thumbnail;
                if (validation === 'yt_playlist' && ytInfo && ytInfo.thumbnails && ytInfo.thumbnails.length > 0) {
                    pIcon = ytInfo.thumbnails[0].url;
                }
                if (query.includes('spotify.com/playlist') || query.includes('spotify.com/album')) {
                    pIcon = tracksToImport.length > 0 ? tracksToImport[0].thumbnail : null;
                }
                if (pIcon) {
                    await prisma.playlist.update({
                        where: { id: targetPlaylistId },
                        data: { icon: pIcon }
                    });
                }
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
