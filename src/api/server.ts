import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Client } from 'discord.js';
import path from 'path';

import playerRoutes from './routes/player';
import tracksRoutes from './routes/tracks';
import playlistsRoutes from './routes/playlists';
import filesRoutes, { startBackgroundSoundSync } from './routes/files';
import authRoutes from './routes/auth';
import sfxRoutes from './routes/sfx';
import { requireAuth, JWT_SECRET } from './middlewares/authMiddleware';

import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { PlayerManager } from '../services/PlayerService';
import { prisma } from '../database';

function parseCookies(cookieHeader?: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!cookieHeader) return result;
    for (const part of cookieHeader.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        try {
            result[key] = decodeURIComponent(val);
        } catch {
            result[key] = val;
        }
    }
    return result;
}

export function startApi(client: Client) {
    const stopSoundSync = startBackgroundSoundSync();
    const app = express();
    app.use(cors({ origin: true, credentials: true })); // Allow cookies for cross-origin if needed
    app.use(express.json());
    app.use(cookieParser());

    app.use('/api/auth', authRoutes());
    
    // Protect all other /api routes
    app.use('/api', requireAuth);
    
    app.use('/api', playerRoutes(client));
    app.use('/api/tracks', tracksRoutes());
    app.use('/api/playlists', playlistsRoutes());
    app.use('/api', filesRoutes());
    app.use('/api/sfx', sfxRoutes(client));

    // Раздача статики React-приложения
    app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'dist')));
    app.use('/covers', express.static(path.join(__dirname, '..', '..', 'covers')));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
    });

    const PORT = 3001;
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: true,
            credentials: true
        }
    });

    // Авторизация WebSocket-соединений по JWT cookie
    io.use((socket, next) => {
        const cookies = parseCookies(socket.handshake.headers.cookie);
        const token = cookies.auth_token;
        if (!token) {
            return next(new Error('Unauthorized'));
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            socket.data.user = decoded;
            next();
        } catch {
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.data.user?.id;

        // Автоматическая подписка на активную голосовую сессию пользователя
        if (userId) {
            try {
                const session = await prisma.activeSession.findUnique({ where: { userId } });
                if (session?.guildId) {
                    socket.join(`guild_${session.guildId}`);
                    if (PlayerManager.players.has(session.guildId)) {
                        const player = PlayerManager.getPlayer(session.guildId);
                        socket.emit('stateUpdate', { ...player.getStatus(), guildId: session.guildId });
                    }
                }
            } catch (e) {}
        }

        // Подписка на гильдию
        socket.on('subscribe', (guildId) => {
            if (!guildId || typeof guildId !== 'string') return;
            socket.join(`guild_${guildId}`);
            
            // Если игрок уже есть, отправляем текущее состояние
            if (PlayerManager.players.has(guildId)) {
                const player = PlayerManager.getPlayer(guildId);
                socket.emit('stateUpdate', { ...player.getStatus(), guildId });
            }
        });

        socket.on('getStatus', (guildId) => {
            if (guildId && typeof guildId === 'string' && PlayerManager.players.has(guildId)) {
                const player = PlayerManager.getPlayer(guildId);
                socket.emit('stateUpdate', { ...player.getStatus(), guildId });
            }
        });
    });

    // Чистая подписка на обновления плееров через EventEmitter (без monkey patching)
    PlayerManager.on('stateUpdate', ({ guildId, state }) => {
        io.to(`guild_${guildId}`).emit('stateUpdate', { ...state, guildId });
    });

    server.listen(PORT, () => {
        console.log(`Express-сервер слушает порт ${PORT}`);
    });

    return {
        server,
        io,
        close: async () => {
            stopSoundSync();
            return new Promise<void>((resolve) => {
                io.close(() => {
                    server.close(() => resolve());
                });
            });
        }
    };
}