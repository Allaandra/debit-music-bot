import { Router } from 'express';
import { Client } from 'discord.js';
import { prisma } from '../../database';
import { PlayerManager } from '../../services/PlayerService';
import { TrackResolver } from '../../services/TrackResolver';

export default function playerRoutes(client: Client) {
    const router = Router();

    router.post('/play', async (req, res) => {
        const { type, query, playlistId, playlistName } = req.body;
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        if (!type || !query) {
            return res.status(400).json({ error: 'Не переданы все параметры (type, query)' });
        }

        try {
            const { guildPlayer, guildId } = await PlayerManager.ensureUserConnection(client, userId);

            const track = await guildPlayer.resolveTrack(type, query);
            await guildPlayer.play(track);

            // Сохраняем в историю/библиотеку треков, если его еще там нет
            const existing = await prisma.track.findFirst({
                where: { query: track.query, ownerId: userId }
            });

            if (!existing) {
                await prisma.track.create({
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
            } else if (track.thumbnail && existing.thumbnail !== track.thumbnail) {
                await prisma.track.update({
                    where: { id: existing.id },
                    data: { thumbnail: track.thumbnail }
                });
            }

            // Автоматически ставим в очередь все следующие треки из базы данных
            let allTracks: any[] = [];
            if (playlistId) {
                const playlist = await prisma.playlist.findFirst({
                    where: { id: parseInt(playlistId), ownerId: userId },
                    include: {
                        tracks: {
                            orderBy: { position: 'asc' },
                            include: { track: true }
                        }
                    }
                });
                if (playlist) {
                    allTracks = playlist.tracks.map(pt => pt.track);
                }
            } else {
                allTracks = await prisma.track.findMany({
                    where: { ownerId: userId },
                    orderBy: [
                        { addedAt: 'desc' },
                        { id: 'desc' }
                    ]
                });
            }

            const trackIndex = allTracks.findIndex(t => t.query === track.query);

            if (trackIndex !== -1) {
                const queueTracks = allTracks.slice(trackIndex + 1).map(t => ({
                    type: t.type as 'local' | 'url',
                    query: t.query,
                    title: t.title,
                    artist: t.artist || 'Unknown',
                    duration: t.duration || 0,
                    thumbnail: t.thumbnail || undefined
                }));

                guildPlayer.queueManager.setQueue(queueTracks, playlistName || 'Main Library');
                guildPlayer.prefetchUpcoming();
                guildPlayer.emit('stateUpdate', guildPlayer.getStatus());
            }

            res.json({
                status: 'success',
                message: `Воспроизведение начато: ${track.title}`,
                guildId,
                state: guildPlayer.getStatus()
            });
        } catch (error: any) {
            if (error.statusCode === 404) {
                return res.status(404).json({ error: error.message });
            }
            console.error('Ошибка воспроизведения:', error);
            res.status(500).json({ error: 'Ошибка сервера при запуске трека', details: error.message });
        }
    });

    router.get('/status', async (req, res) => {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const session = await prisma.activeSession.findUnique({
                where: { userId }
            });
            if (!session) {
                return res.json({
                    isPlaying: false,
                    isPaused: false,
                    currentTrack: null,
                    elapsed: 0,
                    queue: [],
                    loopingSfx: []
                });
            }

            const guildPlayer = PlayerManager.getPlayer(session.guildId);
            res.json({ ...guildPlayer.getStatus(), guildId: session.guildId });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/action', async (req, res) => {
        const { action, payload } = req.body;
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!action) return res.status(400).json({ error: 'Не переданы параметры' });

        try {
            if (action === 'prefetch') {
                if (payload?.type && payload?.query) {
                    TrackResolver.prefetchTrack(payload.type, payload.query);
                }
                return res.json({ status: 'success' });
            }

            const session = await prisma.activeSession.findUnique({
                where: { userId }
            });
            if (!session) return res.status(404).json({ error: 'Сессия не найдена' });

            const guildPlayer = PlayerManager.getPlayer(session.guildId);

            if (action === 'pause') {
                guildPlayer.pause();
            } else if (action === 'resume') {
                await guildPlayer.resume();
            } else if (action === 'seek') {
                const seconds = Number(payload?.seconds);
                if (!isNaN(seconds) && seconds >= 0) {
                    await guildPlayer.seek(seconds);
                }
            } else if (action === 'skip') {
                await guildPlayer.playNext();
            } else if (action === 'previous') {
                await guildPlayer.playPrevious();
            } else if (action === 'shuffle') {
                guildPlayer.toggleShuffle();
            } else if (action === 'repeat') {
                guildPlayer.toggleRepeat();
            } else if (action === 'volume') {
                const vol = Number(payload?.volume);
                if (!isNaN(vol) && vol >= 0 && vol <= 2.0) {
                    guildPlayer.setVolume(vol);
                }
            } else if (action === 'sfxVolume') {
                const vol = Number(payload?.volume);
                if (!isNaN(vol) && vol >= 0 && vol <= 2.0) {
                    guildPlayer.setSfxVolume(vol);
                }
            }

            res.json({ status: 'success', state: guildPlayer.getStatus(), guildId: session.guildId });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
