import { Router } from 'express';
import { prisma } from '../../database';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

export const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus']);

const userLastSync = new Map<string, number>();
const SYNC_THROTTLE_MS = 15000; // 15 секунд кулдаун на пользователя

export async function syncSounds(userId?: string): Promise<void> {
    try {
        const baseDir = path.join(__dirname, '../../..', 'sounds');
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
        
        const mm = await import('music-metadata');
        
        // Исключаем служебные системные папки SFX
        const systemDirs = new Set(['default_sfx', 'shared_sfx']);
        
        const usersToSync = userId 
            ? [userId] 
            : fs.readdirSync(baseDir).filter(f => {
                if (systemDirs.has(f)) return false;
                try {
                    return fs.statSync(path.join(baseDir, f)).isDirectory();
                } catch {
                    return false;
                }
            });
        
        for (const uid of usersToSync) {
            const userDir = path.join(baseDir, uid);
            if (!fs.existsSync(userDir)) continue;
            
            const diskFiles = fs.readdirSync(userDir).filter((f: string) => {
                const ext = path.extname(f).toLowerCase();
                return AUDIO_EXTENSIONS.has(ext);
            });

            // 1. Извлекаем все существующие локальные треки пользователя ОДНИМ запросом к БД
            const dbLocalTracks = await prisma.track.findMany({
                where: { 
                    type: 'local',
                    ownerId: uid 
                },
                select: { id: true, query: true }
            });

            const dbTrackMap = new Map<string, number>();
            for (const t of dbLocalTracks) {
                dbTrackMap.set(t.query, t.id);
            }

            const diskQuerySet = new Set<string>();

            // 2. Сканируем файлы на диске и добавляем новые
            for (const file of diskFiles) {
                const queryPath = `${uid}/${file}`; // Путь относительно папки sounds
                diskQuerySet.add(queryPath);
                
                if (!dbTrackMap.has(queryPath)) {
                    let duration = 0;
                    let title = path.basename(file, path.extname(file));
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

            // 3. Garbage Collection: удаляем из БД записи файлов, которые были удалены с диска
            for (const [queryPath, trackId] of dbTrackMap.entries()) {
                if (!diskQuerySet.has(queryPath)) {
                    const fullPath = path.join(baseDir, queryPath);
                    if (!fs.existsSync(fullPath)) {
                        await prisma.playlistTrack.deleteMany({
                            where: { trackId }
                        });
                        await prisma.track.delete({
                            where: { id: trackId }
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error('Ошибка синхронизации звуков:', e);
    }
}

export async function syncUserSoundsThrottled(userId: string): Promise<void> {
    const now = Date.now();
    const last = userLastSync.get(userId) || 0;
    if (now - last < SYNC_THROTTLE_MS) return;
    userLastSync.set(userId, now);
    await syncSounds(userId);
}

// Запускаем синхронизацию при старте и раз в 5 минут
syncSounds();
const syncInterval = setInterval(() => syncSounds(), 5 * 60 * 1000);
syncInterval.unref();

export default function filesRoutes() {
    const router = Router();

    const storage = multer.diskStorage({
        destination: (req: any, file: any, cb: any) => {
            const userId = req.user?.id;
            if (!userId) {
                return cb(new Error('Unauthorized: User ID missing'), '');
            }
            const dir = path.join(__dirname, '../../..', 'sounds', userId);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
            cb(null, path.basename(file.originalname));
        }
    });
    const upload = multer({ storage });

    router.post('/upload', upload.single('file'), async (req: any, res) => {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!req.file) return res.status(400).json({ error: 'Файл не найден' });
        await syncSounds(userId);
        res.json({ status: 'success', file: req.file.originalname });
    });

    router.post('/sounds/sync', async (req: any, res) => {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        await syncSounds(userId);
        res.json({ status: 'success' });
    });

    router.get('/sounds', async (req: any, res) => {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const userDir = path.join(__dirname, '../../..', 'sounds', userId);
        try {
            if (!fs.existsSync(userDir)) {
                return res.json({ files: [] });
            }
            const files = fs.readdirSync(userDir).filter((f: string) => {
                const ext = path.extname(f).toLowerCase();
                return AUDIO_EXTENSIONS.has(ext);
            });
            res.json({ files });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
