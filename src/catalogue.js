'use strict';
// The curated catalogue (data/scholarships.json) is the source of real programme data.
// Every record names its official page and when it was last checked. syncCatalogue() inserts new records and
// updates existing ones, so editing the JSON file and restarting (or `npm run import`) keeps the site current.
const fs = require('fs');
const path = require('path');
const v = require('./validate');
const sec = require('./security');

const FILE = path.join(__dirname, '..', 'data', 'scholarships.json');

function load(file = FILE) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw : raw.scholarships;
}

function check(r) {
  const errs = [];
  if (!r.title || !r.provider) errs.push('title/provider');
  if (!v.isHttpUrl(r.official_url) || !r.official_url.startsWith('https://')) errs.push('official_url must be https');
  if (!v.DEADLINE_TYPES.includes(r.deadline_type)) errs.push('deadline_type');
  if (r.deadline_type === 'fixed' && !v.isIsoDate(r.deadline || '')) errs.push('fixed deadline needs a date');
  if (r.deadline_type !== 'fixed' && !r.deadline_note) errs.push('deadline_note required when no fixed date');
  if (!v.isIsoDate(r.last_verified || '')) errs.push('last_verified');
  return errs;
}

function syncCatalogue(db, adminId, file = FILE) {
  const records = load(file);
  const t = sec.now();
  const find = db.prepare("SELECT id FROM scholarships WHERE origin = 'catalogue' AND application_url = ?");
  const ins = db.prepare(`INSERT INTO scholarships (title, provider, description, eligibility, education_level, field_of_study, country, need_based, award_value,
    deadline, deadline_type, deadline_note, application_url, source_url, instructions, eligible_countries, study_in, last_verified, origin, status, submitted_by, verified_by, created_at, updated_at)
    VALUES (@title,@provider,@description,@eligibility,@education_level,@field_of_study,@country,@need_based,@award_value,@deadline,@deadline_type,@deadline_note,
    @application_url,@source_url,@instructions,@eligible_countries,@study_in,@last_verified,'catalogue','verified',@admin,@admin,@t,@t)`);
  const upd = db.prepare(`UPDATE scholarships SET title=@title, provider=@provider, description=@description, eligibility=@eligibility, education_level=@education_level,
    field_of_study=@field_of_study, country=@country, need_based=@need_based, award_value=@award_value, deadline=@deadline, deadline_type=@deadline_type,
    deadline_note=@deadline_note, source_url=@source_url, instructions=@instructions, eligible_countries=@eligible_countries, study_in=@study_in, last_verified=@last_verified,
    status = CASE WHEN status = 'inactive' THEN 'verified' ELSE status END, updated_at=@t WHERE id=@id`);
  let added = 0; let updated = 0; const skipped = [];
  db.transaction(() => {
    for (const r of records) {
      const errs = check(r);
      if (errs.length) { skipped.push(`${r.title || '(no title)'}: ${errs.join(', ')}`); continue; }
      const row = {
        title: v.clean(r.title, 160), provider: v.clean(r.provider, 160), description: v.clean(r.description, 3000), eligibility: v.clean(r.eligibility, 2000),
        education_level: v.oneOf(r.education_level, ['Any', ...v.LEVELS], 'Any'), field_of_study: v.oneOf(r.field_of_study, v.FIELDS, 'Any'),
        country: v.oneOf(r.country, v.COUNTRIES, 'Any'), need_based: r.need_based ? 1 : 0, award_value: v.clean(r.award_value, 120),
        deadline: r.deadline_type === 'fixed' ? r.deadline : v.NO_DATE, deadline_type: r.deadline_type, deadline_note: v.clean(r.deadline_note, 300),
        application_url: r.official_url, source_url: v.isHttpUrl(r.source_url || '') ? r.source_url : r.official_url, instructions: v.clean(r.how_to_apply, 2000),
        eligible_countries: (r.eligible_countries || '').split(',').map((c) => c.trim()).filter((c) => v.COUNTRIES.includes(c)).join(','),
        study_in: String(r.study_in || '').split(',').map((c) => c.trim()).filter(Boolean).join(','),
        last_verified: r.last_verified, admin: adminId, t,
      };
      const ex = find.get(row.application_url);
      if (ex) { const { admin, application_url, ...u } = row; upd.run({ ...u, id: ex.id }); updated++; } else { ins.run(row); added++; }
    }
    // Records removed from the file are hidden (not deleted) so students' saved lists stay intact.
    const keep = new Set(records.map((r) => r.official_url));
    for (const r of db.prepare("SELECT id, application_url FROM scholarships WHERE origin = 'catalogue' AND status = 'verified'").all()) {
      if (!keep.has(r.application_url)) db.prepare("UPDATE scholarships SET status = 'inactive', updated_at = ? WHERE id = ?").run(t, r.id);
    }
    // Early demo versions shipped made-up "Sample:" listings. Real data only now.
    db.prepare("DELETE FROM scholarships WHERE title LIKE 'Sample:%' AND application_url LIKE 'https://example.org/%'").run();
  })();
  return { added, updated, skipped };
}

module.exports = { syncCatalogue, load, check, FILE };
