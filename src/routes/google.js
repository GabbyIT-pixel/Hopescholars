'use strict';
// "Continue with Google": OpenID Connect authorization-code flow with PKCE, state and nonce.
// Only enabled when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const sec = require('../security');

const router = express.Router();
const COOKIE = 'hs_oauth';
const REDIRECT_URI = () => `${config.publicUrl}/auth/google/callback`;
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const home = (u) => (u.role === 'admin' ? '/admin' : u.role === 'provider' ? '/provider' : '/dashboard');
const enabled = () => !!(config.googleClientId && config.googleClientSecret);

const cookieOpts = () => ({ httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/auth/google', maxAge: 10 * 60e3 });

router.use('/auth/google', (req, res, next) => {
  if (enabled()) return next();
  req.flash('info', 'Google sign-in is not switched on yet: the site owner has to add Google credentials (see the README). Please sign up or log in with your email for now.');
  res.redirect('/login');
});

router.get('/auth/google', (req, res) => {
  const state = sec.randomToken(24);
  const nonce = sec.randomToken(24);
  const verifier = b64url(crypto.randomBytes(48));
  const role = req.query.role === 'provider' ? 'provider' : 'student';
  // Held in a short-lived HttpOnly cookie so the callback can prove it belongs to this browser.
  res.cookie(COOKIE, b64url(JSON.stringify({ state, nonce, verifier, role })), cookieOpts());
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.googleClientId, redirect_uri: REDIRECT_URI(), response_type: 'code',
    scope: 'openid email profile', state, nonce, code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  res.redirect(url.toString());
});

function decodeIdToken(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('bad token');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

async function exchangeCode(code, verifier) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: config.googleClientId, client_secret: config.googleClientSecret,
      redirect_uri: REDIRECT_URI(), grant_type: 'authorization_code', code_verifier: verifier,
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`token endpoint ${res.status}`);
  return res.json();
}

router.get('/auth/google/callback', async (req, res) => {
  const db = req.app.locals.db;
  const audit = req.app.locals.audit;
  const fail = (msg, detail) => {
    audit({ ip: req.ip }, 'GOOGLE_LOGIN_FAILED', null, detail || msg);
    req.flash('error', msg);
    res.clearCookie(COOKIE, cookieOpts());
    return res.redirect('/login');
  };
  if (req.query.error) return fail('Google sign-in was cancelled. You can try again or use your email and password.', String(req.query.error).slice(0, 80));

  let saved;
  try { saved = JSON.parse(Buffer.from(sec.parseCookies(req.headers.cookie)[COOKIE] || '', 'base64url').toString('utf8')); } catch { saved = null; }
  if (!saved || !saved.state || !req.query.state || !sec.safeEqual(saved.state, req.query.state) || !req.query.code) {
    return fail('We could not verify that Google sign-in request. Please try again.', 'state mismatch');
  }
  res.clearCookie(COOKIE, cookieOpts());

  let claims;
  try {
    const tokens = await exchangeCode(String(req.query.code), saved.verifier);
    claims = decodeIdToken(tokens.id_token); // received straight from Google over TLS
  } catch (e) {
    return fail('Google sign-in did not complete. Please try again.', 'token exchange failed');
  }
  const okIssuer = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  if (!okIssuer || claims.aud !== config.googleClientId || !(claims.exp * 1000 > Date.now()) || !sec.safeEqual(String(claims.nonce || ''), saved.nonce)) {
    return fail('We could not verify your Google sign-in. Please try again.', 'claims invalid');
  }
  const email = String(claims.email || '').toLowerCase();
  if (!claims.sub || !email || claims.email_verified !== true) {
    return fail('Your Google account email is not verified, so we cannot use it.', 'email not verified');
  }

  let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(claims.sub);
  let created = false;
  if (!user) {
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      if (existing.role === 'admin') return fail('Administrator accounts must sign in with their email and password.', 'admin google login blocked');
      // Link the Google identity. The old password is disabled so nobody who pre-registered this email can keep access.
      const unusable = await sec.hashPassword(sec.randomToken(32));
      db.transaction(() => {
        db.prepare('UPDATE users SET google_sub = ?, password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').run(claims.sub, unusable, existing.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
      })();
      audit({ actorId: existing.id, email, ip: req.ip }, 'GOOGLE_LINKED', null, 'password disabled; use Google or reset password');
      req.flash('info', 'Your account is now linked to Google. If you want to use a password again, choose "Forgot your password?".');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    } else {
      const role = saved.role === 'provider' ? 'provider' : 'student';
      const name = String(claims.name || email.split('@')[0]).replace(/[<>]/g, '').slice(0, 80) || 'Student';
      const hash = await sec.hashPassword(sec.randomToken(32));
      const info = db.prepare('INSERT INTO users (email, name, password_hash, role, google_sub, created_at) VALUES (?,?,?,?,?,?)').run(email, name, hash, role, claims.sub, sec.now());
      if (role === 'student') db.prepare('INSERT INTO profiles (user_id, updated_at) VALUES (?,?)').run(info.lastInsertRowid, sec.now());
      audit({ actorId: info.lastInsertRowid, email, ip: req.ip }, 'REGISTER', `role=${role} via google`);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      created = true;
    }
  }
  if (!user.active) return fail('This account has been disabled. Please contact the administrator.', 'disabled account');
  if (user.role === 'admin') return fail('Administrator accounts must sign in with their email and password.', 'admin google login blocked');

  const pendingFlash = res.locals.flash; // keep a "linked" notice if we just set one
  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(sec.now(), user.id);
  req.login(user.id);
  audit({ actorId: user.id, email, ip: req.ip }, 'LOGIN_SUCCESS', null, 'google');
  if (created) req.flash('success', user.role === 'student' ? 'Welcome to Hope Scholar! Complete your profile to get matched with scholarships.' : 'Welcome! You can now submit scholarships for review.');
  else if (!pendingFlash) req.flash('success', 'Signed in with Google.');
  res.redirect(created && user.role === 'student' ? '/profile' : home(user));
});

module.exports = router;
module.exports.enabled = enabled;
