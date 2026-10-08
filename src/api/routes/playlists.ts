import { Router } from 'express';
import { openDb } from '../../database';
import path from 'path';
import fs from 'fs';

export default function playlistsRoutes() {
    const router = Router();

    router.get('/', async (req, res) => {
        const { userId } = req.query;
        try {
            const db = await openDb();
            const playlists = await db.all(`
                SELECT p.*, COUNT(pt.track_id) as trackCount 
                FROM playlists p 
                LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id 
                WHERE p.owner_id = ? 
                GROUP BY p.id 
                ORDER BY p.createdAt DESC`, [userId || '450362999073406977']);
            res.json(playlists);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/', async (req, res) => {
        const { name, userId } = req.body;
        if (!name) return res.status(400).json({ error: 'Название обязательно' });
        try {
            const db = await openDb();
            const result = await db.run('INSERT INTO playlists (name, owner_id) VALUES (?, ?)', [name, userId || '450362999073406977']);
            res.json({ status: 'success', id: result.lastID });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/:id/tracks', async (req, res) => {
        const { trackId } = req.body;
        const playlistId = req.params.id;
        try {
            const db = await openDb();
            const maxPos = await db.get('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
            const pos = (maxPos?.maxPos || 0) + 1;
            await db.run('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [playlistId, trackId, pos]);
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/:id/tracks', async (req, res) => {
        const playlistId = req.params.id;
        try {
            const db = await openDb();
            const tracks = await db.all(`
                SELECT t.*, pt.position 
                FROM tracks t
                JOIN playlist_tracks pt ON t.id = pt.track_id
                WHERE pt.playlist_id = ?
                ORDER BY pt.position ASC
            `, [playlistId]);
            res.json(tracks);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/:id/tracks/:trackId', async (req, res) => {
        const playlistId = req.params.id;
        const trackId = req.params.trackId;
        try {
            const db = await openDb();
            await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [playlistId, trackId]);
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.put('/:id', async (req, res) => {
        const { name, icon } = req.body;
        const playlistId = req.params.id;
        try {
            const db = await openDb();
            const updates = [];
            const values = [];
            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (icon !== undefined) {
                updates.push('icon = ?');
                values.push(icon);
            }
            if (updates.length > 0) {
                values.push(playlistId);
                await db.run(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`, values);
            }
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        const { deleteTracks } = req.query;
        const playlistId = req.params.id;
        try {
            const db = await openDb();
            
            if (deleteTracks === 'true') {
                const tracks = await db.all('SELECT t.* FROM tracks t JOIN playlist_tracks pt ON t.id = pt.track_id WHERE pt.playlist_id = ?', [playlistId]);
                for (const track of tracks) {
                    if (track.type === 'local') {
                        const filePath = path.join(__dirname, '../..', 'sounds', track.query);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                    await db.run('DELETE FROM tracks WHERE id = ?', [track.id]);
                }
            }
            
            await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
            await db.run('DELETE FROM playlists WHERE id = ?', [playlistId]);
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
