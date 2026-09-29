"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tracksRoutes;
const express_1 = require("express");
const database_1 = require("../../database");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function tracksRoutes() {
    const router = (0, express_1.Router)();
    router.get('/', async (req, res) => {
        const { userId } = req.query;
        try {
            const db = await (0, database_1.openDb)();
            const tracks = await db.all('SELECT * FROM tracks WHERE owner_id = ? ORDER BY addedAt DESC', [userId || '450362999073406977']);
            res.json(tracks);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/', async (req, res) => {
        const { query, type, userId } = req.body;
        try {
            const playerManager = (await Promise.resolve().then(() => __importStar(require('../PlayerManager')))).PlayerManager;
            const guildPlayer = playerManager.getPlayer('default'); // Just for resolve
            const track = await guildPlayer.resolveTrack(type, query);
            const db = await (0, database_1.openDb)();
            const result = await db.run('INSERT INTO tracks (title, artist, type, query, duration, owner_id) VALUES (?, ?, ?, ?, ?, ?)', [track.title, track.artist, track.type, track.query, track.duration, userId || '450362999073406977']);
            res.json({ status: 'success', id: result.lastID, track });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.delete('/:id', async (req, res) => {
        const { userId } = req.query;
        try {
            const db = await (0, database_1.openDb)();
            const track = await db.get('SELECT * FROM tracks WHERE id = ? AND owner_id = ?', [req.params.id, userId || '450362999073406977']);
            if (!track)
                return res.status(404).json({ error: 'Трек не найден' });
            if (track.type === 'local') {
                const filePath = path_1.default.join(__dirname, '../..', 'sounds', track.query);
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                }
            }
            await db.run('DELETE FROM tracks WHERE id = ?', [req.params.id]);
            res.json({ status: 'success' });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
