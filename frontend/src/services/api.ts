export const BASE_URL = 'http://localhost:3001/api';
export const USER_ID = '450362999073406977';

export const api = {
    async fetchTracks(playlistId: number | null) {
        let url = `${BASE_URL}/tracks?userId=${USER_ID}`;
        if (playlistId) {
            url = `${BASE_URL}/playlists/${playlistId}/tracks?userId=${USER_ID}`;
        }
        const res = await fetch(url);
        return res.ok ? await res.json() : [];
    },

    async fetchPlaylists() {
        const res = await fetch(`${BASE_URL}/playlists`);
        return res.ok ? await res.json() : [];
    },

    async fetchStatus() {
        const res = await fetch(`${BASE_URL}/status?userId=${USER_ID}`);
        return res.ok ? await res.json() : null;
    },

    async checkTrackInPlaylists(trackId: number, playlists: any[]) {
        return Promise.all(
            playlists.map(pl =>
                fetch(`${BASE_URL}/playlists/${pl.id}/tracks`)
                    .then(r => r.json())
                    .then((tracks: any[]) => tracks.some((t: any) => t.id === trackId) ? pl.name : null)
                    .catch(() => null)
            )
        ).then(results => results.filter(Boolean) as string[]);
    },

    async action(action: string, payload?: any) {
        await fetch(`${BASE_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, action, payload })
        });
    },

    async addTrack(query: string, type: 'url' | 'local' = 'url') {
        const res = await fetch(`${BASE_URL}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, query, type })
        });
        return await res.json();
    },

    async importPlaylist(query: string, createPlaylist: boolean, playlistName: string) {
        await fetch(`${BASE_URL}/tracks/import_playlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, query, createPlaylist, playlistName })
        });
    },

    async deleteTrackCompletely(trackId: number) {
        await fetch(`${BASE_URL}/tracks/${trackId}?userId=${USER_ID}`, { method: 'DELETE' });
    },

    async deleteTrackFromPlaylist(playlistId: number, trackId: number) {
        await fetch(`${BASE_URL}/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
    },

    async playTrack(track: any, playlistId: number | null, playlistName: string) {
        await fetch(`${BASE_URL}/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
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
        await fetch(`${BASE_URL}/upload`, { method: 'POST', body: formData });
    },

    async createPlaylist(name: string) {
        await fetch(`${BASE_URL}/playlists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
    },

    async addTrackToPlaylist(playlistId: number, trackId: number) {
        await fetch(`${BASE_URL}/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackId })
        });
    }
};
