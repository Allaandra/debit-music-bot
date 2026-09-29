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
            const tracks = await db.all('SELECT * FROM tracks WHERE owner_id = ? ORDER BY addedAt DESC', [userId || '450362999073406977']);
            res.json(tracks);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/', async (req, res) => {
        const { query, type, userId } = req.body;
        try {
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
