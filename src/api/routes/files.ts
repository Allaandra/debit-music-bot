import { Router } from 'express';
import { openDb } from '../../database';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

export default function filesRoutes() {
    const router = Router();

    const storage = multer.diskStorage({
        destination: (req: any, file: any, cb: any) => {
            const dir = path.join(__dirname, '../../..', 'sounds');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
            cb(null, file.originalname);
        }
    });
    const upload = multer({ storage });

    // Функция синхронизации папки sounds и БД
    async function syncSounds() {
        try {
            const db = await openDb();
            const dir = path.join(__dirname, '../../..', 'sounds');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
            
            const mm = await import('music-metadata');

            for (const file of files) {
                const existing = await db.get('SELECT id FROM tracks WHERE type = ? AND query = ? AND owner_id = ?', ['local', file, '450362999073406977']);
                if (!existing) {
                    let duration = 0;
                    let title = file;
                    let artist = 'Локальный файл';
                    let thumbnail = null;
                    try {
                        const metadata = await mm.parseFile(path.join(dir, file));
                        if (metadata.format.duration) duration = Math.round(metadata.format.duration);
                        if (metadata.common.title) title = metadata.common.title;
                        if (metadata.common.artist) artist = metadata.common.artist;
                        if (metadata.common.picture && metadata.common.picture.length > 0) {
                            const pic = metadata.common.picture[0];
                            const coversDir = path.join(__dirname, '../../..', 'covers');
                            if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir);
                            // Имя файла без расширения + .jpg
                            const coverName = file.replace(/\.[^/.]+$/, "") + '.jpg';
                            fs.writeFileSync(path.join(coversDir, coverName), pic.data);
                            thumbnail = `/covers/${encodeURIComponent(coverName)}`;
                        }
                    } catch (e) {
                        console.error('Failed to parse metadata for', file);
                    }

                    await db.run(
                        'INSERT INTO tracks (title, artist, type, query, duration, thumbnail, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [title, artist, 'local', file, duration, thumbnail, '450362999073406977']
                    );

                }
            }
        } catch (e) {
            console.error('Ошибка синхронизации звуков:', e);
        }
    }
    
    // Запускаем синхронизацию при старте и раз в 5 минут
    syncSounds();
    setInterval(syncSounds, 5 * 60 * 1000);

    router.post('/upload', upload.single('file'), async (req: any, res) => {
        if (!req.file) return res.status(400).json({ error: 'Файл не найден' });
        await syncSounds();
        res.json({ status: 'success', file: req.file.originalname });
    });

    router.get('/sounds', async (req, res) => {
        const soundsDir = path.join(__dirname, '../../..', 'sounds');
        try {
            if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir);
            const files = fs.readdirSync(soundsDir).filter((f: string) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
            res.json({ files });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
