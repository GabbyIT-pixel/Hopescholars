'use strict';
const config = require('./src/config');
const { openDb } = require('./src/db');
const { createApp } = require('./src/app');
const { seed } = require('./src/seed');
const svc = require('./src/services');

(async () => {
  const db = openDb(config.dbPath);
  // First run: create the admin account (and demo data when allowed) automatically.
  if (db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c === 0) await seed(db);

  const app = createApp(db);
  const tick = () => { try { svc.runReminders(db); svc.cleanup(db); } catch (e) { console.error('background job failed', e.message); } };
  tick();
  setInterval(tick, 60 * 60e3).unref();

  app.listen(config.port, () => console.log(`Hope Scholar running on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`));
})().catch((e) => { console.error(e.message); process.exit(1); });
