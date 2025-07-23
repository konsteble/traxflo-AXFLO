require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

const DB_PATH = path.resolve(__dirname, 'database', 'tracks.db');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX, (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
    process.exit(1);
  }
  console.log('✅ Подключение к SQLite установлено');
});

db.configure("busyTimeout", 5000);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT DEFAULT 'Unknown',
      filePath TEXT NOT NULL UNIQUE,
      fileHash TEXT UNIQUE,
      duration INTEGER,
      uploadDate DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы:', err.message);
    } else {
      console.log('✅ Таблица tracks готова');
    }
  });
});

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function setupDirectories() {
  const requiredDirs = [
    path.join(__dirname, 'database'),
    path.join(__dirname, 'public', 'tracks')
  ];

  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📂 Создана директория: ${dir}`);
    }
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'tracks');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^\w]/g, '_');
    cb(null, `${Date.now()}-${name}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/aac'];
    if (audioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'), false);
    }
  }
});

app.get('/api/health', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM tracks", (err, row) => {
    if (err) {
      return res.status(500).json({ status: 'unhealthy', error: err.message });
    }
    res.json({
      status: 'healthy',
      trackCount: row.count
    });
  });
});

app.get('/api/tracks', (req, res) => {
  db.all(`
    SELECT *, 
    '/api/stream/' || id as streamUrl
    FROM tracks
  `, [], (err, rows) => {
    if (err) {
      console.error('❌ Ошибка запроса треков:', err.message);
      return res.status(500).json({ error: 'Database query error' });
    }

    const verifiedTracks = rows.map(track => ({
      ...track,
      fileExists: fs.existsSync(path.join(__dirname, 'public', track.filePath))
    }));

    res.json({ 
      success: true,
      tracks: verifiedTracks
    });
  });
});

app.post('/api/upload', upload.single('track'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const { title, artist = 'Unknown' } = req.body;

  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Название трека обязательно' });
  }

  const fileBuffer = fs.readFileSync(req.file.path);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const filePath = `/tracks/${path.basename(req.file.path)}`;

  db.get("SELECT id FROM tracks WHERE fileHash = ?", [fileHash], (err, row) => {
    if (err) {
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Ошибка базы данных' });
    }
    
    if (row) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({ error: 'Такой трек уже существует' });
    }

    db.run(
      "INSERT INTO tracks (title, artist, filePath, fileHash) VALUES (?, ?, ?, ?)",
      [title, artist, filePath, fileHash],
      function(err) {
        if (err) {
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Ошибка сохранения в базу данных' });
        }
        
        res.json({ 
          success: true,
          track: {
            id: this.lastID,
            title,
            artist,
            filePath,
            streamUrl: `/api/stream/${this.lastID}`
          }
        });
      }
    );
  });
});

app.get('/api/stream/:id', (req, res) => {
  const trackId = parseInt(req.params.id);

  db.get("SELECT filePath FROM tracks WHERE id = ?", [trackId], (err, track) => {
    if (err || !track) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    const filePath = path.join(__dirname, 'public', track.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Аудиофайл не найден' });
    }

    res.sendFile(filePath);
  });
});

app.delete('/api/tracks/:id', (req, res) => {
  const trackId = parseInt(req.params.id);

  db.get("SELECT filePath FROM tracks WHERE id = ?", [trackId], (err, track) => {
    if (err || !track) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    db.run("DELETE FROM tracks WHERE id = ?", [trackId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка удаления' });
      }

      const filePath = path.join(__dirname, 'public', track.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.json({ success: true });
    });
  });
});

setupDirectories();

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Путь к базе данных: ${DB_PATH}`);
  
  db.get("SELECT COUNT(*) as count FROM tracks", (err, row) => {
    if (err) {
      console.error('❌ Ошибка проверки базы данных:', err.message);
    } else {
      console.log(`✅ База данных готова, треков: ${row.count}`);
    }
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Остановка сервера...');
  db.close((err) => {
    if (err) console.error('⚠ Ошибка при закрытии БД:', err.message);
    process.exit(0);
  });
});