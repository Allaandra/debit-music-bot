import { Command } from '../types';

export const command: Command = {
    name: '!panel',
    execute: async (message) => {
        const port = process.env.PORT || 3001;
        await message.reply(
            `🎛️ **Веб-пульт управления звуком:**\n` +
            `• Локальный адрес: http://localhost:${port}\n` +
            `*(Если бот запущен на удаленном сервере или в локальной сети, используйте его локальный IP или домен)*`
        );
    }
};
