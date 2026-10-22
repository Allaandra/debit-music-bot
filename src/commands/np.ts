import { Command } from '../types';
import { PlayerManager } from '../services/PlayerService';

function formatSeconds(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function createProgressBar(current: number, total: number, size: number = 15): string {
    if (total <= 0) return '🔘' + '▬'.repeat(size - 1);
    const progress = Math.min(Math.max(current / total, 0), 1);
    const progressIndex = Math.round(progress * (size - 1));
    return '▬'.repeat(progressIndex) + '🔘' + '▬'.repeat(size - 1 - progressIndex);
}

export const command: Command = {
    name: '!np',
    execute: async (message) => {
        if (!message.guildId) return;

        const player = PlayerManager.getPlayer(message.guildId);
        const status = player.getStatus();

        if (!status.currentTrack || (!status.isPlaying && !status.isPaused)) {
            await message.reply('🔇 Сейчас ничего не воспроизводится.');
            return;
        }

        const track = status.currentTrack;
        const elapsed = status.elapsed;
        const duration = track.duration || 0;
        const bar = createProgressBar(elapsed, duration);
        const stateIcon = status.isPaused ? '⏸️ [Пауза]' : '▶️ [Играет]';

        const text = `🎵 **Сейчас играет:**\n` +
            `**${track.title}**\n` +
            `Исполнитель: *${track.artist || 'Неизвестно'}*\n` +
            `Статус: ${stateIcon}\n\n` +
            `\`${formatSeconds(elapsed)}\` ${bar} \`${duration > 0 ? formatSeconds(duration) : '∞'}\``;

        await message.reply(text);
    }
};
