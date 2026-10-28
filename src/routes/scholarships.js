'use strict';
const express = require('express');
const config = require('../config');
const sec = require('../security');
const v = require('../validate');
const svc = require('../services');
const { match } = require('../matching');

const router = express.Router();

router.get('/scholarships', (req, res) => {
  const db = req.app.locals.db;
  const f = {
    q: v.clean(req.query.q, 80),
    field: v.oneOf(req.query.field, v.FIELDS.slice(1)),
    level: v.oneOf(req.query.level, v.LEVELS),
    country: v.oneOf(req.query.country, v.COUNTRIES.slice(1)),
    need: req.query.need === '1' ? '1' : '',
    within: [30, 60, 90].includes(Number(req.query.within)) ? Number(req.query.within) : 0,
    sort: req.query.sort === 'newest' ? 'newest' : 'deadline',
  };
  const page = Math.max(1, Math.min(500, parseInt(req.query.page, 10) || 1));
  const { rows, total } = svc.searchScholarships(db, f, page, config.pageSize);
  const profile = req.user && req.user.role === 'student' ? svc.getProfile(db, req.user.id) : null;
  const fields = profile ? svc.interestFields(db, req.user.id) : [];
  const items = rows.map((s) => ({ s, m: profile && svc.profileComplete(profile) ? match(profile, s, fields) : null }));
  const savedIds = req.user ? new Set(db.prepare('SELECT scholarship_id id FROM saved WHERE user_id = ?').all(req.user.id).map((r) => r.id)) : new Set();
  const qs = new URLSearchParams(Object.entries(f).filter(([, val]) => val)).toString();
  res.render('scholarships', { title: 'Find scholarships', items, total, f, page, pages: Math.max(1, Math.ceil(total / config.pageSize)), savedIds, qs });
});

router.get('/scholarships/:id', (req, res, next) => {
  const db = req.app.locals.db;
  const id = parseInt(req.params.id, 10);
  const s = Number.isInteger(id) ? db.prepare('SELECT * FROM scholarships WHERE id = ?').get(id) : null;
  // Unpublished listings are visible only to admins and the provider who submitted them (business rule 5.5).
  const canSeeDraft = req.user && (req.user.role === 'admin' || s && s.submitted_by === req.user.id);
  if (!s || (s.status !== 'verified' && !canSeeDraft)) return next();
  let m = null, saved = null, tracked = null;
  if (req.user && req.user.role === 'student') {
    const profile = svc.getProfile(db, req.user.id);
    if (svc.profileComplete(profile)) m = match(profile, s, svc.interestFields(db, req.user.id));
    saved = db.prepare('SELECT * FROM saved WHERE user_id = ? AND scholarship_id = ?').get(req.user.id, id);
    tracked = db.prepare('SELECT * FROM applications WHERE user_id = ? AND scholarship_id = ?').get(req.user.id, id);
  }
  res.render('scholarship', { title: s.title, s, m, saved, tracked, statuses: v.APP_STATUSES });
});

const studentOnly = [sec.requireLogin, sec.requireRole('student')];
const loadOpen = (req) => {
  const id = parseInt(req.params.id, 10);
  const s = Number.isInteger(id) ? req.app.locals.db.prepare("SELECT * FROM scholarships WHERE id = ? AND status = 'verified'").get(id) : null;
  return s;
};

router.post('/scholarships/:id/save', ...studentOnly, (req, res, next) => {
  const s = loadOpen(req); if (!s) return next();
  const db = req.app.locals.db;
  const days = [3, 7, 14, 30].includes(Number(req.body.remind_days)) ? Number(req.body.remind_days) : 7;
  db.prepare(`INSERT INTO saved (user_id, scholarship_id, remind_days, saved_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id, scholarship_id) DO UPDATE SET remind_days = excluded.remind_days, reminder_sent = 0`).run(req.user.id, s.id, days, sec.now());
  db.prepare("INSERT OR IGNORE INTO applications (user_id, scholarship_id, status, updated_at) VALUES (?,?,'Saved',?)").run(req.user.id, s.id, sec.now());
  svc.runReminders(db);
  req.flash('success', `Saved. We will remind you ${days} days before the deadline.`);
  res.redirect(`/scholarships/${s.id}`);
});

router.post('/scholarships/:id/unsave', ...studentOnly, (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return next();
  req.app.locals.db.prepare('DELETE FROM saved WHERE user_id = ? AND scholarship_id = ?').run(req.user.id, id);
  req.flash('info', 'Removed from your saved list.');
  res.redirect(req.body.back === 'saved' ? '/saved' : `/scholarships/${id}`);
});

router.post('/scholarships/:id/track', ...studentOnly, (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const db = req.app.locals.db;
  const s = Number.isInteger(id) ? db.prepare("SELECT id FROM scholarships WHERE id = ? AND status IN ('verified','inactive')").get(id) : null;
  if (!s) return next();
  const status = v.oneOf(req.body.status, v.APP_STATUSES);
  if (!status) { req.flash('error', 'Please choose a valid status.'); return res.redirect('/applications'); }
  db.prepare(`INSERT INTO applications (user_id, scholarship_id, status, notes, updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id, scholarship_id) DO UPDATE SET status = excluded.status, notes = excluded.notes, updated_at = excluded.updated_at`)
    .run(req.user.id, id, status, v.clean(req.body.notes, 500), sec.now());
  req.flash('success', `Application status updated to "${status}".`);
  res.redirect(req.body.back === 'applications' ? '/applications' : `/scholarships/${id}`);
});

router.post('/scholarships/:id/untrack', ...studentOnly, (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return next();
  req.app.locals.db.prepare('DELETE FROM applications WHERE user_id = ? AND scholarship_id = ?').run(req.user.id, id);
  req.flash('info', 'Removed from your application tracker.');
  res.redirect('/applications');
});

module.exports = router;
