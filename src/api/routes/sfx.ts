import { Router } from 'express';
import { Client } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { prisma } from '../../database';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

export default function sfxRoutes(client: Client) {
    const router = Router();

    const storage = multer.diskStorage({
        destination: (req: any, file: any, cb: any) => {
            const userId = req.user?.id || '450362999073406977';
            const dir = path.join(__dirname, '../../..', 'sounds', userId, 'sfx');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
            const ext = path.extname(file.originalname);
            const safeName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            cb(null, safeName);
        }
    });

    const upload = multer({
        storage,
        limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
    });

    // Helper: find file location on disk (user folder, default_sfx, or shared_sfx)
    function getSoundFilePath(sound: { ownerId: string; filename: string }): string {
        const userPath = path.join(__dirname, '../../..', 'sounds', sound.ownerId, 'sfx', sound.filename);
        if (fs.existsSync(userPath)) return userPath;

        const defaultPath = path.join(__dirname, '../../..', 'sounds', 'default_sfx', sound.filename);
        if (fs.existsSync(defaultPath)) return defaultPath;

        const sharedPath = path.join(__dirname, '../../..', 'sounds', 'shared_sfx', sound.filename);
        if (fs.existsSync(sharedPath)) return sharedPath;

        return userPath;
    }

    // In-memory set to only seed and migrate once per process per user
    const initializedUsers = new Set<string>();

    // Seed default playlists and built-in sounds if user has none or if default sounds are missing
    async function ensureDefaultPlaylists(userId: string) {
        if (initializedUsers.has(userId)) return;
        initializedUsers.add(userId);

        try {
            // One-time migration of any legacy Russian default playlists
            const oldPls = await prisma.sfxPlaylist.findMany({
                where: { ownerId: userId, name: { in: ['Бой', 'Магия', 'Окружение', 'Кубики', 'Монстры'] } }
            });

            if (oldPls.length > 0) {
                const ruToEnPlaylists: Record<string, string> = {
                    'Бой': 'Combat',
                    'Магия': 'Magic',
                    'Окружение': 'Ambience',
                    'Кубики': 'Dice',
                    'Монстры': 'Monsters',
                };
                for (const oldPl of oldPls) {
                    if (ruToEnPlaylists[oldPl.name]) {
                        await prisma.sfxPlaylist.update({
                            where: { id: oldPl.id },
                            data: { name: ruToEnPlaylists[oldPl.name] }
                        });
                    }
                }

                const ruToEnSounds: Record<string, string> = {
                    'sword_hit.mp3': 'Sword Hit',
                    'shield_block.mp3': 'Shield Block',
                    'arrow_shot.mp3': 'Arrow Shot',
                    'critical_hit.mp3': 'Critical Hit',
                    'magic_spell.mp3': 'Magic Spell',
                    'fireball.mp3': 'Fireball',
                    'heal_spell.mp3': 'Heal',
                    'lightning_bolt.mp3': 'Lightning Bolt',
                    'tavern_bell.mp3': 'Tavern Bell',
                    'door_creak.mp3': 'Door Creak',
                    'thunder_rumble.mp3': 'Thunder',
                    'campfire_crack.mp3': 'Campfire',
                    'dice_roll.mp3': 'Dice Roll',
                    'nat20_fanfare.mp3': 'Natural 20',
                    'nat1_fail.mp3': 'Critical Fail',
                    'monster_roar.mp3': 'Monster Roar',
                };
                for (const [filename, enTitle] of Object.entries(ruToEnSounds)) {
                    await prisma.sfxSound.updateMany({
                        where: { ownerId: userId, filename },
                        data: { title: enTitle }
                    });
                }
            }

            const defaults = [
            {
                name: 'Combat',
                icon: 'swords',
                order: 0,
                sounds: [
                    { title: 'Sword Hit', filename: 'sword_hit.mp3', duration: 0.7 },
                    { title: 'Shield Block', filename: 'shield_block.mp3', duration: 0.8 },
                    { title: 'Arrow Shot', filename: 'arrow_shot.mp3', duration: 0.6 },
                    { title: 'Critical Hit', filename: 'critical_hit.mp3', duration: 1.0 },
                ]
            },
            {
                name: 'Magic',
                icon: 'sparkles',
                order: 1,
                sounds: [
                    { title: 'Magic Spell', filename: 'magic_spell.mp3', duration: 1.4 },
                    { title: 'Fireball', filename: 'fireball.mp3', duration: 1.5 },
                    { title: 'Heal', filename: 'heal_spell.mp3', duration: 1.6 },
                    { title: 'Lightning Bolt', filename: 'lightning_bolt.mp3', duration: 1.2 },
                ]
            },
            {
                name: 'Ambience',
                icon: 'trees',
                order: 2,
                sounds: [
                    { title: 'Tavern Bell', filename: 'tavern_bell.mp3', duration: 1.8 },
                    { title: 'Door Creak', filename: 'door_creak.mp3', duration: 1.5 },
                    { title: 'Thunder', filename: 'thunder_rumble.mp3', duration: 2.5 },
                    { title: 'Campfire', filename: 'campfire_crack.mp3', duration: 2.0 },
                ]
            },
            {
                name: 'Dice',
                icon: 'dices',
                order: 3,
                sounds: [
                    { title: 'Dice Roll', filename: 'dice_roll.mp3', duration: 1.1 },
                    { title: 'Natural 20', filename: 'nat20_fanfare.mp3', duration: 1.5 },
                    { title: 'Critical Fail', filename: 'nat1_fail.mp3', duration: 1.3 },
                ]
            },
            {
                name: 'Monsters',
                icon: 'skull',
                order: 4,
                sounds: [
                    { title: 'Monster Roar', filename: 'monster_roar.mp3', duration: 1.8 },
                ]
            }
        ];

        for (const item of defaults) {
            let pl = await prisma.sfxPlaylist.findFirst({
                where: { ownerId: userId, name: item.name }
            });

            if (!pl) {
                pl = await prisma.sfxPlaylist.create({
                    data: {
                        ownerId: userId,
                        name: item.name,
                        icon: item.icon,
                        order: item.order
                    }
                });
            }

            for (const s of item.sounds) {
                const defaultFilePath = path.join(__dirname, '../../..', 'sounds', 'default_sfx', s.filename);
                if (!fs.existsSync(defaultFilePath)) continue;

                const existingSound = await prisma.sfxSound.findFirst({
                    where: { ownerId: userId, filename: s.filename }
                });

                if (!existingSound) {
                    await prisma.sfxSound.create({
                        data: {
                            ownerId: userId,
                            playlistId: pl.id,
                            title: s.title,
                            filename: s.filename,
                            duration: s.duration,
                            isGlobal: true
                        }
                    });
                }
            }
        }
    } catch (e) {
        console.error('Error ensuring default playlists:', e);
        initializedUsers.delete(userId);
    }
}

    // Auto-sync sound files dropped in sounds/<userId>/sfx/ directly in Windows Explorer
    async function syncSfxSounds(userId: string) {
        try {
            const userSfxDir = path.join(__dirname, '../../..', 'sounds', userId, 'sfx');
            if (!fs.existsSync(userSfxDir)) {
                fs.mkdirSync(userSfxDir, { recursive: true });
                return;
            }

            const files = fs.readdirSync(userSfxDir).filter(f =>
                f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg') || f.endsWith('.m4a')
            );

            const firstPlaylist = await prisma.sfxPlaylist.findFirst({
                where: { ownerId: userId },
                orderBy: { order: 'asc' }
            });
            if (!firstPlaylist) return;

            const mm = await import('music-metadata');

            for (const file of files) {
                const existing = await prisma.sfxSound.findFirst({
                    where: { ownerId: userId, filename: file }
                });

                if (!existing) {
                    let duration: number | null = null;
                    try {
                        const meta = await mm.parseFile(path.join(userSfxDir, file));
                        if (meta.format.duration) duration = Math.round(meta.format.duration * 10) / 10;
                    } catch (e) {}

                    const title = file.replace(/\.[^/.]+$/, '').replace(/^[0-9]+_/, '').replace(/_/g, ' ');
                    await prisma.sfxSound.create({
                        data: {
                            ownerId: userId,
                            playlistId: firstPlaylist.id,
                            title,
                            filename: file,
                            duration,
                            isGlobal: false
                        }
                    });
                }
            }

            // Cleanup DB records if file was deleted on disk (for non-preinstalled sounds)
            const dbSounds = await prisma.sfxSound.findMany({
                where: { ownerId: userId }
            });
            for (const s of dbSounds) {
                const fp = getSoundFilePath(s);
                if (!fs.existsSync(fp)) {
                    await prisma.sfxSound.delete({ where: { id: s.id } });
                }
            }
        } catch (err) {
            console.error('SFX auto-sync error:', err);
        }
    }

    // 1. GET all playlists with sounds (and global shared sounds)
    router.get('/playlists', async (req, res) => {
        const userId = (req as any).user.id;
        try {
            await ensureDefaultPlaylists(userId);
            await syncSfxSounds(userId);

            const playlists = await prisma.sfxPlaylist.findMany({
                where: { ownerId: userId },
                orderBy: [{ order: 'asc' }, { id: 'asc' }],
                include: {
                    sounds: {
                        orderBy: { id: 'asc' }
                    }
                }
            });

            // Fetch any global sounds created by OTHER users (or shared sounds)
            const otherGlobalSounds = await prisma.sfxSound.findMany({
                where: {
                    isGlobal: true,
                    ownerId: { not: userId }
                },
                orderBy: { id: 'asc' }
            });

            // If there are other global sounds, add a virtual "Shared" playlist
            if (otherGlobalSounds.length > 0) {
                playlists.push({
                    id: -1, // Virtual ID for global category
                    ownerId: userId,
                    name: 'Shared',
                    icon: 'globe',
                    order: 999,
                    createdAt: new Date(),
                    sounds: otherGlobalSounds as any
                });
            }

            // Map sounds to include canEdit permission
            const mapped = playlists.map(pl => ({
                ...pl,
                sounds: pl.sounds.map(s => ({
                    ...s,
                    canEdit: s.ownerId === userId
                }))
            }));

            res.json(mapped);
        } catch (err: any) {
            console.error('Error fetching SFX playlists:', err);
            res.status(500).json({ error: 'Failed to load SFX playlists' });
        }
    });

    // 2. POST create new playlist
    router.post('/playlists', async (req, res) => {
        const userId = (req as any).user.id;
        const { name, icon } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }

        try {
            const count = await prisma.sfxPlaylist.count({ where: { ownerId: userId } });
            const playlist = await prisma.sfxPlaylist.create({
                data: {
                    ownerId: userId,
                    name,
                    icon: icon || 'swords',
                    order: count
                },
                include: { sounds: true }
            });

            res.json(playlist);
        } catch (err: any) {
            console.error('Error creating SFX playlist:', err);
            res.status(500).json({ error: 'Failed to create playlist' });
        }
    });

    // 3. DELETE playlist
    router.delete('/playlists/:id', async (req, res) => {
        const userId = (req as any).user.id;
        const playlistId = parseInt(req.params.id);

        try {
            const playlist = await prisma.sfxPlaylist.findFirst({
                where: { id: playlistId, ownerId: userId },
                include: { sounds: true }
            });

            if (!playlist) {
                return res.status(404).json({ error: 'Playlist not found' });
            }

            for (const s of playlist.sounds) {
                const filePath = path.join(__dirname, '../../..', 'sounds', userId, 'sfx', s.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await prisma.sfxPlaylist.delete({
                where: { id: playlistId }
            });

            res.json({ success: true });
        } catch (err: any) {
            console.error('Error deleting SFX playlist:', err);
            res.status(500).json({ error: 'Failed to delete playlist' });
        }
    });

    // 4. POST upload sound
    router.post('/upload', upload.single('sound'), async (req, res) => {
        const userId = (req as any).user.id;
        const { title, playlistId, isGlobal } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        if (!playlistId) {
            return res.status(400).json({ error: 'playlistId is required' });
        }

        try {
            let duration: number | null = null;
            try {
                const mm = await import('music-metadata');
                const meta = await mm.parseFile(req.file.path);
                if (meta.format.duration) {
                    duration = Math.round(meta.format.duration * 10) / 10;
                }
            } catch (e) {}

            const sound = await prisma.sfxSound.create({
                data: {
                    ownerId: userId,
                    playlistId: parseInt(playlistId),
                    title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
                    filename: req.file.filename,
                    duration,
                    isGlobal: isGlobal === 'true' || isGlobal === true
                }
            });

            res.json(sound);
        } catch (err: any) {
            console.error('Error uploading SFX:', err);
            res.status(500).json({ error: 'Failed to save sound' });
        }
    });

    // 5. PATCH toggle isGlobal for sound
    router.patch('/sounds/:id/toggle-global', async (req, res) => {
        const userId = (req as any).user.id;
        const soundId = parseInt(req.params.id);

        try {
            const sound = await prisma.sfxSound.findFirst({
                where: { id: soundId, ownerId: userId }
            });

            if (!sound) {
                return res.status(404).json({ error: 'Sound not found or you are not the owner' });
            }

            const updated = await prisma.sfxSound.update({
                where: { id: soundId },
                data: { isGlobal: !sound.isGlobal }
            });

            res.json(updated);
        } catch (err: any) {
            console.error('Error toggling isGlobal:', err);
            res.status(500).json({ error: 'Failed to update sound' });
        }
    });

    // 6. DELETE sound
    router.delete('/sounds/:id', async (req, res) => {
        const userId = (req as any).user.id;
        const soundId = parseInt(req.params.id);

        try {
            const sound = await prisma.sfxSound.findFirst({
                where: { id: soundId, ownerId: userId }
            });

            if (!sound) {
                return res.status(404).json({ error: 'Sound not found or permission denied' });
            }

            const filePath = path.join(__dirname, '../../..', 'sounds', userId, 'sfx', sound.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            await prisma.sfxSound.delete({
                where: { id: soundId }
            });

            res.json({ success: true });
        } catch (err: any) {
            console.error('Error deleting SFX sound:', err);
            res.status(500).json({ error: 'Failed to delete sound' });
        }
    });

    // 7. POST play sound in Discord (overlay onto stream)
    router.post('/play', async (req, res) => {
        const userId = (req as any).user.id;
        const { soundId, volume = 1.0 } = req.body;

        if (!soundId) {
            return res.status(400).json({ error: 'soundId is required' });
        }

        try {
            const sound = await prisma.sfxSound.findFirst({
                where: {
                    id: parseInt(soundId),
                    OR: [
                        { ownerId: userId },
                        { isGlobal: true }
                    ]
                }
            });

            if (!sound) {
                return res.status(404).json({ error: 'Sound not found' });
            }

            const session = await prisma.activeSession.findUnique({
                where: { userId }
            });

            if (!session) {
                return res.status(400).json({ error: 'Bot is not connected to a voice channel' });
            }

            const { guildId, channelId } = session;
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Discord server not found' });
            }

            const { PlayerManager } = await import('../../services/PlayerService');
            const guildPlayer = PlayerManager.getPlayer(guildId);

            if (!guildPlayer.connection || guildPlayer.connection.joinConfig.channelId !== channelId) {
                guildPlayer.connection = joinVoiceChannel({
                    channelId,
                    guildId,
                    adapterCreator: guild.voiceAdapterCreator,
                });
            }

            const sfxPath = getSoundFilePath(sound);
            if (!fs.existsSync(sfxPath)) {
                return res.status(404).json({ error: 'Audio file not found on server' });
            }

            await guildPlayer.playSfx(sfxPath, volume);

            res.json({ success: true, soundTitle: sound.title });
        } catch (err: any) {
            console.error('Error playing SFX sound:', err);
            res.status(500).json({ error: 'Failed to play SFX' });
        }
    });

    // 8. GET preview audio in browser
    router.get('/audio/:id', async (req, res) => {
        const userId = (req as any).user.id;
        const soundId = parseInt(req.params.id);

        try {
            const sound = await prisma.sfxSound.findFirst({
                where: {
                    id: soundId,
                    OR: [
                        { ownerId: userId },
                        { isGlobal: true }
                    ]
                }
            });

            if (!sound) {
                return res.status(404).send('Not found');
            }

            const sfxPath = getSoundFilePath(sound);
            if (!fs.existsSync(sfxPath)) {
                return res.status(404).send('File not found');
            }

            res.sendFile(sfxPath);
        } catch (err: any) {
            console.error('Error streaming SFX preview:', err);
            res.status(500).send('Error');
        }
    });

    return router;
}
