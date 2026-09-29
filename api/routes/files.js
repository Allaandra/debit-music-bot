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
exports.default = filesRoutes;
const express_1 = require("express");
const database_1 = require("../../database");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
function filesRoutes() {
    const router = (0, express_1.Router)();
    const storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const dir = path_1.default.join(__dirname, '../..', 'sounds');
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir);
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    });
    const upload = (0, multer_1.default)({ storage });
    // Функция синхронизации папки sounds и БД
    async function syncSounds() {
        try {
            const db = await (0, database_1.openDb)();
            const dir = path_1.default.join(__dirname, '../..', 'sounds');
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir);
            const files = fs_1.default.readdirSync(dir).filter((f) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
            const mm = await Promise.resolve().then(() => __importStar(require('music-metadata')));
            for (const file of files) {
                const existing = await db.get('SELECT id FROM tracks WHERE type = ? AND query = ? AND owner_id = ?', ['local', file, '450362999073406977']);
                if (!existing) {
                    let duration = 0;
                    let title = file;
                    let artist = 'Локальный файл';
                    try {
                        const metadata = await mm.parseFile(path_1.default.join(dir, file));
                        if (metadata.format.duration)
                            duration = Math.round(metadata.format.duration);
                        if (metadata.common.title)
                            title = metadata.common.title;
                        if (metadata.common.artist)
                            artist = metadata.common.artist;
                    }
                    catch (e) {
                        console.error('Failed to parse metadata for', file);
                    }
                    await db.run('INSERT INTO tracks (title, artist, type, query, duration, owner_id) VALUES (?, ?, ?, ?, ?, ?)', [title, artist, 'local', file, duration, '450362999073406977']);
                }
            }
        }
        catch (e) {
            console.error('Ошибка синхронизации звуков:', e);
        }
    }
    // Запускаем синхронизацию при старте и раз в 5 минут
    syncSounds();
    setInterval(syncSounds, 5 * 60 * 1000);
    router.post('/upload', upload.single('file'), async (req, res) => {
        if (!req.file)
            return res.status(400).json({ error: 'Файл не найден' });
        await syncSounds();
        res.json({ status: 'success', file: req.file.originalname });
    });
    router.get('/sounds', async (req, res) => {
        const soundsDir = path_1.default.join(__dirname, '../..', 'sounds');
        try {
            if (!fs_1.default.existsSync(soundsDir))
                fs_1.default.mkdirSync(soundsDir);
            const files = fs_1.default.readdirSync(soundsDir).filter((f) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
            res.json({ files });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
