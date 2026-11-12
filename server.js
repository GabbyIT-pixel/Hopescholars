'use strict';
const config = require('./src/config');
const { openDb } = require('./src/db');
const { createApp } = require('./src/app');
const { seed } = require('./src/seed');
const svc = require('./src/services');
const { syncCatalogue } = require('./src/catalogue');

(async () => {
  const db = openDb(config.dbPath);
  // First run: create the admin account (and demo data when allowed) automatically.
  if (db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c === 0) await seed(db);
  else {
    // Existing database: refresh the official-source catalogue on every start so edits to data/scholarships.json go live.
    const cat = syncCatalogue(db, db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get().id);
    console.log(`Scholarship catalogue synced: ${cat.added} added, ${cat.updated} updated.`);
  }

  const app = createApp(db);
  const tick = () => { try { svc.runReminders(db); svc.cleanup(db); } catch (e) { console.error('background job failed', e.message); } };
  const backup = require('./src/backup');
  const bdir = backup.dirFor(config.dbPath);
  const doBackup = () => { try { const last = backup.listBackups(bdir)[0]; if (!last || Date.now() - last.at > 23 * 3600e3) backup.backupNow(db, bdir); } catch (e) { console.error('backup failed', e.message); } };
  doBackup();
  setInterval(doBackup, 6 * 3600e3).unref();
  tick();
  setInterval(tick, 60 * 60e3).unref();

  app.listen(config.port, (err) => {
    // Express 5 passes startup errors (such as "port already in use") to this callback.
    if (err) {
      console.error(err.code === 'EADDRINUSE'
        ? `Port ${config.port} is already in use: an older copy of the app is still running. Close it (Windows: taskkill //F //IM node.exe) and start again.`
        : `Could not start the server: ${err.message}`);
      process.exit(1);
    }
    console.log(`Hope Scholar running on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`);
  });
})().catch((e) => { console.error(e.message); process.exit(1); });
