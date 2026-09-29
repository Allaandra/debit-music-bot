import express from 'express';
import cors from 'cors';
import { Client } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource } from '@discordjs/voice';
import path from 'path';
import { openDb } from '../database';
import play from 'play-dl';
import spotifyUrlInfo from 'spotify-url-info';
import youtubedl from 'youtube-dl-exec';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { StreamType } from '@discordjs/voice';

import playerRoutes from './routes/player';
import tracksRoutes from './routes/tracks';
import playlistsRoutes from './routes/playlists';
import filesRoutes from './routes/files';

// @ts-ignore
const spotify = spotifyUrlInfo(fetch);

function createNormalizedResource(input: string | any) {
    const isFile = typeof input === 'string';
    const args = [
        '-i', isFile ? input : 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-f', 'ogg',
        '-af', 'dynaudnorm=f=200:g=5:r=0.9', // Смарт-нормализатор громкости
        'pipe:1'
    ];
    
    const ffmpeg = spawn(ffmpegPath as string, args, { stdio: ['pipe', 'pipe', 'ignore'] });

    if (!isFile) {
        input.pipe(ffmpeg.stdin);
        
        // Закрываем ffmpeg, если yt-dlp умер
        input.on('error', () => ffmpeg.kill());
        input.on('close', () => ffmpeg.kill());
    }

    ffmpeg.on('error', (err) => console.error('FFmpeg ошибка:', err.message));
    
    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus });
}

export function startApi(client: Client) {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/api', playerRoutes(client));
    app.use('/api/tracks', tracksRoutes());
    app.use('/api/playlists', playlistsRoutes());
    app.use('/api', filesRoutes());

    // Раздача статики React-приложения
    app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
    app.use('/covers', express.static(path.join(__dirname, '..', 'covers')));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    });

    const PORT = 3001;
    app.listen(PORT, () => {
        console.log(`Express-сервер слушает порт ${PORT}`);
    });
}