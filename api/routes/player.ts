import { Router } from 'express';
import { Client } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { openDb } from '../../database';

export default function playerRoutes(client: Client) {
    const router = Router();

    router.post('/play', async (req, res) => {
        const { userId, type, query } = req.body;

        if (!userId || !type || !query) {
            return res.status(400).json({ error: 'Не переданы все параметры (userId, type, query)' });
        }

        try {
            const db = await openDb();
            const session = await db.get('SELECT * FROM active_sessions WHERE userId = ?', [userId]);

            if (!session) {
                return res.status(404).json({ error: 'Сессия не найдена' });
            }

            const { guildId, channelId } = session;
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Сервер не найден' });
            }

            const playerManager = (await import('../PlayerManager')).PlayerManager;
            const guildPlayer = playerManager.getPlayer(guildId);

            // Подключаемся или переходим в нужный канал
            if (!guildPlayer.connection || guildPlayer.connection.joinConfig.channelId !== channelId) {
                guildPlayer.connection = joinVoiceChannel({
                    channelId: channelId,
                    guildId: guildId,
                    adapterCreator: client.guilds.cache.get(guildId)!.voiceAdapterCreator,
                });
                guildPlayer.connection.subscribe(guildPlayer.player);
            }

            const track = await guildPlayer.resolveTrack(type, query);
            await guildPlayer.play(track);

            // Сохраняем в историю/библиотеку треков, если его еще там нет
            const existing = await db.get('SELECT id FROM tracks WHERE query = ?', [track.query]);
            if (!existing) {
                await db.run(
                    'INSERT INTO tracks (title, artist, type, query, duration) VALUES (?, ?, ?, ?, ?)',
                    [track.title, track.artist, track.type, track.query, track.duration]
                );
            }

            // Автоматически ставим в очередь все следующие треки из базы данных
            const allTracks = await db.all('SELECT * FROM tracks ORDER BY addedAt DESC');
            const trackIndex = allTracks.findIndex(t => t.query === track.query);
            if (trackIndex !== -1) {
                // Копируем все треки после текущего в очередь
                guildPlayer.queue = allTracks.slice(trackIndex + 1);
                if (guildPlayer.shuffle) {
                    guildPlayer.originalQueue = [...guildPlayer.queue];
                    for (let i = guildPlayer.queue.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [guildPlayer.queue[i], guildPlayer.queue[j]] = [guildPlayer.queue[j], guildPlayer.queue[i]];
                    }
                }
            }

            res.json({ status: 'success', message: `Воспроизведение начато: ${track.title}` });
        }
        catch (error: any) {
            console.error('Ошибка воспроизведения:', error);
            res.status(500).json({ error: 'Ошибка сервера при запуске трека', details: error.message });
        }
    });

    router.get('/status', async (req, res) => {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: 'Не передан userId' });

        try {
            const db = await openDb();
            const session = await db.get('SELECT * FROM active_sessions WHERE userId = ?', [userId]);
            if (!session) return res.status(404).json({ error: 'Сессия не найдена' });

            const playerManager = (await import('../PlayerManager')).PlayerManager;
            const guildPlayer = playerManager.getPlayer(session.guildId);
            res.json(guildPlayer.getStatus());
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/action', async (req, res) => {
        const { userId, action, payload } = req.body;
        if (!userId || !action) return res.status(400).json({ error: 'Не переданы параметры' });

        try {
            const db = await openDb();
            const session = await db.get('SELECT * FROM active_sessions WHERE userId = ?', [userId]);
            if (!session) return res.status(404).json({ error: 'Сессия не найдена' });

            const playerManager = (await import('../PlayerManager')).PlayerManager;
            const guildPlayer = playerManager.getPlayer(session.guildId);

            if (action === 'pause') guildPlayer.pause();
            else if (action === 'resume') guildPlayer.resume();
            else if (action === 'seek') guildPlayer.seek(payload.seconds);
            else if (action === 'skip') guildPlayer.playNext();
            else if (action === 'previous') guildPlayer.playPrevious();
            else if (action === 'shuffle') guildPlayer.toggleShuffle();
            else if (action === 'repeat') guildPlayer.toggleRepeat();

            res.json({ status: 'success', state: guildPlayer.getStatus() });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
