import path from 'path';
import fs from 'fs';
import { Client } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { prisma } from '../database';
import { PlayerManager } from './PlayerService';

export class SfxService {
    private soundsDir = path.resolve(__dirname, '../..', 'sounds');
    private initializedUsers = new Set<string>();

    getSoundFilePath(sound: { ownerId: string; filename: string }): string {
        const userPath = path.join(this.soundsDir, sound.ownerId, 'sfx', sound.filename);
        if (fs.existsSync(userPath)) return userPath;

        const defaultPath = path.join(this.soundsDir, 'default_sfx', sound.filename);
        if (fs.existsSync(defaultPath)) return defaultPath;

        const sharedPath = path.join(this.soundsDir, 'shared_sfx', sound.filename);
        if (fs.existsSync(sharedPath)) return sharedPath;

        return userPath;
    }

    async ensureDefaultPlaylists(userId: string): Promise<void> {
        if (this.initializedUsers.has(userId)) return;
        this.initializedUsers.add(userId);

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
                    const defaultFilePath = path.join(this.soundsDir, 'default_sfx', s.filename);
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
            this.initializedUsers.delete(userId);
        }
    }

    async syncSfxSounds(userId: string): Promise<void> {
        try {
            const userSfxDir = path.join(this.soundsDir, userId, 'sfx');
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

            // Cleanup DB records if file was deleted on disk
            const dbSounds = await prisma.sfxSound.findMany({
                where: { ownerId: userId }
            });
            for (const s of dbSounds) {
                const fp = this.getSoundFilePath(s);
                if (!fs.existsSync(fp)) {
                    await prisma.sfxSound.delete({ where: { id: s.id } });
                }
            }
        } catch (err) {
            console.error('SFX auto-sync error:', err);
        }
    }

    async getPlaylists(userId: string): Promise<any[]> {
        await this.ensureDefaultPlaylists(userId);
        await this.syncSfxSounds(userId);

        const playlists = await prisma.sfxPlaylist.findMany({
            where: { ownerId: userId },
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            include: {
                sounds: {
                    orderBy: { id: 'asc' }
                }
            }
        });

        // Fetch any global sounds created by other users
        const otherGlobalSounds = await prisma.sfxSound.findMany({
            where: {
                isGlobal: true,
                ownerId: { not: userId }
            },
            orderBy: { id: 'asc' }
        });

        if (otherGlobalSounds.length > 0) {
            playlists.push({
                id: -1,
                ownerId: userId,
                name: 'Shared',
                icon: 'globe',
                order: 999,
                createdAt: new Date(),
                sounds: otherGlobalSounds as any
            });
        }

        return playlists.map(pl => ({
            ...pl,
            sounds: pl.sounds.map(s => ({
                ...s,
                canEdit: s.ownerId === userId
            }))
        }));
    }

    async createPlaylist(userId: string, name: string, icon?: string): Promise<any> {
        const count = await prisma.sfxPlaylist.count({ where: { ownerId: userId } });
        return prisma.sfxPlaylist.create({
            data: {
                ownerId: userId,
                name,
                icon: icon || 'swords',
                order: count
            },
            include: { sounds: true }
        });
    }

    async deletePlaylist(userId: string, playlistId: number): Promise<boolean> {
        const playlist = await prisma.sfxPlaylist.findFirst({
            where: { id: playlistId, ownerId: userId },
            include: { sounds: true }
        });

        if (!playlist) return false;

        for (const s of playlist.sounds) {
            const filePath = path.join(this.soundsDir, userId, 'sfx', s.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.sfxPlaylist.delete({
            where: { id: playlistId }
        });

        return true;
    }

    async uploadSound(
        userId: string,
        playlistId: number,
        filePath: string,
        originalFilename: string,
        storedFilename: string,
        title?: string,
        isGlobal?: boolean
    ): Promise<any> {
        let duration: number | null = null;
        try {
            const mm = await import('music-metadata');
            const meta = await mm.parseFile(filePath);
            if (meta.format.duration) {
                duration = Math.round(meta.format.duration * 10) / 10;
            }
        } catch (e) {}

        return prisma.sfxSound.create({
            data: {
                ownerId: userId,
                playlistId,
                title: title || originalFilename.replace(/\.[^/.]+$/, ''),
                filename: storedFilename,
                duration,
                isGlobal: !!isGlobal
            }
        });
    }

    async toggleGlobal(userId: string, soundId: number): Promise<any | null> {
        const sound = await prisma.sfxSound.findFirst({
            where: { id: soundId, ownerId: userId }
        });

        if (!sound) return null;

        return prisma.sfxSound.update({
            where: { id: soundId },
            data: { isGlobal: !sound.isGlobal }
        });
    }

    async deleteSound(userId: string, soundId: number): Promise<boolean> {
        const sound = await prisma.sfxSound.findFirst({
            where: { id: soundId, ownerId: userId }
        });

        if (!sound) return false;

        const filePath = path.join(this.soundsDir, userId, 'sfx', sound.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await prisma.sfxSound.delete({
            where: { id: soundId }
        });

        return true;
    }

    async playSound(client: Client, userId: string, soundId: number, volume: number = 1.0, loop: boolean = false): Promise<{ soundTitle: string; looping: boolean }> {
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
            throw new Error('Sound not found');
        }

        const session = await prisma.activeSession.findUnique({
            where: { userId }
        });

        if (!session) {
            throw new Error('Bot is not connected to a voice channel');
        }

        const { guildId, channelId } = session;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Discord server not found');
        }

        const guildPlayer = PlayerManager.getPlayer(guildId);

        if (!guildPlayer.connection || guildPlayer.connection.joinConfig.channelId !== channelId) {
            guildPlayer.connection = joinVoiceChannel({
                channelId,
                guildId,
                adapterCreator: guild.voiceAdapterCreator,
            });
        }

        const sfxPath = this.getSoundFilePath(sound);
        if (!fs.existsSync(sfxPath)) {
            throw new Error('Audio file not found on server');
        }

        await guildPlayer.playSfx(soundId, sfxPath, volume, loop);

        return { soundTitle: sound.title, looping: loop };
    }

    async stopLoop(client: Client, userId: string, soundId: number): Promise<{ success: boolean }> {
        const session = await prisma.activeSession.findUnique({
            where: { userId }
        });

        if (!session) {
            throw new Error('Bot is not connected to a voice channel');
        }

        const guildPlayer = PlayerManager.getPlayer(session.guildId);
        guildPlayer.stopLoopSfx(soundId);
        return { success: true };
    }

    async getPreviewFilePath(userId: string, soundId: number): Promise<string | null> {
        const sound = await prisma.sfxSound.findFirst({
            where: {
                id: soundId,
                OR: [
                    { ownerId: userId },
                    { isGlobal: true }
                ]
            }
        });

        if (!sound) return null;

        const sfxPath = this.getSoundFilePath(sound);
        if (!fs.existsSync(sfxPath)) return null;

        return sfxPath;
    }
}

export const sfxService = new SfxService();
