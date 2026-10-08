import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

// Функция для подключения к БД и автоматического создания таблиц
export async function openDb(): Promise<Database> {
    if (dbInstance) return dbInstance;

    const db = await open({
        filename: path.join(__dirname, '..', 'database.sqlite'),
        driver: sqlite3.Database
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
            thumbnail TEXT, -- ссылка на обложку
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
    } catch {}
    try {
        await db.exec(`ALTER TABLE playlists ADD COLUMN owner_id TEXT NOT NULL DEFAULT '450362999073406977'`);
    } catch {}
    try {
        await db.exec(`ALTER TABLE tracks ADD COLUMN thumbnail TEXT`);
    } catch {}

    dbInstance = db;
    return dbInstance;
}