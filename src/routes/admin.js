'use strict';
const express = require('express');
const sec = require('../security');
const v = require('../validate');
const config = require('../config');

const router = express.Router();
const admin = [sec.requireLogin, sec.requireRole('admin')];
const formOpts = () => ({ levels: v.LEVELS, fields: v.FIELDS, countries: v.COUNTRIES });

router.get('/admin', ...admin, (req, res) => {
  const db = req.app.locals.db;
  const stats = db.prepare(`SELECT
    (SELECT COUNT(*) FROM users WHERE role='student') students,
    (SELECT COUNT(*) FROM users WHERE role='provider') providers,
    (SELECT COUNT(*) FROM scholarships WHERE status='verified') verified,
    (SELECT COUNT(*) FROM scholarships WHERE status='pending') pending,
    (SELECT COUNT(*) FROM audit_log WHERE action='LOGIN_FAILED' AND at > ?) failed24`).get(sec.now() - 86400e3);
  const pending = db.prepare("SELECT * FROM scholarships WHERE status='pending' ORDER BY created_at ASC").all();
  res.render('admin', { title: 'Administration', stats, pending });
});

router.get('/admin/listings', ...admin, (req, res) => {
  const status = v.oneOf(req.query.status, ['pending', 'verified', 'rejected', 'inactive']);
  const rows = req.app.locals.db.prepare(`SELECT s.*, u.email submitter FROM scholarships s LEFT JOIN users u ON u.id = s.submitted_by
    ${status ? 'WHERE s.status = ?' : ''} ORDER BY s.updated_at DESC LIMIT 200`).all(...(status ? [status] : []));
  res.render('admin-listings', { title: 'Manage listings', rows, status });
});

router.get('/admin/listings/new', ...admin, (req, res) => {
  res.render('listing-form', { title: 'Add a scholarship', action: '/admin/listings/new', s: {}, errors: [], ...formOpts(), cancel: '/admin/listings' });
});

router.post('/admin/listings/new', ...admin, (req, res) => {
  const { data, errors } = v.scholarshipInput(req.body);
  if (errors.length) return res.status(400).render('listing-form', { title: 'Add a scholarship', action: '/admin/listings/new', s: data, errors, ...formOpts(), cancel: '/admin/listings' });
  const t = sec.now();
  const info = req.app.locals.db.prepare(`INSERT INTO scholarships (title, provider, description, eligibility, education_level, field_of_study, country, need_based,
    award_value, deadline, application_url, instructions, status, submitted_by, verified_by, created_at, updated_at)
    VALUES (@title,@provider,@description,@eligibility,@education_level,@field_of_study,@country,@need_based,@award_value,@deadline,@application_url,@instructions,'verified',@by,@by,@t,@t)`)
    .run({ ...data, by: req.user.id, t });
  req.app.locals.audit(req, 'LISTING_CREATED', `#${info.lastInsertRowid} ${data.title}`);
  req.flash('success', 'Scholarship added and published.');
  res.redirect('/admin/listings');
});

const loadListing = (req) => {
  const id = parseInt(req.params.id, 10);
  return Number.isInteger(id) ? req.app.locals.db.prepare('SELECT * FROM scholarships WHERE id = ?').get(id) : null;
};

router.get('/admin/listings/:id/edit', ...admin, (req, res, next) => {
  const s = loadListing(req); if (!s) return next();
  res.render('listing-form', { title: 'Edit scholarship', action: `/admin/listings/${s.id}/edit`, s, errors: [], ...formOpts(), cancel: '/admin/listings' });
});

router.post('/admin/listings/:id/edit', ...admin, (req, res, next) => {
  const s = loadListing(req); if (!s) return next();
  const { data, errors } = v.scholarshipInput(req.body);
  if (errors.length) return res.status(400).render('listing-form', { title: 'Edit scholarship', action: `/admin/listings/${s.id}/edit`, s: { ...data, id: s.id }, errors, ...formOpts(), cancel: '/admin/listings' });
  req.app.locals.db.prepare(`UPDATE scholarships SET title=@title, provider=@provider, description=@description, eligibility=@eligibility, education_level=@education_level,
    field_of_study=@field_of_study, country=@country, need_based=@need_based, award_value=@award_value, deadline=@deadline, application_url=@application_url,
    instructions=@instructions, updated_at=@t WHERE id=@id`).run({ ...data, id: s.id, t: sec.now() });
  req.app.locals.audit(req, 'LISTING_EDITED', `#${s.id} ${data.title}`);
  req.flash('success', 'Scholarship updated.');
  res.redirect('/admin/listings');
});

