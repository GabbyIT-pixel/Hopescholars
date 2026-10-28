'use strict';
/* Seeds the database. Run with: npm run seed
 * - Always creates the administrator (password from ADMIN_PASSWORD; required in production).
 * - Creates demo student/provider accounts and sample scholarships when SEED_DEMO=true (default outside production). */
const config = require('./config');
const sec = require('./security');
const { openDb } = require('./db');

const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const NOTE = ' Details on this page are a summary for demonstration; always confirm current eligibility and deadlines on the provider\'s official website.';

const REAL = [
  ['Mastercard Foundation Scholars Program', 'Mastercard Foundation and partner universities', 'Supports academically talented young people from Africa who face financial barriers, combining funding with leadership development and mentoring at partner institutions.' + NOTE, 'Talented students with financial need who show leadership potential; applications go through partner universities.', 'Undergraduate', 'Any', 'Any', 1, 'Tuition and support (varies by partner)', 45, 'https://mastercardfdn.org/all/scholars/'],
  ['Chevening Scholarships', 'UK Foreign, Commonwealth & Development Office', 'Fully funded one-year master\'s study in the United Kingdom for future leaders, with a global alumni network.' + NOTE, 'Citizens of eligible countries, an undergraduate degree, and at least two years\' work experience.', 'Postgraduate (Masters)', 'Any', 'Any', 0, 'Full funding', 70, 'https://www.chevening.org/'],
  ['DAAD Scholarships for Study in Germany', 'German Academic Exchange Service (DAAD)', 'A wide range of scholarships for graduate study and research in Germany across many fields.' + NOTE, 'Requirements differ by programme; most need a first degree and strong academic record.', 'Postgraduate (Masters)', 'Any', 'Any', 0, 'Monthly stipend and support', 95, 'https://www.daad.de/en/'],
  ['Commonwealth Scholarships', 'Commonwealth Scholarship Commission (UK)', 'Scholarships for students from Commonwealth countries to study in the UK, focused on development impact.' + NOTE, 'Citizens of eligible Commonwealth countries who cannot otherwise afford to study in the UK.', 'Postgraduate (Masters)', 'Any', 'Any', 1, 'Full funding', 120, 'https://cscuk.fcdo.gov.uk/scholarships/'],
  ['Fulbright Foreign Student Program', 'U.S. Department of State', 'Graduate study, research and teaching opportunities in the United States for students from around the world.' + NOTE, 'Strong academic record, English proficiency and leadership potential.', 'Postgraduate (Masters)', 'Any', 'Any', 0, 'Varies by programme', 150, 'https://foreign.fulbrightonline.org/'],
];
const SAMPLE = [
  ['Sample: Refugee Students Higher Education Fund', 'Sample Foundation (demo data)', 'A demonstration listing for refugee and displaced students pursuing a first degree. Covers tuition and a learning-materials allowance.', 'Refugee or displaced students with proof of admission to an accredited university.', 'Undergraduate', 'Any', 'Any', 1, 'Tuition + allowance', 5],
  ['Sample: East Africa Health Sciences Bursary', 'Sample Health Trust (demo data)', 'A demonstration bursary for students entering nursing, medicine or public health in East Africa.', 'Students from East Africa admitted to a health-sciences programme.', 'Undergraduate', 'Health & Medicine', 'Uganda', 1, 'USD 2,000 per year', 12],
  ['Sample: Women in Computing Scholarship', 'Sample Tech Initiative (demo data)', 'A demonstration scholarship that supports women studying computer science or information technology.', 'Women enrolled in or admitted to a computing programme.', 'Undergraduate', 'Computer Science / IT', 'Any', 0, 'USD 1,500', 21],
  ['Sample: Rwanda Rural Youth Agriculture Award', 'Sample Agri Fund (demo data)', 'A demonstration award for rural students in Rwanda studying agriculture, environment or related fields.', 'Rwandan students from rural districts studying agriculture or environment.', 'Undergraduate', 'Agriculture & Environment', 'Rwanda', 1, 'RWF 800,000', 33],
  ['Sample: Secondary School Merit Scholarship (Kenya)', 'Sample Education Trust (demo data)', 'A demonstration scholarship for high-performing secondary school students who cannot afford school fees.', 'Kenyan secondary students with strong grades and financial need.', 'Secondary school', 'Any', 'Kenya', 1, 'School fees covered', 40],
  ['Sample: Engineering Innovators Grant', 'Sample Engineering Society (demo data)', 'A demonstration grant for engineering students building a practical project that serves their community.', 'Engineering students with a project proposal.', 'Undergraduate', 'Engineering', 'Any', 0, 'USD 1,000', 58],
  ['Sample: Public Policy Fellows Scholarship', 'Sample Policy Institute (demo data)', 'A demonstration scholarship for postgraduate students in law, governance and public policy.', 'Postgraduate applicants with relevant experience.', 'Postgraduate (Masters)', 'Law & Public Policy', 'Any', 0, 'USD 5,000', 80],
];

