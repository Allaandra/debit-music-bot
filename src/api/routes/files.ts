import { Router } from 'express';
import { prisma } from '../../database';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

export default function filesRoutes() {
    const router = Router();

    const storage = multer.diskStorage({
        destination: (req: any, file: any, cb: any) => {
            const userId = req.user?.id || '450362999073406977';
            const dir = path.join(__dirname, '../../..', 'sounds', userId);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
            cb(null, file.originalname);
        }
    });
    const upload = multer({ storage });

    async function syncSounds(userId?: string) {
        try {
            const baseDir = path.join(__dirname, '../../..', 'sounds');
            if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
            
            const mm = await import('music-metadata');
            
            // Если userId не передан, сканируем все подпапки (всех юзеров)
            const usersToSync = userId ? [userId] : fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());
            
            for (const uid of usersToSync) {
                const userDir = path.join(baseDir, uid);
                if (!fs.existsSync(userDir)) continue;
                
                const files = fs.readdirSync(userDir).filter((f: string) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
                
                for (const file of files) {
                    const queryPath = `${uid}/${file}`; // Путь относительно папки sounds
                    
                    const existing = await prisma.track.findFirst({
                        where: { 
                            type: 'local', 
                            query: queryPath,
                            ownerId: uid
                        }
                    });
                    
                    if (!existing) {
                        let duration = 0;
                        let title = file;
                        let artist = 'Локальный файл';
                        let thumbnail = null;
                        try {
                            const metadata = await mm.parseFile(path.join(userDir, file));
                            if (metadata.format.duration) duration = Math.round(metadata.format.duration);
                            if (metadata.common.title) title = metadata.common.title;
                            if (metadata.common.artist) artist = metadata.common.artist;
                            if (metadata.common.picture && metadata.common.picture.length > 0) {
                                const pic = metadata.common.picture[0];
                                const coversDir = path.join(__dirname, '../../..', 'covers');
                                if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
                                const coverName = `${uid}_${file.replace(/\.[^/.]+$/, "")}.jpg`;
                                fs.writeFileSync(path.join(coversDir, coverName), pic.data);
                                thumbnail = `/covers/${encodeURIComponent(coverName)}`;
                            }
                        } catch (e) {
                            console.error('Failed to parse metadata for', file);
                        }

                        await prisma.track.create({
                            data: {
                                title,
                                artist,
                                type: 'local',
                                query: queryPath,
                                duration,
                                thumbnail,
                                ownerId: uid
                            }
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Ошибка синхронизации звуков:', e);
        }
    }
    
    // Запускаем синхронизацию при старте и раз в 5 минут
    syncSounds();
    setInterval(() => syncSounds(), 5 * 60 * 1000);

    router.post('/upload', upload.single('file'), async (req: any, res) => {
        if (!req.file) return res.status(400).json({ error: 'Файл не найден' });
        await syncSounds(req.user?.id);
        res.json({ status: 'success', file: req.file.originalname });
    });

    router.get('/sounds', async (req: any, res) => {
        const userId = req.user?.id || '450362999073406977';
        const userDir = path.join(__dirname, '../../..', 'sounds', userId);
        try {
            if (!fs.existsSync(userDir)) {
                return res.json({ files: [] });
            }
            const files = fs.readdirSync(userDir).filter((f: string) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
            res.json({ files });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
