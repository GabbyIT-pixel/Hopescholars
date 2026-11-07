'use strict';
// Data backups (SRS NFR 11, NFR 19, section 5.3): consistent copies of the database, newest 7 kept.
const fs = require('node:fs');
const path = require('node:path');

const dirFor = (dbPath) => path.join(path.dirname(dbPath), 'backups');

function listBackups(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => /^hopescholar-[\d-]+\.db$/.test(f)).sort().reverse()
      .map((f) => { const st = fs.statSync(path.join(dir, f)); return { name: f, size: st.size, at: st.mtimeMs }; });
  } catch { return []; }
}

function backupNow(db, dir, keep = 7) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const file = path.join(dir, `hopescholar-${stamp}.db`);
  if (!fs.existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  for (const old of listBackups(dir).slice(keep)) fs.rmSync(path.join(dir, old.name), { force: true });
  return listBackups(dir).find((b) => file.endsWith(b.name));
}

module.exports = { dirFor, listBackups, backupNow };
