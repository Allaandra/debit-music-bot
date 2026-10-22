import { Command } from '../types';

export const command: Command = {
    name: '!ping',
    execute: async (message) => {
        const wsPing = Math.round(message.client.ws.ping);
        const latency = Date.now() - message.createdTimestamp;

        await message.reply(
            `🏓 **Понг!**\n` +
            `• Задержка сообщений: \`${latency} ms\`\n` +
            `• Discord WebSocket: \`${wsPing >= 0 ? wsPing : 0} ms\``
        );
    }
};
