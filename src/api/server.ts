import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Client } from 'discord.js';
import path from 'path';

import playerRoutes from './routes/player';
import tracksRoutes from './routes/tracks';
import playlistsRoutes from './routes/playlists';
import filesRoutes from './routes/files';
import authRoutes from './routes/auth';
import sfxRoutes from './routes/sfx';
import { requireAuth } from './middlewares/authMiddleware';

import http from 'http';
import { Server } from 'socket.io';
import { PlayerManager } from '../services/PlayerService';

export function startApi(client: Client) {
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

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        // Подписка на гильдию
        socket.on('subscribe', (guildId) => {
            socket.join(`guild_${guildId}`);
            
            // Если игрок уже есть, отправляем текущее состояние
            if (PlayerManager.players.has(guildId)) {
                const player = PlayerManager.getPlayer(guildId);
                socket.emit('stateUpdate', player.getStatus());
            }
        });
    });

    // Настраиваем отправку обновлений при создании плееров
    const originalGetPlayer = PlayerManager.getPlayer.bind(PlayerManager);
    PlayerManager.getPlayer = (guildId: string) => {
        const isNew = !PlayerManager.players.has(guildId);
        const player = originalGetPlayer(guildId);
        
        if (isNew) {
            player.on('stateUpdate', (state) => {
                io.to(`guild_${guildId}`).emit('stateUpdate', state);
            });
        }
        
        return player;
    };

    server.listen(PORT, () => {
        console.log(`Express-сервер слушает порт ${PORT}`);
    });
}