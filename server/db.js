'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(DATA_DIR, 'lineup.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS barbers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT UNIQUE NOT NULL,
    shop_name      TEXT NOT NULL,
    barber_name    TEXT NOT NULL,
    tagline        TEXT NOT NULL DEFAULT '',
    address        TEXT NOT NULL DEFAULT '',
    announcement   TEXT NOT NULL DEFAULT '',
    pin_hash       TEXT NOT NULL,
    slot_minutes   INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER NOT NULL DEFAULT 0,
    max_queue      INTEGER NOT NULL DEFAULT 25,
    is_open        INTEGER NOT NULL DEFAULT 1,
    paused_until   INTEGER,
    brand_image    TEXT,
    timezone       TEXT NOT NULL DEFAULT 'UTC',
    created_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS services (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    barber_id  INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    minutes    INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    barber_id        INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    token            TEXT UNIQUE NOT NULL,
    name             TEXT NOT NULL,
    named_by_client  INTEGER NOT NULL DEFAULT 0,
    service_name     TEXT NOT NULL,
    minutes          INTEGER NOT NULL,
    status           TEXT NOT NULL DEFAULT 'waiting',
    sort_key         REAL NOT NULL,
    source           TEXT NOT NULL DEFAULT 'qr',
    day              TEXT NOT NULL,
    created_at       INTEGER NOT NULL,
    called_at        INTEGER,
    finished_at      INTEGER
  );
  CREATE INDEX IF NOT EXISTS tickets_barber_status ON tickets(barber_id, status);
  CREATE INDEX IF NOT EXISTS tickets_barber_day ON tickets(barber_id, day);

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    barber_id  INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

// Tiny prepared-statement cache so hot paths don't re-prepare.
const cache = new Map();
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

module.exports = {
  db,
  DATA_DIR,
  UPLOAD_DIR,
  get: (sql, ...params) => stmt(sql).get(...params),
  all: (sql, ...params) => stmt(sql).all(...params),
  run: (sql, ...params) => stmt(sql).run(...params),
  transaction(fn) {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
};
