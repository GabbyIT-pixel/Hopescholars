'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { start, Client } = require('./helpers');
const config = require('../src/config');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const cookieOf = (r, name) => { const c = r.headers.getSetCookie().find((x) => x.startsWith(name + '=')); return c ? c.split(';')[0].slice(name.length + 1) : null; };

test('help desk answers platform questions and live data, without login', async () => {
  const { base, close } = await start();
  try {
    const c = new Client(base);
    const ask = async (q) => { const t = await c.csrf('/help'); const r = await c.req('POST', '/help/ask', { q, _csrf: t }); return r.text; };
    assert.match(await ask('How do reminders work?'), /Alerts/);
    assert.match(await ask('what does the match percentage mean'), /education level/i);
    assert.match(await ask('How many scholarships are open?'), /open verified scholarship/);
    assert.match(await ask('is this a scam, are they real'), /administrator/i);
    assert.match(await ask('xqzv blorp'), /not sure/i);
    assert.match(await ask('what are my deadlines'), /log in first/i);
    // JSON mode used by the chat panel
    const t = await c.csrf('/help');
    const jr = await fetch(base + '/help/ask', { method: 'POST', headers: { cookie: c._cookieHeader(), 'content-type': 'application/x-www-form-urlencoded', 'x-requested-with': 'fetch' }, body: new URLSearchParams({ q: 'How do I sign up?', _csrf: t }) });
    const j = await jr.json();
    assert.ok(j.answer && Array.isArray(j.links) && j.source === 'kb');
    // CSRF is enforced
    assert.equal((await c.req('POST', '/help/ask', { q: 'hi' })).status, 403);
  } finally { close(); }
});

test('help desk personal answers use only the signed-in student\'s data; HTML is escaped', async () => {
  const { base, close } = await start();
  try {
    const c = new Client(base);
    await c.login('student@hopescholar.demo', 'Student#2026demo');
    const t = await c.csrf('/help');
    const r = await c.req('POST', '/help/ask', { q: 'my saved deadlines', _csrf: t });
    assert.match(r.text, /deadline|saved/i);
    const x = await c.req('POST', '/help/ask', { q: '<script>alert(1)</script> help', _csrf: await c.csrf('/help') });
    assert.ok(!x.text.includes('<script>alert(1)</script>'));
  } finally { close(); }
});

test('help desk uses the AI when a key is set and falls back to the knowledge base on failure', async () => {
  const { base, close } = await start();
  const realFetch = global.fetch; const key = config.helpdeskApiKey;
  try {
    config.helpdeskApiKey = 'test-key';
    let sentBody = null;
    global.fetch = async (url, opts) => {
      if (String(url).startsWith('https://api.anthropic.com')) {
        sentBody = JSON.parse(opts.body);
        if (sentBody.messages[0].content.includes('FAIL')) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'AI says: save it on the scholarship page.' }] }) };
      }
      return realFetch(url, opts);
    };
    const c = new Client(base);
    const t = await c.csrf('/help');
    let r = await c.req('POST', '/help/ask', { q: 'how do I keep a scholarship for later', _csrf: t });
    assert.match(r.text, /AI says/);
    assert.match(sentBody.system, /ONLY questions about Hope Scholar/);
    assert.ok(!JSON.stringify(sentBody).includes('test-key'));
    r = await c.req('POST', '/help/ask', { q: 'FAIL how do reminders work', _csrf: await c.csrf('/help') });
    assert.match(r.text, /Alerts/); // fell back to the built-in answer
  } finally { global.fetch = realFetch; config.helpdeskApiKey = key; close(); }
});

test('Google sign-in is hidden until configured', async () => {
  const { base, close } = await start();
  try {
    const c = new Client(base);
    assert.ok(!(await c.get('/login')).text.includes('Continue with Google'));
    const r = await c.get('/auth/google');
    assert.equal(r.status, 302); assert.equal(r.location, '/login');
  } finally { close(); }
});

