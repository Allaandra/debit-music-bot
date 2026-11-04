import axios from 'axios';

export const BACKEND_ORIGIN = window.location.origin;

export const BASE_URL = `${BACKEND_ORIGIN}/api`;
export const SOCKET_URL = BACKEND_ORIGIN;

export function resolveMediaUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
    return url;
}

export const apiClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true
});

export function getApiErrorMessage(error: unknown, fallback: string = 'Произошла ошибка'): string {
    if (axios.isAxiosError(error)) {
        return (
            (error.response?.data as any)?.error ||
            (error.response?.data as any)?.message ||
            error.message ||
            fallback
        );
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}

export const api = {
    async fetchMe() {
        try {
            const res = await apiClient.get('/auth/me');
            return res.data;
        } catch {
            return null;
        }
    },

    async fetchTracks(playlistId: number | null) {
        try {
            const url = playlistId ? `/playlists/${playlistId}/tracks` : '/tracks';
            const res = await apiClient.get(url);
            return Array.isArray(res.data) ? res.data : [];
        } catch {
            return [];
        }
    },

    async fetchPlaylists() {
        try {
            const res = await apiClient.get('/playlists');
            return Array.isArray(res.data) ? res.data : [];
        } catch {
            return [];
        }
    },

    async fetchStatus() {
        try {
            const res = await apiClient.get('/status');
            return res.data;
        } catch {
            return null;
        }
    },

    async checkTrackInPlaylists(trackId: number, playlists: any[]) {
        return Promise.all(
            playlists.map(pl =>
                apiClient
                    .get(`/playlists/${pl.id}/tracks`)
                    .then(res => (Array.isArray(res.data) && res.data.some((t: any) => t.id === trackId) ? pl.name : null))
                    .catch(() => null)
            )
        ).then(results => results.filter(Boolean) as string[]);
    },

    async action(action: string, payload?: any) {
        try {
            const res = await apiClient.post('/action', { action, payload });
            return res.data;
        } catch {
            return null;
        }
    },

    async addTrack(query: string, type: 'url' | 'local' = 'url') {
        const res = await apiClient.post('/tracks', { query, type });
        return res.data;
    },

    async importPlaylist(query: string, createPlaylist: boolean, playlistName: string) {
        const res = await apiClient.post('/tracks/import_playlist', { query, createPlaylist, playlistName });
        return res.data;
    },

    async deleteTrackCompletely(trackId: number) {
        await apiClient.delete(`/tracks/${trackId}`);
    },

    async deleteTrackFromPlaylist(playlistId: number, trackId: number) {
        await apiClient.delete(`/playlists/${playlistId}/tracks/${trackId}`);
    },

    async playTrack(track: any, playlistId: number | null, playlistName: string) {
        try {
            const res = await apiClient.post('/play', {
                query: track.query,
                type: track.type,
                playlistId,
                playlistName
            });
            return res.data;
        } catch {
            return null;
        }
    },

    async uploadFile(file: File, playlistId?: number) {
        const formData = new FormData();
        formData.append('file', file);
        if (playlistId) formData.append('playlistId', playlistId.toString());
        const res = await apiClient.post('/upload', formData);
        return res.data;
    },

    async uploadFiles(files: File[], playlistId?: number) {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        if (playlistId) formData.append('playlistId', playlistId.toString());
        const res = await apiClient.post('/upload', formData);
        return res.data;
    },

    async uploadSfxBatch(files: File[], playlistId: number, isGlobal: boolean = false) {
        const formData = new FormData();
        files.forEach(f => formData.append('sounds', f));
        formData.append('playlistId', playlistId.toString());
        if (isGlobal) formData.append('isGlobal', 'true');
        const res = await apiClient.post('/sfx/upload', formData);
        return res.data;
    },

    async syncSounds() {
        try {
            const res = await apiClient.post('/sounds/sync');
            return res.data;
        } catch {
            return null;
        }
    },

    async createPlaylist(name: string) {
        const res = await apiClient.post('/playlists', { name });
        return res.data;
    },

    async addTrackToPlaylist(playlistId: number, trackId: number) {
        const res = await apiClient.post(`/playlists/${playlistId}/tracks`, { trackId });
        return res.data;
    },

    async fetchSfxPlaylists() {
        try {
            const res = await apiClient.get('/sfx/playlists');
            return Array.isArray(res.data) ? res.data : [];
        } catch {
            return [];
        }
    },

    async createSfxPlaylist(name: string, icon?: string) {
        const res = await apiClient.post('/sfx/playlists', { name, icon });
        return res.data;
    },

    async deleteSfxPlaylist(id: number) {
        await apiClient.delete(`/sfx/playlists/${id}`);
    },

    async uploadSfx(file: File, playlistId: number, title?: string, isGlobal: boolean = false) {
        const formData = new FormData();
        formData.append('sound', file);
        formData.append('playlistId', playlistId.toString());
        if (title) formData.append('title', title);
        if (isGlobal) formData.append('isGlobal', 'true');
        const res = await apiClient.post('/sfx/upload', formData);
        return res.data;
    },

    async toggleSfxGlobal(id: number) {
        const res = await apiClient.patch(`/sfx/sounds/${id}/toggle-global`);
        return res.data;
    },

    async deleteSfxSound(id: number) {
        await apiClient.delete(`/sfx/sounds/${id}`);
    },

    async playSfx(soundId: number, volume: number = 1.0, loop: boolean = false) {
        const res = await apiClient.post('/sfx/play', { soundId, volume, loop });
        return res.data;
    },

    async stopSfxLoop(soundId: number) {
        const res = await apiClient.post('/sfx/loop/stop', { soundId });
        return res.data;
    },

    getSfxAudioUrl(soundId: number) {
        return `${BASE_URL}/sfx/audio/${soundId}`;
    },

    async logout() {
        await apiClient.post('/auth/logout');
    },

    async deletePlaylist(playlistId: number, deleteTracks: boolean) {
        await apiClient.delete(`/playlists/${playlistId}`, {
            params: { deleteTracks }
        });
    },

    async editPlaylist(playlistId: number, data: { name?: string; icon?: string }) {
        const res = await apiClient.put(`/playlists/${playlistId}`, data);
        return res.data;
    },

    async checkTrackInPlaylistsSingle(playlistId: number, trackId: number): Promise<boolean> {
        try {
            const res = await apiClient.get(`/playlists/${playlistId}/tracks`);
            const tracks: any[] = res.data;
            return Array.isArray(tracks) && tracks.some((t: any) => t.id === trackId);
        } catch {
            return false;
        }
    }
};
