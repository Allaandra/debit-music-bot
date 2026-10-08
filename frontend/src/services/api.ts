export const BASE_URL = `http://${window.location.hostname}:3001/api`;

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
        await fetchAuth(`${BASE_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
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
        await fetchAuth(`${BASE_URL}/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: track.query,
                type: track.type,
                playlistId,
                playlistName
            })
        });
    },

    async uploadFile(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        await fetchAuth(`${BASE_URL}/upload`, { method: 'POST', body: formData });
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
    }
};
