"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = playerRoutes;
const express_1 = require("express");
const voice_1 = require("@discordjs/voice");
const database_1 = require("../../database");
function playerRoutes(client) {
    const router = (0, express_1.Router)();
    router.post('/play', async (req, res) => {
        const { userId, type, query } = req.body;
        if (!userId || !type || !query) {
            return res.status(400).json({ error: 'Не переданы все параметры (userId, type, query)' });
        }
        try {
            const db = await (0, database_1.openDb)();
            const session = await db.get('SELECT * FROM active_sessions WHERE userId = ?', [userId]);
            if (!session) {
                return res.status(404).json({ error: 'Сессия не найдена' });
            }
            const { guildId, channelId } = session;
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Сервер не найден' });
            }
            const playerManager = (await Promise.resolve().then(() => __importStar(require('../PlayerManager')))).PlayerManager;
            const guildPlayer = playerManager.getPlayer(guildId);
            // Подключаемся или переходим в нужный канал
            if (!guildPlayer.connection || guildPlayer.connection.joinConfig.channelId !== channelId) {
                guildPlayer.connection = (0, voice_1.joinVoiceChannel)({
                    channelId: channelId,
                    guildId: guildId,
                    adapterCreator: client.guilds.cache.get(guildId).voiceAdapterCreator,
                });
                guildPlayer.connection.subscribe(guildPlayer.player);
            }
            const track = await guildPlayer.resolveTrack(type, query);
            await guildPlayer.play(track);
            // Сохраняем в историю/библиотеку треков, если его еще там нет
            const existing = await db.get('SELECT id FROM tracks WHERE query = ?', [track.query]);
            if (!existing) {
                await db.run('INSERT INTO tracks (title, artist, type, query, duration) VALUES (?, ?, ?, ?, ?)', [track.title, track.artist, track.type, track.query, track.duration]);
            }
            // Автоматически ставим в очередь все следующие треки из базы данных
            const allTracks = await db.all('SELECT * FROM tracks ORDER BY addedAt DESC');
            const trackIndex = allTracks.findIndex(t => t.query === track.query);
            if (trackIndex !== -1) {
                // Копируем все треки после текущего в очередь
                guildPlayer.queue = allTracks.slice(trackIndex + 1);
            }
            res.json({ status: 'success', message: `Воспроизведение начато: ${track.title}` });
        }
        catch (error) {
            console.error('Ошибка воспроизведения:', error);
            res.status(500).json({ error: 'Ошибка сервера при запуске трека', details: error.message });
        }
    });
    router.get('/status', async (req, res) => {
        const userId = req.query.userId;
        if (!userId)
            return res.status(400).json({ error: 'Не передан userId' });
        try {
            const db = await (0, database_1.openDb)();
            const session = await db.get('SELECT * FROM active_sessions WHERE userId = ?', [userId]);
            if (!session)
                return res.status(404).json({ error: 'Сессия не найдена' });
            const playerManager = (await Promise.resolve().then(() => __importStar(require('../PlayerManager')))).PlayerManager;
            const guildPlayer = playerManager.getPlayer(session.guildId);
            res.json(guildPlayer.getStatus());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/action', async (req, res) => {
        const { userId, action, payload } = req.body;
        if (!userId || !action)
            return res.status(400).json({ error: 'Не переданы параметры' });
        try {
            const db = await (0, database_1.openDb)();
            const session = await db.get('SELECT * FROM active_sessions WHERE userId = ?', [userId]);
            if (!session)
                return res.status(404).json({ error: 'Сессия не найдена' });
            const playerManager = (await Promise.resolve().then(() => __importStar(require('../PlayerManager')))).PlayerManager;
            const guildPlayer = playerManager.getPlayer(session.guildId);
            if (action === 'pause')
                guildPlayer.pause();
            else if (action === 'resume')
                guildPlayer.resume();
            else if (action === 'seek')
                guildPlayer.seek(payload.seconds);
            else if (action === 'skip')
                guildPlayer.playNext();
            else if (action === 'previous')
                guildPlayer.playPrevious();
            res.json({ status: 'success', state: guildPlayer.getStatus() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
