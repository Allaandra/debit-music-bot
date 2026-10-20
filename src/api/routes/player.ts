import { Router } from 'express';
import { Client } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { prisma } from '../../database';
import { PlayerManager } from '../../services/PlayerService';

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
            const session = await prisma.activeSession.findUnique({
                where: { userId }
            });

            if (!session) {
                return res.status(404).json({ error: 'Сессия не найдена' });
            }

            const { guildId, channelId } = session;
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Сервер не найден' });
            }

            const guildPlayer = PlayerManager.getPlayer(guildId);

            // Подключаемся или переходим в нужный канал
            if (!guildPlayer.connection || guildPlayer.connection.joinConfig.channelId !== channelId) {
                guildPlayer.connection = joinVoiceChannel({
                    channelId: channelId,
                    guildId: guildId,
                    adapterCreator: client.guilds.cache.get(guildId)!.voiceAdapterCreator,
                });
            }

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
                // Копируем все треки после текущего в очередь
                // Приводим Prisma-типы к типам нашего PlayerManager (Track)
                const queueTracks = allTracks.slice(trackIndex + 1).map(t => ({
                    type: t.type as 'local' | 'url',
                    query: t.query,
                    title: t.title,
                    artist: t.artist || 'Unknown',
                    duration: t.duration || 0,
                    thumbnail: t.thumbnail || undefined
                }));

                guildPlayer.queueManager.setQueue(queueTracks, playlistName || 'Main Library');
                guildPlayer.emit('stateUpdate', guildPlayer.getStatus());
            }

            res.json({
                status: 'success',
                message: `Воспроизведение начато: ${track.title}`,
                guildId,
                state: guildPlayer.getStatus()
            });
        }
        catch (error: any) {
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
            if (!session) return res.status(404).json({ error: 'Сессия не найдена' });

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
            const session = await prisma.activeSession.findUnique({
                where: { userId }
            });
            if (!session) return res.status(404).json({ error: 'Сессия не найдена' });

            const guildPlayer = PlayerManager.getPlayer(session.guildId);

            if (action === 'pause') {
                guildPlayer.pause();
            } else if (action === 'resume') {
                guildPlayer.resume();
            } else if (action === 'seek') {
                const seconds = Number(payload?.seconds);
                if (!isNaN(seconds) && seconds >= 0) {
                    guildPlayer.seek(seconds);
                }
            } else if (action === 'skip') {
                guildPlayer.playNext();
            } else if (action === 'previous') {
                guildPlayer.playPrevious();
            } else if (action === 'shuffle') {
                guildPlayer.toggleShuffle();
            } else if (action === 'repeat') {
                guildPlayer.toggleRepeat();
            }

            res.json({ status: 'success', state: guildPlayer.getStatus(), guildId: session.guildId });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
