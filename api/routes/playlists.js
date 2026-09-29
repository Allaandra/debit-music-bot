"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = playlistsRoutes;
const express_1 = require("express");
const database_1 = require("../../database");
function playlistsRoutes() {
    const router = (0, express_1.Router)();
    router.get('/', async (req, res) => {
        const { userId } = req.query;
        try {
            const db = await (0, database_1.openDb)();
            const playlists = await db.all('SELECT * FROM playlists WHERE owner_id = ? ORDER BY createdAt DESC', [userId || '450362999073406977']);
            res.json(playlists);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/', async (req, res) => {
        const { name, userId } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Название обязательно' });
        try {
            const db = await (0, database_1.openDb)();
            const result = await db.run('INSERT INTO playlists (name, owner_id) VALUES (?, ?)', [name, userId || '450362999073406977']);
            res.json({ status: 'success', id: result.lastID });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/:id/tracks', async (req, res) => {
        const { trackId } = req.body;
        const playlistId = req.params.id;
        try {
            const db = await (0, database_1.openDb)();
            const maxPos = await db.get('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
            const pos = (maxPos?.maxPos || 0) + 1;
            await db.run('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [playlistId, trackId, pos]);
            res.json({ status: 'success' });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get('/:id/tracks', async (req, res) => {
        const playlistId = req.params.id;
        try {
            const db = await (0, database_1.openDb)();
            const tracks = await db.all(`
                SELECT t.*, pt.position 
                FROM tracks t
                JOIN playlist_tracks pt ON t.id = pt.track_id
                WHERE pt.playlist_id = ?
                ORDER BY pt.position ASC
            `, [playlistId]);
            res.json(tracks);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
