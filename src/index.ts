import 'dotenv/config';
import { startApi } from './api/server';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
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

client.once('clientReady', async () => {
    console.log(`Бот в сети. Авторизован как ${client.user?.tag}`);

    // Синхронизируем активные голосовые сессии пользователей, которые уже находятся в голосовых каналах при запуске бота
    try {
        for (const [guildId, guild] of client.guilds.cache) {
            for (const [memberId, voiceState] of guild.voiceStates.cache) {
                if (voiceState.channelId && !voiceState.member?.user.bot) {
                    await prisma.activeSession.upsert({
                        where: { userId: memberId },
                        update: { guildId, channelId: voiceState.channelId },
                        create: { userId: memberId, guildId, channelId: voiceState.channelId }
                    });
                }
            }
        }
    } catch (e) {
        console.error('Ошибка начальной синхронизации голосовых сессий:', e);
    }
});

import { prisma } from './database';
import { PlayerManager } from './services/PlayerService';

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

            // Если бот вышел из канала или был отключен
            if (userId === client.user?.id) {
                const guildPlayer = PlayerManager.getPlayer(guildId);
                guildPlayer.onBotDisconnected();
            }
        }
    } catch (e) {
        console.error('Ошибка при обновлении голосовой сессии:', e);
    }
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/\s+/);
    const commandName = args[0]?.toLowerCase();
    if (!commandName) return;

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        command.execute(message);
    } catch (error) {
        console.error(`Ошибка при выполнении команды ${commandName}:`, error);
        message.reply('Произошла критическая ошибка при выполнении команды');
    }
});

const apiServer = startApi(client);

client.login(process.env.DISCORD_TOKEN);

let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Shutdown] Получен сигнал ${signal}. Завершение работы бота...`);

    try {
        console.log('[Shutdown] Остановка активных плееров и FFmpeg процессов...');
        PlayerManager.stopAll();

        if (apiServer?.close) {
            console.log('[Shutdown] Остановка API сервера...');
            await apiServer.close();
        }

        console.log('[Shutdown] Отключение Discord клиента...');
        client.destroy();

        console.log('[Shutdown] Закрытие базы данных Prisma...');
        await prisma.$disconnect();

        console.log('[Shutdown] Все процессы корректно завершены.');
        process.exit(0);
    } catch (err) {
        console.error('[Shutdown] Ошибка при завершении:', err);
        process.exit(1);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