function transition(name, newStatus, auditAction, message) {
  router.post(`/admin/listings/:id/${name}`, ...admin, (req, res, next) => {
    const s = loadListing(req); if (!s) return next();
    const db = req.app.locals.db;
    const reason = name === 'reject' ? v.clean(req.body.reason, 300) : null;
    if (name === 'reject' && reason.length < 5) { req.flash('error', 'Please give the provider a short reason for rejecting.'); return res.redirect('/admin'); }
    if (name === 'verify' && v.daysUntil(s.deadline) < 0) { req.flash('error', 'This listing\'s deadline has already passed, so it cannot be published.'); return res.redirect('/admin'); }
    db.prepare('UPDATE scholarships SET status = ?, reject_reason = ?, verified_by = ?, updated_at = ? WHERE id = ?')
      .run(newStatus, reason, name === 'verify' ? req.user.id : s.verified_by, sec.now(), s.id);
    if (s.submitted_by && s.submitted_by !== req.user.id && (name === 'verify' || name === 'reject')) {
      db.prepare('INSERT INTO notifications (user_id, message, link, created_at) VALUES (?,?,?,?)')
        .run(s.submitted_by, name === 'verify' ? `Your scholarship "${s.title}" was verified and is now live.` : `Your scholarship "${s.title}" needs changes: ${reason}`, '/provider', sec.now());
    }
    req.app.locals.audit(req, auditAction, `#${s.id} ${s.title}`, reason);
    req.flash('success', message);
    res.redirect(req.body.back === 'listings' ? '/admin/listings' : '/admin');
  });
}
transition('verify', 'verified', 'LISTING_VERIFIED', 'Listing verified and published to students.');
transition('reject', 'rejected', 'LISTING_REJECTED', 'Listing rejected and the provider was notified.');
transition('deactivate', 'inactive', 'LISTING_DEACTIVATED', 'Listing deactivated. Students can no longer find it.');
transition('reactivate', 'verified', 'LISTING_REACTIVATED', 'Listing reactivated.');

router.post('/admin/listings/:id/delete', ...admin, (req, res, next) => {
  const s = loadListing(req); if (!s) return next();
  req.app.locals.db.prepare('DELETE FROM scholarships WHERE id = ?').run(s.id);
  req.app.locals.audit(req, 'LISTING_DELETED', `#${s.id} ${s.title}`);
  req.flash('success', 'Listing removed permanently.');
  res.redirect('/admin/listings');
});

/* ---------- audit log (FR 6, NFR 17) ---------- */
router.get('/admin/audit', ...admin, (req, res) => {
  const db = req.app.locals.db;
  const action = v.clean(req.query.action, 40);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = 25;
  const where = action ? 'WHERE action = ?' : '';
  const args = action ? [action] : [];
  const total = db.prepare(`SELECT COUNT(*) c FROM audit_log ${where}`).get(...args).c;
  const rows = db.prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size);
  const actions = db.prepare('SELECT DISTINCT action FROM audit_log ORDER BY action').all().map((r) => r.action);
  res.render('audit', { title: 'Audit log', rows, total, page, pages: Math.max(1, Math.ceil(total / size)), action, actions });
});

/* ---------- user accounts ---------- */
router.get('/admin/users', ...admin, (req, res) => {
  const rows = req.app.locals.db.prepare('SELECT id, name, email, role, active, locked_until, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 200').all();
  res.render('admin-users', { title: 'User accounts', rows, now: sec.now() });
});

router.post('/admin/users/:id/toggle', ...admin, (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const db = req.app.locals.db;
  const u = Number.isInteger(id) ? db.prepare('SELECT * FROM users WHERE id = ?').get(id) : null;
  if (!u) return next();
  if (u.id === req.user.id) { req.flash('error', 'You cannot disable your own account.'); return res.redirect('/admin/users'); }
  const active = u.active ? 0 : 1;
  db.prepare('UPDATE users SET active = ?, locked_until = NULL, failed_logins = 0 WHERE id = ?').run(active, u.id);
  if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  req.app.locals.audit(req, active ? 'USER_ENABLED' : 'USER_DISABLED', u.email);
  req.flash('success', `${u.email} ${active ? 'enabled' : 'disabled'}.`);
  res.redirect('/admin/users');
});

module.exports = router;
