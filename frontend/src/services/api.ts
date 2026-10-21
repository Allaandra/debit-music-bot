export const BASE_URL = `http://${window.location.hostname}:3001/api`;
export const SOCKET_URL = `http://${window.location.hostname}:3001`;

// Use a wrapper to automatically include credentials
const fetchAuth = (url: string, options: RequestInit = {}) => {
    return fetch(url, { ...options, credentials: 'include' });
};

export const api = {
    async fetchMe() {
        const res = await fetchAuth(`${BASE_URL}/auth/me`);
        return res.ok ? await res.json() : null;
    },

    async fetchTracks(playlistId: number | null) {
        let url = `${BASE_URL}/tracks`;
        if (playlistId) {
            url = `${BASE_URL}/playlists/${playlistId}/tracks`;
        }
        const res = await fetchAuth(url);
        return res.ok ? await res.json() : [];
    },

    async fetchPlaylists() {
        const res = await fetchAuth(`${BASE_URL}/playlists`);
        return res.ok ? await res.json() : [];
    },

    async fetchStatus() {
        const res = await fetchAuth(`${BASE_URL}/status`);
        return res.ok ? await res.json() : null;
    },

    async checkTrackInPlaylists(trackId: number, playlists: any[]) {
        return Promise.all(
            playlists.map(pl =>
                fetchAuth(`${BASE_URL}/playlists/${pl.id}/tracks`)
                    .then(r => r.json())
                    .then((tracks: any[]) => tracks.some((t: any) => t.id === trackId) ? pl.name : null)
                    .catch(() => null)
            )
        ).then(results => results.filter(Boolean) as string[]);
    },

    async action(action: string, payload?: any) {
        const res = await fetchAuth(`${BASE_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        return res.ok ? await res.json() : null;
    },

    async addTrack(query: string, type: 'url' | 'local' = 'url') {
        const res = await fetchAuth(`${BASE_URL}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, type })
        });
        return await res.json();
    },

    async importPlaylist(query: string, createPlaylist: boolean, playlistName: string) {
        await fetchAuth(`${BASE_URL}/tracks/import_playlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, createPlaylist, playlistName })
        });
    },

    async deleteTrackCompletely(trackId: number) {
        await fetchAuth(`${BASE_URL}/tracks/${trackId}`, { method: 'DELETE' });
    },

    async deleteTrackFromPlaylist(playlistId: number, trackId: number) {
        await fetchAuth(`${BASE_URL}/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
    },

    async playTrack(track: any, playlistId: number | null, playlistName: string) {
        const res = await fetchAuth(`${BASE_URL}/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: track.query,
                type: track.type,
                playlistId,
                playlistName
            })
        });
        return res.ok ? await res.json() : null;
    },

    async uploadFile(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        await fetchAuth(`${BASE_URL}/upload`, { method: 'POST', body: formData });
    },

    async syncSounds() {
        const res = await fetchAuth(`${BASE_URL}/sounds/sync`, { method: 'POST' });
        return res.ok ? await res.json() : null;
    },

    async createPlaylist(name: string) {
        await fetchAuth(`${BASE_URL}/playlists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
    },

    async addTrackToPlaylist(playlistId: number, trackId: number) {
        await fetchAuth(`${BASE_URL}/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackId })
        });
    },

    async fetchSfxPlaylists() {
        const res = await fetchAuth(`${BASE_URL}/sfx/playlists`);
        return res.ok ? await res.json() : [];
    },

    async createSfxPlaylist(name: string, icon?: string) {
        const res = await fetchAuth(`${BASE_URL}/sfx/playlists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon })
        });
        return await res.json();
    },

    async deleteSfxPlaylist(id: number) {
        await fetchAuth(`${BASE_URL}/sfx/playlists/${id}`, { method: 'DELETE' });
    },

    async uploadSfx(file: File, playlistId: number, title?: string, isGlobal: boolean = false) {
        const formData = new FormData();
        formData.append('sound', file);
        formData.append('playlistId', playlistId.toString());
        if (title) formData.append('title', title);
        if (isGlobal) formData.append('isGlobal', 'true');
        const res = await fetchAuth(`${BASE_URL}/sfx/upload`, {
            method: 'POST',
            body: formData
        });
        return await res.json();
    },

    async toggleSfxGlobal(id: number) {
        const res = await fetchAuth(`${BASE_URL}/sfx/sounds/${id}/toggle-global`, {
            method: 'PATCH'
        });
        return await res.json();
    },

    async deleteSfxSound(id: number) {
        await fetchAuth(`${BASE_URL}/sfx/sounds/${id}`, { method: 'DELETE' });
    },

    async playSfx(soundId: number, volume: number = 1.0, loop: boolean = false) {
        const res = await fetchAuth(`${BASE_URL}/sfx/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ soundId, volume, loop })
        });
        return await res.json();
    },

    async stopSfxLoop(soundId: number) {
        const res = await fetchAuth(`${BASE_URL}/sfx/loop/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ soundId })
        });
        return await res.json();
    },

    getSfxAudioUrl(soundId: number) {
        return `${BASE_URL}/sfx/audio/${soundId}`;
    },

    async logout() {
        await fetchAuth(`${BASE_URL}/auth/logout`, { method: 'POST' });
    },

    async deletePlaylist(playlistId: number, deleteTracks: boolean) {
        await fetchAuth(`${BASE_URL}/playlists/${playlistId}?deleteTracks=${deleteTracks}`, { method: 'DELETE' });
    },

    async editPlaylist(playlistId: number, data: { name?: string; icon?: string }) {
        await fetchAuth(`${BASE_URL}/playlists/${playlistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async checkTrackInPlaylistsSingle(playlistId: number, trackId: number): Promise<boolean> {
        const res = await fetchAuth(`${BASE_URL}/playlists/${playlistId}/tracks`);
        if (!res.ok) return false;
        const tracks: any[] = await res.json();
        return tracks.some((t: any) => t.id === trackId);
    }
};