async function seed(db) {
  const t = sec.now();
  const adminPw = process.env.ADMIN_PASSWORD || (config.isProd ? null : 'Scholar#Hope2026');
  if (!adminPw) throw new Error('Set ADMIN_PASSWORD (at least 12 characters) before seeding in production.');
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@hopescholar.demo').toLowerCase();
  if (sec.passwordProblems(adminPw, adminEmail).length) throw new Error('ADMIN_PASSWORD is too weak: use 10+ characters with upper-case, lower-case and a number, and do not include your email name.');
  const upsertUser = db.prepare('INSERT OR IGNORE INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?,?,?)');
  upsertUser.run(adminEmail, 'Hope Scholar Admin', await sec.hashPassword(adminPw), 'admin', t);
  console.log(`Admin account ready: ${adminEmail}`);

  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : !config.isProd;
  if (!demo) return;
  if (db.prepare('SELECT COUNT(*) c FROM scholarships').get().c > 0) { console.log('Scholarships already present, skipping demo data.'); return; }

  upsertUser.run('student@hopescholar.demo', 'Amina Uwase', await sec.hashPassword('Student#2026demo'), 'student', t);
  upsertUser.run('provider@hopescholar.demo', 'Demo Provider', await sec.hashPassword('Provider#2026demo'), 'provider', t);
  const student = db.prepare("SELECT id FROM users WHERE email = 'student@hopescholar.demo'").get().id;
  const provider = db.prepare("SELECT id FROM users WHERE email = 'provider@hopescholar.demo'").get().id;
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail).id;
  db.prepare(`INSERT OR IGNORE INTO profiles (user_id, education_level, field_of_study, country, location, financial_need, academic_standing, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(student, 'Undergraduate', 'Computer Science / IT', 'Rwanda', 'Kigali', 'High', 'Above average', t);

  const ins = db.prepare(`INSERT INTO scholarships (title, provider, description, eligibility, education_level, field_of_study, country, need_based, award_value,
    deadline, application_url, status, submitted_by, verified_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'verified',?,?,?,?)`);
  for (const r of REAL) ins.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], day(r[9]), r[10], admin, admin, t, t);
  for (const r of SAMPLE) ins.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], day(r[9]), 'https://example.org/hope-scholar-demo', admin, admin, t, t);
  // One pending submission so the admin verification queue has something to show.
  db.prepare(`INSERT INTO scholarships (title, provider, description, eligibility, education_level, field_of_study, country, need_based, award_value, deadline,
    application_url, status, submitted_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)`)
    .run('Sample: Community Teachers Scholarship', 'Demo Provider', 'A demonstration listing waiting for administrator verification so you can see the review queue in action.', 'Students training to become teachers.', 'Undergraduate', 'Education', 'Any', 0, 'USD 1,200', day(60), 'https://example.org/hope-scholar-demo', provider, t, t);
  console.log('Demo accounts and sample scholarships created.');
}

module.exports = { seed };

if (require.main === module) {
  const db = openDb(config.dbPath);
  seed(db).then(() => console.log('Seed complete.')).catch((e) => { console.error(e.message); process.exit(1); });
}
