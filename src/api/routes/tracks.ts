import { Router } from 'express';
import { openDb } from '../../database';
import path from 'path';
import fs from 'fs';

export default function tracksRoutes() {
    const router = Router();

    router.get('/', async (req, res) => {
        const { userId } = req.query;
        try {
            const db = await openDb();
            const tracks = await db.all('SELECT * FROM tracks WHERE owner_id = ? ORDER BY addedAt DESC, id DESC', [userId || '450362999073406977']);
            res.json(tracks);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/', async (req, res) => {
        const { query, type, userId } = req.body;
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
                    const spotifyUrlInfo = (await import('spotify-url-info')).default;
                    // @ts-ignore
                    const spotify = spotifyUrlInfo(fetch);
                    const data = await spotify.getData(query);
                    if (data.type === 'playlist' || data.type === 'album') {
                        const tracks = await spotify.getTracks(query);
                        return res.json({ status: 'playlist_detected', title: data.name || data.title || 'Spotify Playlist', total_tracks: tracks.length });
                    }
                }
            }

            const playerManager = (await import('../PlayerManager')).PlayerManager;
            const guildPlayer = playerManager.getPlayer('default'); // Just for resolve
            const track = await guildPlayer.resolveTrack(type, query);
            
            const db = await openDb();
            const result = await db.run(
                'INSERT INTO tracks (title, artist, type, query, duration, thumbnail, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [track.title, track.artist, track.type, track.query, track.duration, track.thumbnail, userId || '450362999073406977']
            );
            res.json({ status: 'success', id: result.lastID, track });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/import_playlist', async (req, res) => {
        const { query, userId, createPlaylist, playlistName } = req.body;
        if (!query) return res.status(400).json({ error: 'No query' });
        
        try {
            const db = await openDb();
            const uid = userId || '450362999073406977';
            let targetPlaylistId = null;
            
            if (createPlaylist) {
                const result = await db.run('INSERT INTO playlists (name, owner_id) VALUES (?, ?)', [playlistName || 'Imported Playlist', uid]);
                targetPlaylistId = result.lastID;
            }

            const play = (await import('play-dl')).default;
            const validation = await play.validate(query);
            let tracksToImport: any[] = [];

            if (validation === 'yt_playlist') {
                const youtubedl = (await import('youtube-dl-exec')).default;
                const info = await youtubedl(query, { dumpSingleJson: true, flat: true } as any);
                const tracks = (info as any).entries || [];
                tracksToImport = tracks.map((t: any) => ({
                    title: t.title,
                    artist: t.uploader || t.channel || 'Unknown',
                    query: t.url || `https://www.youtube.com/watch?v=${t.id}`,
                    duration: Math.round(t.duration || 0),
                    thumbnail: t.thumbnails ? t.thumbnails[0]?.url : null
                }));
            } else if (query.includes('spotify.com/playlist') || query.includes('spotify.com/album')) {
                const spotifyUrlInfo = (await import('spotify-url-info')).default;
                // @ts-ignore
                const spotify = spotifyUrlInfo(fetch);
                const data = await spotify.getData(query);
                const playlistCover = data.coverArt?.sources?.[0]?.url || data.visualIdentity?.image?.[0]?.url || null;
                const tracks = await spotify.getTracks(query);
                tracksToImport = tracks.map((t: any) => ({
                    title: t.name,
                    artist: t.artist || (t.artists && t.artists[0]?.name) || 'Unknown',
                    query: t.uri || t.external_urls?.spotify || query,
                    duration: Math.round((t.duration || t.duration_ms || 0) / 1000),
                    thumbnail: playlistCover // Use playlist cover as fallback
                }));
            }

            const reversedTracks = tracksToImport.map((t, i) => ({ ...t, originalPos: i + 1 })).reverse();
            for (const t of reversedTracks) {
                const result = await db.run(
                    'INSERT INTO tracks (title, artist, type, query, duration, thumbnail, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [t.title || 'Unknown', t.artist || 'Unknown', 'url', t.query, t.duration || 0, t.thumbnail, uid]
                );
                
                if (targetPlaylistId) {
                    await db.run('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [targetPlaylistId, result.lastID, t.originalPos]);
                }
            }

            if (createPlaylist && targetPlaylistId) {
                let pIcon = null;
                if (tracksToImport.length > 0 && tracksToImport[0].thumbnail) pIcon = tracksToImport[0].thumbnail;
                if (validation === 'yt_playlist' && info && (info as any).thumbnails && (info as any).thumbnails.length > 0) {
                    pIcon = (info as any).thumbnails[0].url;
                }
                if (query.includes('spotify.com/playlist') || query.includes('spotify.com/album')) {
                    // We already set thumbnail to playlistCover in spotify tracks
                    pIcon = tracksToImport.length > 0 ? tracksToImport[0].thumbnail : null;
                }
                if (pIcon) {
                    await db.run('UPDATE playlists SET icon = ? WHERE id = ?', [pIcon, targetPlaylistId]);
                }
            }

            res.json({ status: 'success', imported: tracksToImport.length, playlistId: targetPlaylistId });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        const { userId } = req.query;
        try {
            const db = await openDb();
            const track = await db.get('SELECT * FROM tracks WHERE id = ? AND owner_id = ?', [req.params.id, userId || '450362999073406977']);
            if (!track) return res.status(404).json({ error: 'Трек не найден' });
            
            if (track.type === 'local') {
                const filePath = path.join(__dirname, '../..', 'sounds', track.query);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            
            await db.run('DELETE FROM tracks WHERE id = ?', [req.params.id]);
            res.json({ status: 'success' });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    return router;
}
