'use strict';
// npm run import [file.json] : add or update scholarships from the curated catalogue file.
const config = require('../src/config');
const { openDb } = require('../src/db');
const { syncCatalogue, FILE } = require('../src/catalogue');

const db = openDb(config.dbPath);
const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
if (!admin) { console.error('No administrator account yet. Run `npm start` or `npm run seed` first.'); process.exit(1); }
const r = syncCatalogue(db, admin.id, process.argv[2] || FILE);
console.log(`Catalogue synced: ${r.added} added, ${r.updated} updated.`);
for (const s of r.skipped) console.log('SKIPPED', s);
