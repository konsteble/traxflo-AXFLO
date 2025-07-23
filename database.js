const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Пути к базам данных
const dbDir = path.join(__dirname, 'database');
const tracksDbPath = path.join(dbDir, 'tracks.db');
const xTokensDbPath = path.join(dbDir, 'x-tokens.db');

// Создаем папку если нет
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Инициализация БД треков
const tracksDb = new Database(tracksDbPath);
tracksDb.pragma('journal_mode = WAL');
tracksDb.pragma('foreign_keys = ON');

// Инициализация таблиц
tracksDb.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT 'Unknown',
    filePath TEXT NOT NULL UNIQUE,
    fileHash TEXT NOT NULL UNIQUE,
    uploadDate DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Инициализация БД токенов
const xTokensDb = new Database(xTokensDbPath);
xTokensDb.pragma('journal_mode = WAL');
xTokensDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    wallet TEXT PRIMARY KEY,
    x_balance INTEGER NOT NULL DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Закрытие соединений при завершении процесса
process.on('exit', () => {
  tracksDb.close();
  xTokensDb.close();
});

module.exports = {
  // Методы для треков
  getAllTracks() {
    try {
      const stmt = tracksDb.prepare(`
        SELECT id, title, artist, filePath 
        FROM tracks 
        ORDER BY uploadDate DESC
      `);
      return stmt.all().map(track => ({
        ...track,
        streamUrl: `/api/stream/${track.id}`
      }));
    } catch (err) {
      console.error('Database getAllTracks error:', err);
      throw new Error('Failed to get tracks');
    }
  },

  getTrackById(id) {
    try {
      const stmt = tracksDb.prepare('SELECT * FROM tracks WHERE id = ?');
      const track = stmt.get(id);
      if (!track) throw new Error('Track not found');
      return track;
    } catch (err) {
      console.error('Database getTrackById error:', err);
      throw err;
    }
  },

  getTrackByHash(hash) {
    try {
      return tracksDb.prepare('SELECT id FROM tracks WHERE fileHash = ?').get(hash);
    } catch (err) {
      console.error('Database getTrackByHash error:', err);
      throw new Error('Failed to check track hash');
    }
  },

  addTrack({ title, artist, filePath, fileHash }) {
    try {
      const stmt = tracksDb.prepare(`
        INSERT INTO tracks (title, artist, filePath, fileHash)
        VALUES (?, ?, ?, ?)
      `);
      const info = stmt.run(title, artist || 'Unknown', filePath, fileHash);
      return {
        id: info.lastInsertRowid,
        title,
        artist: artist || 'Unknown',
        filePath,
        streamUrl: `/api/stream/${info.lastInsertRowid}`
      };
    } catch (err) {
      console.error('Database addTrack error:', err);
      throw new Error('Failed to add track');
    }
  },

  deleteTrack(id) {
    try {
      const stmt = tracksDb.prepare('DELETE FROM tracks WHERE id = ?');
      const result = stmt.run(id);
      if (result.changes === 0) throw new Error('Track not found');
      return result;
    } catch (err) {
      console.error('Database deleteTrack error:', err);
      throw err;
    }
  },

  // Методы для токенов
  getXBalance(wallet) {
    try {
      const row = xTokensDb.prepare('SELECT x_balance FROM users WHERE wallet = ?').get(wallet);
      return row ? row.x_balance : 0;
    } catch (err) {
      console.error('Database getXBalance error:', err);
      throw new Error('Failed to get balance');
    }
  },

  updateXBalance(wallet, amount) {
    try {
      return xTokensDb.prepare(`
        INSERT INTO users (wallet, x_balance)
        VALUES (?, ?)
        ON CONFLICT(wallet) DO UPDATE SET 
          x_balance = x_balance + excluded.x_balance,
          last_updated = CURRENT_TIMESTAMP
      `).run(wallet, amount);
    } catch (err) {
      console.error('Database updateXBalance error:', err);
      throw new Error('Failed to update balance');
    }
  },

  // Для отладки
  debug() {
    return {
      tracksDb: {
        path: tracksDbPath,
        size: fs.existsSync(tracksDbPath) ? fs.statSync(tracksDbPath).size : 0,
        tables: tracksDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
      },
      xTokensDb: {
        path: xTokensDbPath,
        size: fs.existsSync(xTokensDbPath) ? fs.statSync(xTokensDbPath).size : 0,
        tables: xTokensDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
      }
    };
  }
};