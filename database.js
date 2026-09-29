"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openDb = openDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
// Функция для подключения к БД и автоматического создания таблиц
async function openDb() {
    const db = await (0, sqlite_1.open)({
        filename: path_1.default.join(__dirname, 'database.sqlite'),
        driver: sqlite3_1.default.Database
    });
    // Создаем таблицу сессий для нашей изоляции
    await db.exec(`
        CREATE TABLE IF NOT EXISTS active_sessions (
            userId TEXT PRIMARY KEY,
            guildId TEXT NOT NULL,
            channelId TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id TEXT NOT NULL DEFAULT '450362999073406977',
            title TEXT NOT NULL,
            artist TEXT,
            type TEXT NOT NULL, -- 'local' или 'url'
            query TEXT NOT NULL, -- путь к файлу или URL
            duration INTEGER, -- в секундах
            addedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id TEXT NOT NULL DEFAULT '450362999073406977',
            name TEXT NOT NULL,
            icon TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id INTEGER,
            track_id INTEGER,
            position INTEGER, -- Порядок треков в плейлисте
            FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE,
            PRIMARY KEY(playlist_id, track_id)
        );
    `);
    // Миграции для старых БД
    try {
        await db.exec(`ALTER TABLE tracks ADD COLUMN owner_id TEXT NOT NULL DEFAULT '450362999073406977'`);
    }
    catch { }
    try {
        await db.exec(`ALTER TABLE playlists ADD COLUMN owner_id TEXT NOT NULL DEFAULT '450362999073406977'`);
    }
    catch { }
    return db;
}
