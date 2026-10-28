'use strict';
const express = require('express');
const config = require('../config');
const sec = require('../security');
const v = require('../validate');

const router = express.Router();
const home = (u) => (u.role === 'admin' ? '/admin' : u.role === 'provider' ? '/provider' : '/dashboard');

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const stats = db.prepare("SELECT COUNT(*) c FROM scholarships WHERE status='verified' AND deadline >= ?").get(v.today());
  res.render('home', { title: 'Find scholarships that fit you', count: stats.c });
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect(home(req.user));
  res.render('register', { title: 'Create your account', errors: [], form: {} });
});

router.post('/register', async (req, res) => {
  const db = req.app.locals.db;
  const form = {
    name: v.clean(req.body.name, 80),
    email: v.clean(req.body.email, 254).toLowerCase(),
    role: req.body.role === 'provider' ? 'provider' : 'student',
  };
  const password = String(req.body.password || '');
  const errors = [];
  if (form.name.length < 2) errors.push('Please enter your name.');
  if (!v.isEmail(form.email)) errors.push('Please enter a valid email address.');
  const problems = sec.passwordProblems(password, form.email);
  if (problems.length) errors.push('Your password needs: ' + problems.join(', ') + '.');
  if (password !== String(req.body.confirm || '')) errors.push('The two passwords do not match.');
  if (errors.length) return res.status(400).render('register', { title: 'Create your account', errors, form });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(form.email);
  if (exists) {
    // Do not reveal whether an email is registered; behave the same way.
    req.app.locals.audit(req, 'REGISTER_DUPLICATE', form.email);
    req.flash('success', 'If this email can be used, your account is ready. Please log in.');
    return res.redirect('/login');
  }
  const hash = await sec.hashPassword(password);
  const info = db.prepare('INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?,?,?)').run(form.email, form.name, hash, form.role, sec.now());
  if (form.role === 'student') db.prepare('INSERT INTO profiles (user_id, updated_at) VALUES (?,?)').run(info.lastInsertRowid, sec.now());
  req.app.locals.audit({ actorId: info.lastInsertRowid, email: form.email, ip: req.ip }, 'REGISTER', `role=${form.role}`);
  req.login(info.lastInsertRowid);
  req.flash('success', form.role === 'student' ? 'Welcome to Hope Scholar! Complete your profile to get matched with scholarships.' : 'Welcome! You can now submit scholarships for review.');
  res.redirect(form.role === 'student' ? '/profile' : '/provider');
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(home(req.user));
  res.render('login', { title: 'Log in', errors: [], form: {} });
});

router.post('/login', async (req, res) => {
  const db = req.app.locals.db;
  const email = v.clean(req.body.email, 254).toLowerCase();
  const password = String(req.body.password || '').slice(0, 200);
  const fail = (status = 401) => res.status(status).render('login', { title: 'Log in', errors: ['Incorrect email or password.'], form: { email } });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ctx = { actorId: user && user.id, email, ip: req.ip };

  if (!user) {
    await sec.verifyPassword(password, sec.DUMMY_HASH);
    req.app.locals.audit(ctx, 'LOGIN_FAILED', 'unknown account');
    return fail();
  }
  if (user.locked_until && user.locked_until > sec.now()) {
    req.app.locals.audit(ctx, 'LOGIN_BLOCKED', 'account temporarily locked');
    const mins = Math.ceil((user.locked_until - sec.now()) / 60e3);
    return res.status(429).render('login', { title: 'Log in', errors: [`Too many failed attempts. Try again in about ${mins} minute(s) or reset your password.`], form: { email } });
  }
  const ok = await sec.verifyPassword(password, user.password_hash);
  if (!ok || !user.active) {
    const failed = user.failed_logins + 1;
    if (failed >= config.maxFailedLogins) {
      db.prepare('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?').run(sec.now() + config.lockMinutes * 60e3, user.id);
      req.app.locals.audit(ctx, 'ACCOUNT_LOCKED', `after ${failed} failed attempts`);
    } else {
      db.prepare('UPDATE users SET failed_logins = ? WHERE id = ?').run(failed, user.id);
    }
    req.app.locals.audit(ctx, 'LOGIN_FAILED', 'wrong password');
    return fail();
  }
  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(sec.now(), user.id);
  req.login(user.id);
  req.app.locals.audit(ctx, 'LOGIN_SUCCESS');
  res.redirect(home(user));
});

router.post('/logout', (req, res) => {
  if (req.user) req.app.locals.audit(req, 'LOGOUT');
  req.logout();
  res.redirect('/');
});

/* ---------- password recovery (NFR 18: secure, time-limited) ---------- */
router.get('/forgot', (req, res) => res.render('forgot', { title: 'Reset your password', sent: false, link: null }));

router.post('/forgot', (req, res) => {
  const db = req.app.locals.db;
  const email = v.clean(req.body.email, 254).toLowerCase();
  const user = v.isEmail(email) ? db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) : null;
  let link = null;
  if (user) {
    const token = sec.randomToken(32);
    db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sec.sha256(token), user.id, sec.now() + config.resetTokenMinutes * 60e3);
    const url = `${req.protocol}://${req.get('host')}/reset/${token}`;
    req.app.locals.audit({ actorId: user.id, email, ip: req.ip }, 'PASSWORD_RESET_REQUESTED');
    if (config.demoMode) link = url;           // demo only: no email service connected
    else console.log(`[password reset] link for ${email}: ${url}`);
  }
  // Same response whether or not the account exists (no user enumeration).
  res.render('forgot', { title: 'Reset your password', sent: true, link });
});

function findReset(db, token) {
  return db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?').get(sec.sha256(String(token)), sec.now());
}

router.get('/reset/:token', (req, res) => {
  const ok = !!findReset(req.app.locals.db, req.params.token);
  res.render('reset', { title: 'Choose a new password', valid: ok, errors: [], token: req.params.token });
});

router.post('/reset/:token', async (req, res) => {
  const db = req.app.locals.db;
  const row = findReset(db, req.params.token);
  if (!row) return res.status(400).render('reset', { title: 'Choose a new password', valid: false, errors: [], token: req.params.token });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  const password = String(req.body.password || '');
  const errors = [];
  const problems = sec.passwordProblems(password, user.email);
  if (problems.length) errors.push('Your password needs: ' + problems.join(', ') + '.');
  if (password !== String(req.body.confirm || '')) errors.push('The two passwords do not match.');
  if (errors.length) return res.status(400).render('reset', { title: 'Choose a new password', valid: true, errors, token: req.params.token });

  const hash = await sec.hashPassword(password);
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').run(hash, user.id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id); // sign out everywhere
  })();
  req.app.locals.audit({ actorId: user.id, email: user.email, ip: req.ip }, 'PASSWORD_RESET_COMPLETED');
  req.flash('success', 'Your password has been changed. Please log in.');
  res.redirect('/login');
});

module.exports = router;
