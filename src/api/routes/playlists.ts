import { Router } from 'express';
import { prisma } from '../../database';
import path from 'path';
import fs from 'fs';

export default function playlistsRoutes() {
    const router = Router();

    router.get('/', async (req, res) => {
        const userId = (req as any).user.id;
        try {
            const playlists = await prisma.playlist.findMany({
                where: { ownerId: userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { tracks: true }
                    }
                }
            });
            
            // Форматируем под старый формат (свойство trackCount)
            const formatted = playlists.map(p => ({
                ...p,
                trackCount: p._count.tracks
            }));
            
            res.json(formatted);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/', async (req, res) => {
        const { name } = req.body;
        const userId = (req as any).user.id;
        if (!name) return res.status(400).json({ error: 'Название обязательно' });
        try {
            const result = await prisma.playlist.create({
                data: {
                    name,
                    ownerId: userId
                }
            });
            res.json({ status: 'success', id: result.id });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/:id/tracks', async (req, res) => {
        const { trackId } = req.body;
        const playlistId = parseInt(req.params.id);
        try {
            const maxTrack = await prisma.playlistTrack.findFirst({
                where: { playlistId },
                orderBy: { position: 'desc' }
            });
            
            const pos = (maxTrack?.position || 0) + 1;
            
            await prisma.playlistTrack.create({
                data: {
                    playlistId,
                    trackId: parseInt(trackId),
                    position: pos
                }
            });
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/:id/tracks', async (req, res) => {
        const playlistId = parseInt(req.params.id);
        try {
            const playlistTracks = await prisma.playlistTrack.findMany({
                where: { playlistId },
                orderBy: { position: 'asc' },
                include: { track: true }
            });
            
            const tracks = playlistTracks.map(pt => ({
                ...pt.track,
                position: pt.position
            }));
            
            res.json(tracks);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/:id/tracks/:trackId', async (req, res) => {
        const playlistId = parseInt(req.params.id);
        const trackId = parseInt(req.params.trackId);
        try {
            await prisma.playlistTrack.delete({
                where: {
                    playlistId_trackId: {
                        playlistId,
                        trackId
                    }
                }
            });
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.put('/:id', async (req, res) => {
        const { name, icon } = req.body;
        const playlistId = parseInt(req.params.id);
        try {
            const dataToUpdate: any = {};
            if (name !== undefined) dataToUpdate.name = name;
            if (icon !== undefined) dataToUpdate.icon = icon;
            
            if (Object.keys(dataToUpdate).length > 0) {
                await prisma.playlist.update({
                    where: { id: playlistId },
                    data: dataToUpdate
                });
            }
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        const { deleteTracks } = req.query;
        const playlistId = parseInt(req.params.id);
        try {
            if (deleteTracks === 'true') {
                const playlistTracks = await prisma.playlistTrack.findMany({
                    where: { playlistId },
                    include: { track: true }
                });
                
                for (const pt of playlistTracks) {
                    if (pt.track.type === 'local') {
                        const filePath = path.join(__dirname, '../..', 'sounds', pt.track.query);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                    await prisma.track.delete({
                        where: { id: pt.track.id }
                    });
                }
            }
            
            // Note: playlist_tracks will be automatically deleted if they are set to CASCADE in DB,
            // but Prisma will handle it automatically.
            await prisma.playlist.delete({
                where: { id: playlistId }
            });
            
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
