import { Router } from 'express';
import { prisma } from '../../database';
import path from 'path';
import fs from 'fs';

export default function playlistsRoutes() {
    const router = Router();

    // GET / - Получить все плейлисты текущего пользователя
    router.get('/', async (req, res) => {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
            
            // Форматируем под формат клиента (свойство trackCount)
            const formatted = playlists.map(p => ({
                ...p,
                trackCount: p._count.tracks
            }));
            
            res.json(formatted);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST / - Создать новый плейлист
    router.post('/', async (req, res) => {
        const { name } = req.body;
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Название обязательно' });

        try {
            const result = await prisma.playlist.create({
                data: {
                    name: name.trim(),
                    ownerId: userId
                }
            });
            res.json({ status: 'success', id: result.id });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST /:id/tracks - Добавить трек в плейлист (с проверкой прав владельца)
    router.post('/:id/tracks', async (req, res) => {
        const { trackId } = req.body;
        const playlistId = parseInt(req.params.id);
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (isNaN(playlistId) || !trackId) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        try {
            // IDOR защита: проверяем, что плейлист принадлежит пользователю
            const playlist = await prisma.playlist.findFirst({
                where: { id: playlistId, ownerId: userId }
            });
            if (!playlist) {
                return res.status(404).json({ error: 'Плейлист не найден или доступ запрещен' });
            }

            const parsedTrackId = parseInt(trackId);
            if (isNaN(parsedTrackId)) {
                return res.status(400).json({ error: 'Invalid trackId' });
            }

            const maxTrack = await prisma.playlistTrack.findFirst({
                where: { playlistId },
                orderBy: { position: 'desc' }
            });
            
            const pos = (maxTrack?.position || 0) + 1;
            
            await prisma.playlistTrack.create({
                data: {
                    playlistId,
                    trackId: parsedTrackId,
                    position: pos
                }
            });
            res.json({ status: 'success' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /:id/tracks - Получить треки плейлиста (с проверкой прав владельца)
    router.get('/:id/tracks', async (req, res) => {
        const playlistId = parseInt(req.params.id);
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (isNaN(playlistId)) {
            return res.status(400).json({ error: 'Invalid playlist ID' });
        }

        try {
            // IDOR защита: проверяем, что плейлист принадлежит пользователю
            const playlist = await prisma.playlist.findFirst({
                where: { id: playlistId, ownerId: userId }
            });
            if (!playlist) {
                return res.status(404).json({ error: 'Плейлист не найден или доступ запрещен' });
            }

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

    // DELETE /:id/tracks/:trackId - Удалить трек из плейлиста (с проверкой прав владельца)
    router.delete('/:id/tracks/:trackId', async (req, res) => {
        const playlistId = parseInt(req.params.id);
        const trackId = parseInt(req.params.trackId);
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (isNaN(playlistId) || isNaN(trackId)) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        try {
            // IDOR защита: проверяем, что плейлист принадлежит пользователю
            const playlist = await prisma.playlist.findFirst({
                where: { id: playlistId, ownerId: userId }
            });
            if (!playlist) {
                return res.status(404).json({ error: 'Плейлист не найден или доступ запрещен' });
            }

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

    // PUT /:id - Обновить имя или иконку плейлиста (с проверкой прав владельца)
    router.put('/:id', async (req, res) => {
        const { name, icon } = req.body;
        const playlistId = parseInt(req.params.id);
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (isNaN(playlistId)) {
            return res.status(400).json({ error: 'Invalid playlist ID' });
        }

        try {
            // IDOR защита: проверяем, что плейлист принадлежит пользователю
            const playlist = await prisma.playlist.findFirst({
                where: { id: playlistId, ownerId: userId }
            });
            if (!playlist) {
                return res.status(404).json({ error: 'Плейлист не найден или доступ запрещен' });
            }

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

    // DELETE /:id - Удалить плейлист (с проверкой прав владельца)
    router.delete('/:id', async (req, res) => {
        const { deleteTracks } = req.query;
        const playlistId = parseInt(req.params.id);
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (isNaN(playlistId)) {
            return res.status(400).json({ error: 'Invalid playlist ID' });
        }

        try {
            // IDOR защита: проверяем, что плейлист принадлежит пользователю
            const playlist = await prisma.playlist.findFirst({
                where: { id: playlistId, ownerId: userId }
            });
            if (!playlist) {
                return res.status(404).json({ error: 'Плейлист не найден или доступ запрещен' });
            }

            if (deleteTracks === 'true') {
                const playlistTracks = await prisma.playlistTrack.findMany({
                    where: { playlistId },
                    include: { track: true }
                });
                
                const soundsDir = path.resolve(__dirname, '../../..', 'sounds');

                for (const pt of playlistTracks) {
                    if (pt.track.ownerId === userId) {
                        if (pt.track.type === 'local') {
                            const filePath = path.resolve(soundsDir, pt.track.query);
                            if (filePath.startsWith(soundsDir) && fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        }
                        await prisma.track.delete({
                            where: { id: pt.track.id }
                        });
                    }
                }
            }
            
            await prisma.playlistTrack.deleteMany({
                where: { playlistId }
            });
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
