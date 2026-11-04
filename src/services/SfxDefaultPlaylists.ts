import path from 'path';
import fs from 'fs';
import { prisma } from '../database';

export interface DefaultSfxSoundDef {
    title: string;
    filename: string;
    duration: number;
}

export interface DefaultSfxPlaylistDef {
    name: string;
    icon: string;
    order: number;
    sounds: DefaultSfxSoundDef[];
}

export const RU_TO_EN_PLAYLISTS: Record<string, string> = {
    'Бой': 'Combat',
    'Магия': 'Magic',
    'Окружение': 'Ambience',
    'Кубики': 'Dice',
    'Монстры': 'Monsters',
};

export const RU_TO_EN_SOUNDS: Record<string, string> = {
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

export const DEFAULT_SFX_PLAYLISTS: DefaultSfxPlaylistDef[] = [
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

export async function ensureDefaultSfxPlaylists(userId: string, soundsDir: string): Promise<void> {
    // One-time migration of any legacy Russian default playlists
    const oldPls = await prisma.sfxPlaylist.findMany({
        where: { ownerId: userId, name: { in: ['Бой', 'Магия', 'Окружение', 'Кубики', 'Монстры'] } }
    });

    if (oldPls.length > 0) {
        for (const oldPl of oldPls) {
            if (RU_TO_EN_PLAYLISTS[oldPl.name]) {
                await prisma.sfxPlaylist.update({
                    where: { id: oldPl.id },
                    data: { name: RU_TO_EN_PLAYLISTS[oldPl.name] }
                });
            }
        }

        for (const [filename, enTitle] of Object.entries(RU_TO_EN_SOUNDS)) {
            await prisma.sfxSound.updateMany({
                where: { ownerId: userId, filename },
                data: { title: enTitle }
            });
        }
    }

    for (const item of DEFAULT_SFX_PLAYLISTS) {
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
            const defaultFilePath = path.join(soundsDir, 'default_sfx', s.filename);
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
}
