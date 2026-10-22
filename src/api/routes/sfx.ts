import { Router } from 'express';
import { Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { sfxService } from '../../services/SfxService';

export default function sfxRoutes(client: Client) {
    const router = Router();

    const storage = multer.diskStorage({
        destination: (req: any, file: any, cb: any) => {
            const userId = req.user?.id;
            if (!userId) {
                return cb(new Error('Unauthorized: User ID missing'), '');
            }
            const dir = path.resolve(__dirname, '../../..', 'sounds', userId, 'sfx');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
            const base = path.basename(file.originalname);
            const safeName = `${Date.now()}_${base.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            cb(null, safeName);
        }
    });

    const upload = multer({
        storage,
        limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
    });

    // 1. GET all playlists with sounds (and global shared sounds)
    router.get('/playlists', async (req, res) => {
        const userId = (req as any).user.id;
        try {
            const playlists = await sfxService.getPlaylists(userId);
            res.json(playlists);
        } catch (err: any) {
            console.error('Error fetching SFX playlists:', err);
            res.status(500).json({ error: 'Failed to load SFX playlists' });
        }
    });

    // 2. POST create new playlist
    router.post('/playlists', async (req, res) => {
        const userId = (req as any).user.id;
        const { name, icon } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }

        try {
            const playlist = await sfxService.createPlaylist(userId, name, icon);
            res.json(playlist);
        } catch (err: any) {
            console.error('Error creating SFX playlist:', err);
            res.status(500).json({ error: 'Failed to create playlist' });
        }
    });

    // 3. DELETE playlist
    router.delete('/playlists/:id', async (req, res) => {
        const userId = (req as any).user.id;
        const playlistId = parseInt(req.params.id);

        try {
            const deleted = await sfxService.deletePlaylist(userId, playlistId);
            if (!deleted) {
                return res.status(404).json({ error: 'Playlist not found' });
            }
            res.json({ success: true });
        } catch (err: any) {
            console.error('Error deleting SFX playlist:', err);
            res.status(500).json({ error: 'Failed to delete playlist' });
        }
    });

    // 4. POST upload sound
    router.post('/upload', upload.single('sound'), async (req, res) => {
        const userId = (req as any).user.id;
        const { title, playlistId, isGlobal } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        if (!playlistId) {
            return res.status(400).json({ error: 'playlistId is required' });
        }

        try {
            const sound = await sfxService.uploadSound(
                userId,
                parseInt(playlistId),
                req.file.path,
                req.file.originalname,
                req.file.filename,
                title,
                isGlobal === 'true' || isGlobal === true
            );
            res.json(sound);
        } catch (err: any) {
            console.error('Error uploading SFX:', err);
            res.status(500).json({ error: 'Failed to save sound' });
        }
    });

    // 5. PATCH toggle isGlobal for sound
    router.patch('/sounds/:id/toggle-global', async (req, res) => {
        const userId = (req as any).user.id;
        const soundId = parseInt(req.params.id);

        try {
            const updated = await sfxService.toggleGlobal(userId, soundId);
            if (!updated) {
                return res.status(404).json({ error: 'Sound not found or you are not the owner' });
            }
            res.json(updated);
        } catch (err: any) {
            console.error('Error toggling isGlobal:', err);
            res.status(500).json({ error: 'Failed to update sound' });
        }
    });

    // 6. DELETE sound
    router.delete('/sounds/:id', async (req, res) => {
        const userId = (req as any).user.id;
        const soundId = parseInt(req.params.id);

        try {
            const deleted = await sfxService.deleteSound(userId, soundId);
            if (!deleted) {
                return res.status(404).json({ error: 'Sound not found or permission denied' });
            }
            res.json({ success: true });
        } catch (err: any) {
            console.error('Error deleting SFX sound:', err);
            res.status(500).json({ error: 'Failed to delete sound' });
        }
    });

    // 7. POST play sound in Discord (overlay onto stream, optional loop)
    router.post('/play', async (req, res) => {
        const userId = (req as any).user.id;
        const { soundId, volume = 1.0, loop = false } = req.body;

        if (!soundId) {
            return res.status(400).json({ error: 'soundId is required' });
        }

        try {
            const result = await sfxService.playSound(client, userId, parseInt(soundId), volume, Boolean(loop));
            res.json({ success: true, ...result });
        } catch (err: any) {
            console.error('Error playing SFX sound:', err);
            res.status(500).json({ error: err.message || 'Failed to play SFX' });
        }
    });

    // 7.1 POST stop sound loop in Discord
    router.post('/loop/stop', async (req, res) => {
        const userId = (req as any).user.id;
        const { soundId } = req.body;

        if (!soundId) {
            return res.status(400).json({ error: 'soundId is required' });
        }

        try {
            const result = await sfxService.stopLoop(client, userId, parseInt(soundId));
            res.json(result);
        } catch (err: any) {
            console.error('Error stopping SFX loop:', err);
            res.status(500).json({ error: err.message || 'Failed to stop SFX loop' });
        }
    });

    // 8. GET preview audio in browser
    router.get('/audio/:id', async (req, res) => {
        const userId = (req as any).user.id;
        const soundId = parseInt(req.params.id);

        try {
            const filePath = await sfxService.getPreviewFilePath(userId, soundId);
            if (!filePath) {
                return res.status(404).send('Not found');
            }
            res.sendFile(filePath);
        } catch (err: any) {
            console.error('Error streaming SFX preview:', err);
            res.status(500).send('Error');
        }
    });

    return router;
}
