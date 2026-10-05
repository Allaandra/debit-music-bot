import express from 'express';
import cors from 'cors';
import { Client } from 'discord.js';
import path from 'path';

import playerRoutes from './routes/player';
import tracksRoutes from './routes/tracks';
import playlistsRoutes from './routes/playlists';
import filesRoutes from './routes/files';

export function startApi(client: Client) {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/api', playerRoutes(client));
    app.use('/api/tracks', tracksRoutes());
    app.use('/api/playlists', playlistsRoutes());
    app.use('/api', filesRoutes());

    // Раздача статики React-приложения
    app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'dist')));
    app.use('/covers', express.static(path.join(__dirname, '..', '..', 'covers')));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
    });

    const PORT = 3001;
    app.listen(PORT, () => {
        console.log(`Express-сервер слушает порт ${PORT}`);
    });
}