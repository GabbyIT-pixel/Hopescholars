'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('./config');

const now = () => Date.now();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* ---------- passwords (NFR 13: hashed, never plain text) ---------- */
const COMMON = new Set(['password123', '1234567890', 'qwertyuiop', 'password1234', 'iloveyou123',
  'welcome12345', 'letmein1234', 'admin123456', 'abcd123456', '0123456789']);

function passwordProblems(password, email = '') {
  const problems = [];
  if (typeof password !== 'string' || password.length < 10) problems.push('at least 10 characters');
  if (password && password.length > 128) problems.push('no more than 128 characters');
  if (!/[a-z]/.test(password || '') || !/[A-Z]/.test(password || '') || !/[0-9]/.test(password || '')) {
    problems.push('upper-case, lower-case and a number');
  }
  if (COMMON.has(String(password).toLowerCase())) problems.push('not a commonly used password');
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && String(password).toLowerCase().includes(local)) problems.push('must not contain your email name');
  return problems;
}

const hashPassword = (pw) => bcrypt.hash(pw, config.bcryptRounds);
const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);
// Used so that unknown e-mails cost the same time as wrong passwords (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', config.bcryptRounds);

/* ---------- sessions ---------- */
const COOKIE = 'hs_sid';

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionMiddleware(db) {
  const get = db.prepare('SELECT * FROM sessions WHERE id_hash = ?');
  const insert = db.prepare('INSERT INTO sessions (id_hash, user_id, csrf, created_at, last_seen) VALUES (?,?,?,?,?)');
  const touch = db.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?');
  const del = db.prepare('DELETE FROM sessions WHERE id_hash = ?');
  const getUser = db.prepare('SELECT id, email, name, role, active FROM users WHERE id = ?');
  const setFlash = db.prepare('UPDATE sessions SET flash = ? WHERE id_hash = ?');

  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    let row = cookies[COOKIE] ? get.get(sha256(cookies[COOKIE])) : null;
    const t = now();
    if (row && (t - row.last_seen > config.sessionIdleMinutes * 60e3 || t - row.created_at > config.sessionMaxHours * 3600e3)) {
      del.run(row.id_hash);
      row = null;
    }
    let sid = cookies[COOKIE];
    if (!row) {
      sid = randomToken(32);
      insert.run(sha256(sid), null, randomToken(24), t, t);
      row = get.get(sha256(sid));
      res.cookie(COOKIE, sid, cookieOptions());
    } else if (t - row.last_seen > 60e3) {
      touch.run(t, row.id_hash);
    }

    req.session = { hash: row.id_hash, csrf: row.csrf, userId: row.user_id };
    req.user = null;
    if (row.user_id) {
      const u = getUser.get(row.user_id);
      if (u && u.active) req.user = u;
      else { del.run(row.id_hash); }
    }
    if (row.flash) {
      try { res.locals.flash = JSON.parse(row.flash); } catch { /* ignore */ }
      setFlash.run(null, row.id_hash);
    }
    req.flash = (type, message) => setFlash.run(JSON.stringify({ type, message }), req.session.hash);

    // login = rotate session id (prevents session fixation)
    req.login = (userId) => {
      del.run(req.session.hash);
      const newSid = randomToken(32);
      const csrf = randomToken(24);
      insert.run(sha256(newSid), userId, csrf, now(), now());
      res.cookie(COOKIE, newSid, cookieOptions());
      req.session = { hash: sha256(newSid), csrf, userId };
    };
    req.logout = () => {
      del.run(req.session.hash);
      res.clearCookie(COOKIE, cookieOptions());
    };
    res.locals.csrfToken = req.session.csrf;
    res.locals.currentUser = req.user;
    next();
  };
}

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/', maxAge: config.sessionMaxHours * 3600e3 };
}

/* ---------- CSRF (synchroniser token) ---------- */
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!sent || !safeEqual(sent, req.session.csrf)) {
    return res.status(403).render('error', { title: 'Request blocked', code: 403, message: 'Your session expired or the request could not be verified. Please go back, refresh the page and try again.' });
  }
  next();
}

/* ---------- RBAC (NFR 14) ---------- */
const requireLogin = (req, res, next) => {
  if (!req.user) {
    if (req.method === 'GET') req.flash('info', 'Please log in to continue.');
    return res.redirect('/login');
  }
  next();
};
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.redirect('/login');
  if (!roles.includes(req.user.role)) {
    req.app.locals.audit({ user: req.user, ip: req.ip }, 'ACCESS_DENIED', `${req.method} ${req.originalUrl}`);
    return res.status(403).render('error', { title: 'Not allowed', code: 403, message: 'Your account does not have permission to view this page.' });
  }
  next();
};

/* ---------- audit log (NFR 17) ---------- */
function makeAudit(db) {
  const ins = db.prepare('INSERT INTO audit_log (at, actor_id, actor_email, action, target, ip, detail) VALUES (?,?,?,?,?,?,?)');
  return function audit(ctx, action, target = null, detail = null) {
    const u = ctx.user || null;
    ins.run(now(), u ? u.id : (ctx.actorId || null), u ? u.email : (ctx.email || null), action, target, ctx.ip || null, detail ? String(detail).slice(0, 500) : null);
  };
}

module.exports = {
  now, sha256, randomToken, safeEqual, passwordProblems, hashPassword, verifyPassword, DUMMY_HASH,
  sessionMiddleware, csrfProtection, requireLogin, requireRole, makeAudit,
};
