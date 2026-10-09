import { startApi } from './api/server';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { Command } from './types';

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

declare module 'discord.js' {
    export interface Client {
        commands: Collection<string, Command>;
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const { command } = require(filePath);
    client.commands.set(command.name, command);
}

client.once('clientReady', () => {
    console.log(`Бот в сети. Авторизован как ${client.user?.tag}`);
});

import { prisma } from './database';

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;
    const guildId = newState.guild.id;

    try {
        // Если зашел в канал или перешел в другой
        if (newState.channelId) {
            await prisma.activeSession.upsert({
                where: { userId },
                update: {
                    guildId,
                    channelId: newState.channelId
                },
                create: {
                    userId,
                    guildId,
                    channelId: newState.channelId
                }
            });
        }
        // Если вышел из канала
        else if (!newState.channelId && oldState.channelId) {
            await prisma.activeSession.deleteMany({
                where: { userId }
            });
            
            // Если бот вышел из канала
            if (userId === client.user?.id) {
                const playerManager = (await import('./api/PlayerManager')).PlayerManager;
                const guildPlayer = playerManager.getPlayer(guildId);
                guildPlayer.stopCurrentProcesses();
                guildPlayer.player.stop();
                guildPlayer.queue = [];
                guildPlayer.originalQueue = [];
                guildPlayer.currentTrack = null;
                guildPlayer.isPlaying = false;
                guildPlayer.isPaused = false;
            }
        }
    } catch (e) {
        console.error('Ошибка при обновлении голосовой сессии:', e);
    }
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.reply('Pong!');
    }

    const command = client.commands.get(message.content);
    if (!command) return;

    try {
        command.execute(message);
    } catch (error) {
        console.error(error);
        message.reply('Произошла критическая ошибка при выполнении команды');
    }
});

startApi(client);

client.login(process.env.DISCORD_TOKEN);