test('Google sign-in: PKCE + state, rejects forgery, creates and links accounts safely', async () => {
  const { base, db, close } = await start();
  const realFetch = global.fetch;
  const save = [config.googleClientId, config.googleClientSecret];
  try {
    config.googleClientId = 'client-123.apps.googleusercontent.com'; config.googleClientSecret = 'secret';
    // App reads these via config at request time for the route, but the button flag was set at app creation:
    const c = new Client(base);

    const begin = await c.get('/auth/google?role=student');
    assert.equal(begin.status, 302);
    const u = new URL(begin.location);
    assert.equal(u.host, 'accounts.google.com');
    assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(u.searchParams.get('state') && u.searchParams.get('nonce') && u.searchParams.get('code_challenge'));
    const saved = JSON.parse(Buffer.from(cookieOf(begin, 'hs_oauth'), 'base64url').toString());
    // challenge must be S256(verifier)
    assert.equal(u.searchParams.get('code_challenge'), crypto.createHash('sha256').update(saved.verifier).digest('base64url'));
    c.jar.hs_oauth = cookieOf(begin, 'hs_oauth');

    const idToken = (over = {}) => 'h.' + b64({ iss: 'https://accounts.google.com', aud: config.googleClientId, exp: Math.floor(Date.now() / 1000) + 600, nonce: saved.nonce, sub: 'g-sub-1', email: 'new.student@example.com', email_verified: true, name: 'New Student', ...over }) + '.s';
    let tokenBody = null;
    const mockGoogle = (token) => { global.fetch = async (url, opts) => { if (String(url).startsWith('https://oauth2.googleapis.com')) { tokenBody = new URLSearchParams(opts.body); return { ok: true, json: async () => ({ id_token: token }) }; } return realFetch(url, opts); }; };

    // 1) wrong state is rejected and nothing is created
    mockGoogle(idToken());
    let r = await c.get('/auth/google/callback?code=abc&state=WRONG');
    assert.equal(r.location, '/login');
    assert.equal(db.prepare('SELECT COUNT(*) c FROM users WHERE email = ?').get('new.student@example.com').c, 0);

    // 2) valid callback creates a student, signs in, sends the PKCE verifier
    c.jar.hs_oauth = cookieOf(begin, 'hs_oauth');
    r = await c.get(`/auth/google/callback?code=abc&state=${saved.state}`);
    assert.equal(r.location, '/profile');
    assert.equal(tokenBody.get('code_verifier'), saved.verifier);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get('new.student@example.com');
    assert.equal(row.role, 'student'); assert.equal(row.google_sub, 'g-sub-1');
    assert.ok(row.password_hash.startsWith('$2'), 'Google users get an unusable random password hash, never empty');
    assert.equal((await c.get('/dashboard')).status, 200);
    assert.ok(db.prepare("SELECT 1 FROM audit_log WHERE action='LOGIN_SUCCESS' AND detail='google'").get());

    // 3) bad audience / unverified email / expired token are rejected
    for (const bad of [{ aud: 'someone-else' }, { email_verified: false, sub: 'g-sub-2', email: 'x@example.com' }, { exp: Math.floor(Date.now() / 1000) - 10 }, { nonce: 'nope' }]) {
      const c2 = new Client(base);
      const b2 = await c2.get('/auth/google'); c2.jar.hs_oauth = cookieOf(b2, 'hs_oauth');
      const s2 = JSON.parse(Buffer.from(c2.jar.hs_oauth, 'base64url').toString());
      mockGoogle('h.' + b64({ iss: 'https://accounts.google.com', aud: config.googleClientId, exp: Math.floor(Date.now() / 1000) + 600, nonce: s2.nonce, sub: 'g-bad', email: 'bad@example.com', email_verified: true, ...bad }) + '.s');
      const rr = await c2.get(`/auth/google/callback?code=abc&state=${s2.state}`);
      assert.equal(rr.location, '/login');
      assert.equal(db.prepare("SELECT COUNT(*) c FROM users WHERE email IN ('bad@example.com','x@example.com')").get().c, 0);
    }

    // 4) an admin account can never be taken over through Google, even with the same verified email
    const c3 = new Client(base);
    const b3 = await c3.get('/auth/google'); c3.jar.hs_oauth = cookieOf(b3, 'hs_oauth');
    const s3 = JSON.parse(Buffer.from(c3.jar.hs_oauth, 'base64url').toString());
    mockGoogle('h.' + b64({ iss: 'accounts.google.com', aud: config.googleClientId, exp: Math.floor(Date.now() / 1000) + 600, nonce: s3.nonce, sub: 'g-admin', email: 'admin@hopescholar.demo', email_verified: true }) + '.s');
    const ra = await c3.get(`/auth/google/callback?code=abc&state=${s3.state}`);
    assert.equal(ra.location, '/login');
    assert.equal(db.prepare("SELECT google_sub FROM users WHERE email='admin@hopescholar.demo'").get().google_sub, null);

    // 5) linking an existing password account disables its old password (blocks pre-registration hijack)
    const c4 = new Client(base);
    const b4 = await c4.get('/auth/google'); c4.jar.hs_oauth = cookieOf(b4, 'hs_oauth');
    const s4 = JSON.parse(Buffer.from(c4.jar.hs_oauth, 'base64url').toString());
    mockGoogle('h.' + b64({ iss: 'https://accounts.google.com', aud: config.googleClientId, exp: Math.floor(Date.now() / 1000) + 600, nonce: s4.nonce, sub: 'g-stu', email: 'student@hopescholar.demo', email_verified: true }) + '.s');
    const rl = await c4.get(`/auth/google/callback?code=abc&state=${s4.state}`);
    assert.equal(rl.location, '/dashboard');
    global.fetch = realFetch;
    const old = new Client(base);
    const lr = await old.login('student@hopescholar.demo', 'Student#2026demo');
    assert.equal(lr.status, 401, 'old password no longer works after linking');
  } finally { global.fetch = realFetch; [config.googleClientId, config.googleClientSecret] = save; close(); }
});

test('UX: dashboard checklist, password toggle hooks and nav help link render', async () => {
  const { base, close } = await start();
  try {
    const c = new Client(base);
    assert.match((await c.get('/')).text, /hero-search/);
    assert.match((await c.get('/login')).text, /data-fill-email/); // demo mode quick-fill
    assert.match((await c.get('/register')).text, /data-strength/);
    await c.login('student@hopescholar.demo', 'Student#2026demo');
    const d = (await c.get('/dashboard')).text;
    assert.match(d, /Get started|class="stats"/);
    assert.ok(!/ style="/.test(d), 'no inline styles (CSP)');
    assert.match(d, /href="\/help"/);
  } finally { close(); }
});
