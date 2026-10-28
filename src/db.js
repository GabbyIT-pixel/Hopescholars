'use strict';
// Built-in SQLite (Node 22.5+): no native compile step, so it installs on Windows, Mac, Linux and Render.
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','provider','admin')),
  active INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  education_level TEXT,
  field_of_study TEXT,
  country TEXT,
  location TEXT,
  financial_need TEXT,
  academic_standing TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  flash TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  eligibility TEXT NOT NULL,
  education_level TEXT NOT NULL DEFAULT 'Any',
  field_of_study TEXT NOT NULL DEFAULT 'Any',
  country TEXT NOT NULL DEFAULT 'Any',
  need_based INTEGER NOT NULL DEFAULT 0,
  award_value TEXT,
  deadline TEXT NOT NULL,
  application_url TEXT NOT NULL,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','inactive')),
  reject_reason TEXT,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sch_status_deadline ON scholarships(status, deadline);

CREATE TABLE IF NOT EXISTS saved (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  remind_days INTEGER NOT NULL DEFAULT 7,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  saved_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, scholarship_id)
);

CREATE TABLE IF NOT EXISTS applications (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scholarship_id INTEGER NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, scholarship_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor_id INTEGER,
  actor_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  ip TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);
`;

function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  // db.transaction(fn) -> function that runs fn atomically (BEGIN / COMMIT / ROLLBACK)
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  return db;
}

module.exports = { openDb };
