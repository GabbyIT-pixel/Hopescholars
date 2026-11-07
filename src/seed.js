'use strict';
/* Seeds the database. Run with: npm run seed
 * - Always creates the administrator (password from ADMIN_PASSWORD; required in production).
 * - Creates demo student/provider accounts and sample scholarships when SEED_DEMO=true (default outside production). */
const config = require('./config');
const sec = require('./security');
const { openDb } = require('./db');
const { syncCatalogue } = require('./catalogue');

const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
async function seed(db) {
  const t = sec.now();
  const adminPw = process.env.ADMIN_PASSWORD || (config.isProd ? null : 'Scholar#Hope2026');
  if (!adminPw) throw new Error('Set ADMIN_PASSWORD (at least 12 characters) before seeding in production.');
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@hopescholar.demo').toLowerCase();
  if (sec.passwordProblems(adminPw, adminEmail).length) throw new Error('ADMIN_PASSWORD is too weak: use 10+ characters with upper-case, lower-case and a number, and do not include your email name.');
  const upsertUser = db.prepare('INSERT OR IGNORE INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?,?,?)');
  upsertUser.run(adminEmail, 'Hope Scholar Admin', await sec.hashPassword(adminPw), 'admin', t);
  console.log(`Admin account ready: ${adminEmail}`);

  const adminId = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail).id;
  // Real programme data from the curated catalogue, in every environment.
  const cat = syncCatalogue(db, adminId);
  console.log(`Scholarship catalogue ready: ${cat.added} added, ${cat.updated} updated.`);
  for (const s of cat.skipped) console.warn('Catalogue record skipped:', s);

  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : !config.isProd;
  if (!demo) return;

  // Demo accounts so reviewers can try every role. They contain no real personal data.
  upsertUser.run('student@hopescholar.demo', 'Amina Uwase', await sec.hashPassword('Student#2026demo'), 'student', t);
  upsertUser.run('provider@hopescholar.demo', 'Demo Provider', await sec.hashPassword('Provider#2026demo'), 'provider', t);
  const student = db.prepare("SELECT id FROM users WHERE email = 'student@hopescholar.demo'").get().id;
  const provider = db.prepare("SELECT id FROM users WHERE email = 'provider@hopescholar.demo'").get().id;
  db.prepare(`INSERT OR IGNORE INTO profiles (user_id, education_level, field_of_study, country, location, financial_need, academic_standing, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(student, 'Undergraduate', 'Computer Science / IT', 'Rwanda', 'Kigali', 'High', 'Above average', t);
  // One pending submission so the admin review queue has something to show. It is never visible to students.
  if (!db.prepare("SELECT 1 FROM scholarships WHERE title LIKE 'Demo submission%'").get()) {
    db.prepare(`INSERT INTO scholarships (title, provider, description, eligibility, education_level, field_of_study, country, need_based, award_value, deadline,
      deadline_type, deadline_note, application_url, status, submitted_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)`)
      .run('Demo submission: community teachers award (not a real scholarship)', 'Demo Provider', 'Placeholder used only to show the administrator review queue. It is never visible to students.', 'Not applicable.', 'Undergraduate', 'Education', 'Any', 0, 'n/a', day(60),
        'fixed', null, 'https://example.org/demo-only', provider, t, t);
  }
  console.log('Demo accounts ready.');
}

module.exports = { seed };

if (require.main === module) {
  const db = openDb(config.dbPath);
  seed(db).then(() => console.log('Seed complete.')).catch((e) => { console.error(e.message); process.exit(1); });
}
