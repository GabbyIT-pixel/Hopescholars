'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { start, Client } = require('./helpers');

let ctx;
test.before(async () => { ctx = await start(); });
test.after(() => ctx.close());

test('passwords are stored hashed, never in plain text', async () => {
  const c = new Client(ctx.base);
  const r = await c.post('/register', { name: 'Test User', email: 'hash@test.org', password: 'Str0ngPassword1', confirm: 'Str0ngPassword1', role: 'student' }, '/register');
  assert.strictEqual(r.status, 302);
  const row = ctx.db.prepare('SELECT password_hash FROM users WHERE email = ?').get('hash@test.org');
  assert.ok(row.password_hash.startsWith('$2'), 'bcrypt hash expected');
  assert.ok(!row.password_hash.includes('Str0ngPassword1'));
});

test('weak passwords are rejected at registration', async () => {
  const c = new Client(ctx.base);
  const r = await c.post('/register', { name: 'Weak', email: 'weak@test.org', password: 'short', confirm: 'short', role: 'student' }, '/register');
  assert.strictEqual(r.status, 400);
  assert.match(r.text, /Your password needs/);
});

test('POST without a CSRF token is blocked', async () => {
  const c = new Client(ctx.base);
  await c.get('/login');
  const r = await c.req('POST', '/login', { email: 'student@hopescholar.demo', password: 'Student#2026demo' });
  assert.strictEqual(r.status, 403);
});

test('login works, session id rotates, logout ends the session', async () => {
  const c = new Client(ctx.base);
  await c.get('/login');
  const before = c.jar.hs_sid;
  const r = await c.login('student@hopescholar.demo', 'Student#2026demo');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.location, '/dashboard');
  assert.notStrictEqual(c.jar.hs_sid, before, 'session id must change at login');
  assert.strictEqual((await c.get('/dashboard')).status, 200);
  await c.post('/logout', {}, '/dashboard');
  assert.strictEqual((await c.get('/dashboard')).status, 302);
});

test('wrong password and unknown email give the same generic message', async () => {
  const a = new Client(ctx.base); const b = new Client(ctx.base);
  const r1 = await a.login('student@hopescholar.demo', 'WrongPassword1');
  const r2 = await b.login('nobody@nowhere.org', 'WrongPassword1');
  assert.strictEqual(r1.status, 401); assert.strictEqual(r2.status, 401);
  assert.match(r1.text, /Incorrect email or password/); assert.match(r2.text, /Incorrect email or password/);
});

test('account locks after repeated failures, even for the right password', async () => {
  const email = 'provider@hopescholar.demo';
  const c = new Client(ctx.base);
  for (let i = 0; i < 5; i++) await c.login(email, 'BadPassword123');
  const r = await c.login(email, 'Provider#2026demo');
  assert.strictEqual(r.status, 429);
  assert.match(r.text, /Too many failed attempts/);
  const log = ctx.db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action = 'ACCOUNT_LOCKED'").get().c;
  assert.ok(log >= 1);
});

test('role-based access control: students cannot reach admin or provider pages', async () => {
  const c = new Client(ctx.base);
  await c.login('student@hopescholar.demo', 'Student#2026demo');
  for (const p of ['/admin', '/admin/audit', '/admin/users', '/provider', '/admin/listings/new']) {
    assert.strictEqual((await c.get(p)).status, 403, p);
  }
  const denied = ctx.db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action = 'ACCESS_DENIED'").get().c;
  assert.ok(denied >= 5, 'denied attempts are audited');
});

test('anonymous users are redirected to log in for protected pages', async () => {
  const c = new Client(ctx.base);
  for (const p of ['/dashboard', '/saved', '/applications', '/profile', '/admin']) {
    const r = await c.get(p);
    assert.strictEqual(r.status, 302); assert.strictEqual(r.location, '/login');
  }
});

test('SQL injection strings are treated as plain text', async () => {
  const c = new Client(ctx.base);
  const r = await c.get('/scholarships?q=' + encodeURIComponent("' OR 1=1; DROP TABLE users;--"));
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /<strong>0<\/strong> open scholarships found/);
  assert.ok(ctx.db.prepare('SELECT COUNT(*) c FROM users').get().c > 0);
});

test('stored XSS payloads are escaped in output', async () => {
  const c = new Client(ctx.base);
  await c.login('student@hopescholar.demo', 'Student#2026demo');
  await c.post('/account', { name: '<script>alert(1)</script>' }, '/account');
  const r = await c.get('/account');
  assert.ok(!r.text.includes('<script>alert(1)</script>'));
  assert.match(r.text, /&lt;script&gt;/);
});

test('security headers are present', async () => {
  const r = await new Client(ctx.base).get('/');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(!r.headers.get('x-powered-by'));
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  assert.match(r.headers.get('set-cookie'), /SameSite=Lax/i);
});

test('password reset: generic response, single-use, expires, signs out old sessions', async () => {
  const email = 'student@hopescholar.demo';
  const old = new Client(ctx.base);
  await old.login(email, 'Student#2026demo');
  assert.strictEqual((await old.get('/dashboard')).status, 200);

  const c = new Client(ctx.base);
  const unknown = await c.post('/forgot', { email: 'ghost@nowhere.org' }, '/forgot');
  assert.match(unknown.text, /If that email belongs to an account/);
  const known = await c.post('/forgot', { email }, '/forgot');
  assert.match(known.text, /If that email belongs to an account/);
  const link = known.text.match(/href="(http[^"]+\/reset\/[0-9a-f]+)"/)[1];
  const token = link.split('/reset/')[1];
  const stored = ctx.db.prepare('SELECT token_hash FROM password_resets').all();
  assert.ok(!stored.some((r) => r.token_hash === token), 'token is stored hashed');

  const done = await c.post('/reset/' + token, { password: 'NewStrongPass9', confirm: 'NewStrongPass9' }, '/reset/' + token);
  assert.strictEqual(done.status, 302);
  assert.strictEqual((await old.get('/dashboard')).status, 302, 'old session is signed out');
  const again = await c.post('/reset/' + token, { password: 'AnotherPass99', confirm: 'AnotherPass99' }, '/forgot');
  assert.strictEqual(again.status, 400, 'token cannot be reused');
  const ok = await new Client(ctx.base).login(email, 'NewStrongPass9');
  assert.strictEqual(ok.status, 302);

  const t2 = (await c.post('/forgot', { email }, '/forgot')).text.match(/\/reset\/([0-9a-f]+)/)[1];
  ctx.db.prepare('UPDATE password_resets SET expires_at = 1').run();
  assert.strictEqual((await c.get('/reset/' + t2)).text.includes('invalid or has expired'), true);
});

test('login success and failure are written to the audit log', async () => {
  const c = new Client(ctx.base);
  await c.login('admin@hopescholar.demo', 'Scholar#Hope2026');
  await c.login('admin@hopescholar.demo', 'nope');
  const actions = ctx.db.prepare('SELECT DISTINCT action FROM audit_log').all().map((r) => r.action);
  assert.ok(actions.includes('LOGIN_SUCCESS')); assert.ok(actions.includes('LOGIN_FAILED'));
});
