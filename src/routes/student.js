'use strict';
const express = require('express');
const sec = require('../security');
const v = require('../validate');
const svc = require('../services');

const router = express.Router();
const student = [sec.requireLogin, sec.requireRole('student')];

router.get('/dashboard', ...student, (req, res) => {
  const db = req.app.locals.db;
  const profile = svc.getProfile(db, req.user.id);
  const upcoming = db.prepare(`SELECT s.*, sv.remind_days FROM saved sv JOIN scholarships s ON s.id = sv.scholarship_id
    WHERE sv.user_id = ? AND s.deadline >= ? AND s.status = 'verified' ORDER BY s.deadline ASC LIMIT 5`).all(req.user.id, v.today());
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM saved WHERE user_id = @u) saved,
    (SELECT COUNT(*) FROM applications WHERE user_id = @u) tracked,
    (SELECT COUNT(*) FROM applications WHERE user_id = @u AND status = 'Applied') applied`).get({ u: req.user.id });
  const notes = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 3').all(req.user.id);
  res.render('dashboard', {
    title: 'Dashboard', profile, complete: svc.profileComplete(profile), upcoming, counts, notes,
    recs: svc.recommendations(db, req.user.id, 3),
  });
});

router.get('/profile', ...student, (req, res) => {
  res.render('profile', { title: 'My profile', profile: svc.getProfile(req.app.locals.db, req.user.id) || {}, errors: [] });
});

router.post('/profile', ...student, (req, res) => {
  const db = req.app.locals.db;
  const p = {
    education_level: v.oneOf(req.body.education_level, v.LEVELS),
    field_of_study: v.oneOf(req.body.field_of_study, v.FIELDS.slice(1)),
    country: v.oneOf(req.body.country, v.COUNTRIES.slice(1)),
    financial_need: v.oneOf(req.body.financial_need, v.NEEDS),
    academic_standing: v.oneOf(req.body.academic_standing, v.STANDINGS),
    location: v.clean(req.body.location, 100),
  };
  const errors = [];
  if (!p.education_level) errors.push('Please choose your education level.');
  if (!p.field_of_study) errors.push('Please choose your field of study.');
  if (!p.country) errors.push('Please choose your country.');
  if (!p.financial_need) errors.push('Please choose your financial need (or "Prefer not to say").');
  if (errors.length) return res.status(400).render('profile', { title: 'My profile', profile: p, errors });
  db.prepare(`INSERT INTO profiles (user_id, education_level, field_of_study, country, location, financial_need, academic_standing, updated_at)
    VALUES (@id, @education_level, @field_of_study, @country, @location, @financial_need, @academic_standing, @t)
    ON CONFLICT(user_id) DO UPDATE SET education_level=@education_level, field_of_study=@field_of_study, country=@country,
    location=@location, financial_need=@financial_need, academic_standing=@academic_standing, updated_at=@t`)
    .run({ ...p, id: req.user.id, t: sec.now() });
  req.app.locals.audit(req, 'PROFILE_UPDATED');
  req.flash('success', 'Profile saved. Your recommendations are updated.');
  res.redirect('/dashboard');
});

/* ---------- account (FR 1.3) ---------- */
router.get('/account', sec.requireLogin, (req, res) => res.render('account', { title: 'Account settings', errors: [] }));

router.post('/account', sec.requireLogin, async (req, res) => {
  const db = req.app.locals.db;
  const errors = [];
  const name = v.clean(req.body.name, 80);
  if (name.length < 2) errors.push('Please enter your name.');
  const newPw = String(req.body.new_password || '');
  if (newPw) {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!(await sec.verifyPassword(String(req.body.current_password || ''), row.password_hash))) errors.push('Your current password is incorrect.');
    const problems = sec.passwordProblems(newPw, req.user.email);
    if (problems.length) errors.push('Your new password needs: ' + problems.join(', ') + '.');
    if (newPw !== String(req.body.confirm || '')) errors.push('The new passwords do not match.');
  }
  if (errors.length) return res.status(400).render('account', { title: 'Account settings', errors });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  if (newPw) {
    const hash = await sec.hashPassword(newPw);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').run(req.user.id, req.session.hash); // sign out other devices
    req.app.locals.audit(req, 'PASSWORD_CHANGED');
  }
  req.app.locals.audit(req, 'ACCOUNT_UPDATED');
  req.flash('success', newPw ? 'Account and password updated.' : 'Account updated.');
  res.redirect('/account');
});

/* ---------- saved scholarships & tracking (FR 5.1, 5.3) ---------- */
router.get('/saved', ...student, (req, res) => {
  const rows = req.app.locals.db.prepare(`SELECT s.*, sv.remind_days, sv.saved_at FROM saved sv JOIN scholarships s ON s.id = sv.scholarship_id
    WHERE sv.user_id = ? ORDER BY s.deadline ASC`).all(req.user.id);
  res.render('saved', { title: 'Saved scholarships', rows });
});

router.get('/applications', ...student, (req, res) => {
  const rows = req.app.locals.db.prepare(`SELECT s.id, s.title, s.provider, s.deadline, s.status sch_status, a.status, a.notes, a.updated_at
    FROM applications a JOIN scholarships s ON s.id = a.scholarship_id WHERE a.user_id = ? ORDER BY s.deadline ASC`).all(req.user.id);
  res.render('applications', { title: 'My applications', rows, statuses: v.APP_STATUSES });
});

router.get('/notifications', sec.requireLogin, (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.render('notifications', { title: 'Notifications', rows });
});

router.post('/notifications/read', sec.requireLogin, (req, res) => {
  req.app.locals.db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.redirect('/notifications');
});

module.exports = router;
