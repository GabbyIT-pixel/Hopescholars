'use strict';
const v = require('./validate');
const { match } = require('./matching');
const sec = require('./security');

const getProfile = (db, userId) => db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);

const profileComplete = (p) => !!(p && p.education_level && p.field_of_study && p.country && p.financial_need);

function interestFields(db, userId) {
  return db.prepare(`SELECT DISTINCT s.field_of_study f FROM saved sv JOIN scholarships s ON s.id = sv.scholarship_id
    WHERE sv.user_id = ? AND s.field_of_study != 'Any'`).all(userId).map((r) => r.f);
}

/** Public search over verified, still-open scholarships (FR 3.1, 3.2). Parameterised queries only. */
function searchScholarships(db, f, page, pageSize) {
  const where = ["status = 'verified'", 'deadline >= @today'];
  const p = { today: v.today() };
  if (f.q) {
    where.push("(title LIKE @q ESCAPE '\\' OR provider LIKE @q ESCAPE '\\' OR description LIKE @q ESCAPE '\\')");
    p.q = '%' + f.q.replace(/[\\%_]/g, '\\$&') + '%';
  }
  if (f.field) { where.push("(field_of_study = @field OR field_of_study = 'Any')"); p.field = f.field; }
  if (f.level) { where.push("(education_level = @level OR education_level = 'Any')"); p.level = f.level; }
  if (f.country) { where.push("(country = @country OR country = 'Any')"); p.country = f.country; }
  if (f.need) where.push('need_based = 1');
  if (f.within) {
    where.push('deadline <= @limit');
    p.limit = new Date(Date.now() + f.within * 86400e3).toISOString().slice(0, 10);
  }
  const order = f.sort === 'newest' ? 'created_at DESC' : 'deadline ASC';
  const total = db.prepare(`SELECT COUNT(*) c FROM scholarships WHERE ${where.join(' AND ')}`).get(p).c;
  const rows = db.prepare(`SELECT * FROM scholarships WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT @lim OFFSET @off`)
    .all({ ...p, lim: pageSize, off: (page - 1) * pageSize });
  return { rows, total };
}

/** Top matches for a student (FR 4.1, 4.2): profile + interaction history. */
function recommendations(db, userId, limit = 6) {
  const profile = getProfile(db, userId);
  if (!profileComplete(profile)) return [];
  const fields = interestFields(db, userId);
  const rows = db.prepare(`SELECT s.* FROM scholarships s WHERE s.status = 'verified' AND s.deadline >= ?
    AND s.id NOT IN (SELECT scholarship_id FROM applications WHERE user_id = ?)`).all(v.today(), userId);
  return rows.map((s) => ({ s, m: match(profile, s, fields) }))
    .filter((r) => r.m.score >= 50)
    .sort((a, b) => b.m.score - a.m.score || a.s.deadline.localeCompare(b.s.deadline))
    .slice(0, limit);
}

/** Deadline reminders (FR 5.2): create an in-app notification once per saved scholarship. */
function runReminders(db) {
  const rows = db.prepare(`SELECT sv.user_id, sv.scholarship_id, sv.remind_days, s.title, s.deadline FROM saved sv
    JOIN scholarships s ON s.id = sv.scholarship_id
    WHERE sv.reminder_sent = 0 AND s.status = 'verified' AND s.deadline >= ?`).all(v.today());
  const ins = db.prepare('INSERT INTO notifications (user_id, message, link, created_at) VALUES (?,?,?,?)');
  const mark = db.prepare('UPDATE saved SET reminder_sent = 1 WHERE user_id = ? AND scholarship_id = ?');
  let n = 0;
  db.transaction(() => {
    for (const r of rows) {
      const d = v.daysUntil(r.deadline);
      if (d <= r.remind_days) {
        ins.run(r.user_id, `Reminder: "${r.title}" closes ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`} (${r.deadline}).`, `/scholarships/${r.scholarship_id}`, sec.now());
        mark.run(r.user_id, r.scholarship_id);
        n++;
      }
    }
  })();
  return n;
}

function cleanup(db) {
  const t = sec.now();
  db.prepare('DELETE FROM sessions WHERE last_seen < ?').run(t - 12 * 3600e3);
  db.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used = 1').run(t - 24 * 3600e3);
}

module.exports = { getProfile, profileComplete, searchScholarships, recommendations, runReminders, cleanup, interestFields };
