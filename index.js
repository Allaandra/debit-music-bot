"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./api/server");
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
require("dotenv/config");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildVoiceStates
    ]
});
client.commands = new discord_js_1.Collection();
const commandsPath = path_1.default.join(__dirname, 'commands');
const commandFiles = fs_1.default.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
for (const file of commandFiles) {
    const filePath = path_1.default.join(commandsPath, file);
    const { command } = require(filePath);
    client.commands.set(command.name, command);
}
client.once('clientReady', () => {
    console.log(`Бот в сети. Авторизован как ${client.user?.tag}`);
});
const database_1 = require("./database");
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;
    const guildId = newState.guild.id;
    try {
        const db = await (0, database_1.openDb)();
        // Если зашел в канал или перешел в другой
        if (newState.channelId) {
            await db.run(`INSERT INTO active_sessions (userId, guildId, channelId) 
                 VALUES (?, ?, ?)
                 ON CONFLICT(userId) DO UPDATE SET 
                 guildId = excluded.guildId, 
                 channelId = excluded.channelId`, [userId, guildId, newState.channelId]);
        }
        // Если вышел из канала
        else if (!newState.channelId && oldState.channelId) {
            await db.run('DELETE FROM active_sessions WHERE userId = ?', [userId]);
        }
    }
    catch (e) {
        console.error('Ошибка при обновлении голосовой сессии:', e);
    }
});
client.on('messageCreate', (message) => {
    if (message.author.bot)
        return;
    if (message.content === '!ping') {
        message.reply('Pong!');
    }
    const command = client.commands.get(message.content);
    if (!command)
        return;
    try {
        command.execute(message);
    }
    catch (error) {
        console.error(error);
        message.reply('Произошла критическая ошибка при выполнении команды');
    }
});
(0, server_1.startApi)(client);
client.login(process.env.DISCORD_TOKEN);
