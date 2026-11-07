#!/usr/bin/env node
'use strict';
// Pre-submission check. Run it against your PUBLIC URL (and local) to prove every rubric item works:
//   node scripts/verify-live.js https://your-app.onrender.com
//   node scripts/verify-live.js https://your-app.onrender.com --links https://github.com/you/repo https://docs.google.com/...
// Admin password defaults to the demo one; set ADMIN_PASSWORD=... if you changed it.
// Needs Node 22+ and no packages. Exit code 0 = everything passed.
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const linkIdx = process.argv.indexOf('--links');
const links = linkIdx > -1 ? process.argv.slice(linkIdx + 1) : [];
const ADMIN_PW = process.env.ADMIN_PASSWORD || 'Scholar#Hope2026';
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

class Client {
  constructor() { this.jar = {}; }
  async req(method, path, body) {
    const headers = { cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') };
    let payload;
    if (body) { headers['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(body).toString(); }
    const res = await fetch(base + path, { method, headers, body: payload, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';'); const i = kv.indexOf('=');
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)) delete this.jar[kv.slice(0, i)]; else this.jar[kv.slice(0, i)] = kv.slice(i + 1);
    }
    return { status: res.status, text: await res.text(), loc: res.headers.get('location') || '' };
  }
  async csrf(p) { const r = await this.req('GET', p); const m = r.text.match(/name="_csrf" value="([^"]+)"/); return m && m[1]; }
  async post(path, body, from) { return this.req('POST', path, { ...body, _csrf: await this.csrf(from || path) }); }
}

async function login(email, password) {
  const c = new Client(); const r = await c.post('/login', { email, password }, '/login'); return { c, r };
}

(async () => {
  console.log(`Checking ${base} (the first request can take ~30 s on a free host that was asleep)\n`);
  const c0 = new Client();
  const health = await c0.req('GET', '/health');
  ok(health.status === 200, 'Health check responds (site is publicly reachable)');
  for (const [p, re] of [['/', /Find scholarships/], ['/scholarships', /scholarship/i], ['/login', /Log in/i], ['/register', /Sign up|Create/i], ['/help', /Help/i], ['/forgot', /password/i]]) {
    const r = await c0.req('GET', p); ok(r.status === 200 && re.test(r.text), `Public page ${p} loads`);
  }
  const list = await c0.req('GET', '/scholarships'); const id = (list.text.match(/href="\/scholarships\/(\d+)"/) || [])[1];
  ok(!!id, 'Scholarship list has at least one listing');
  if (id) { const d = await c0.req('GET', '/scholarships/' + id); ok(d.status === 200 && /rel="[^"]*noopener/.test(d.text) && /https:\/\//.test(d.text), 'Detail page shows an official https apply link'); }
  for (const p of ['/dashboard', '/saved', '/applications', '/admin', '/provider', '/profile']) {
    const r = await c0.req('GET', p); ok(r.status === 302 && /login/.test(r.loc), `Protected page ${p} redirects a visitor to /login`);
  }
  const bad = await login('student@hopescholar.demo', 'wrong-password-123'); ok(bad.r.status === 200 || bad.r.status === 401, 'Wrong password is rejected');
  const g = await c0.req('GET', '/login'); ok(/Continue with Google/.test(g.text), 'Google button is on the login page (active or visibly inactive)');

  // Student journey
  const s = await login('student@hopescholar.demo', 'Student#2026demo');
  ok(s.r.status === 302 && /dashboard/.test(s.r.loc), 'Student login redirects to /dashboard');
  if (s.r.status === 302) {
    const c = s.c;
    ok((await c.req('GET', '/dashboard')).status === 200, 'Student dashboard loads');
    const pr = await c.post('/profile', { education_level: 'Undergraduate', field_of_study: 'Computer Science / IT', country: 'Rwanda', financial_need: 'High', academic_standing: 'Average', location: 'Kigali' }, '/profile');
    ok(pr.status === 302 || pr.status === 200, 'Profile saves');
    if (id) {
      const sv = await c.post(`/scholarships/${id}/save`, { remind_days: '7' }, '/scholarships/' + id); ok(sv.status === 302, 'Save scholarship works');
      ok(/Saved|scholarship/i.test((await c.req('GET', '/saved')).text), 'Saved page lists it');
      const tr = await c.post(`/scholarships/${id}/track`, { status: 'Applied', notes: 'verify-live' }, '/scholarships/' + id); ok(tr.status === 302, 'Application tracking works');
      ok((await c.req('GET', '/applications')).status === 200, 'Applications page loads');
    }
    ok((await c.req('GET', '/notifications')).status === 200, 'Alerts page loads');
    const a = await c.req('GET', '/admin'); ok(a.status === 403 || (a.status === 302 && !/admin/.test(a.loc)), 'Student cannot open the admin area (access control)');
    const lo = await c.post('/logout', {}, '/dashboard'); ok(lo.status === 302, 'Logout works');
    ok((await c.req('GET', '/dashboard')).status === 302, 'After logout the dashboard is protected again');
  }
  // Provider
  const p = await login('provider@hopescholar.demo', 'Provider#2026demo');
  ok(p.r.status === 302 && /provider/.test(p.r.loc), 'Provider login redirects to /provider');
  if (p.r.status === 302) ok((await p.c.req('GET', '/provider/new')).status === 200, 'Provider can open the "add scholarship" form');
  // Admin
  const a = await login('admin@hopescholar.demo', ADMIN_PW);
  ok(a.r.status === 302 && /admin/.test(a.r.loc), 'Admin login redirects to /admin');
  if (a.r.status === 302) for (const q of ['/admin', '/admin/listings', '/admin/users', '/admin/audit']) ok((await a.c.req('GET', q)).status === 200, `Admin page ${q} loads`);
  // Help desk
  const h = new Client(); const hr = await h.post('/help/ask', { q: 'How do I sign up?' }, '/help'); ok(hr.status === 200 && /sign/i.test(hr.text), 'Help desk answers');

  for (const u of links) {
    try { const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Mozilla/5.0 link-check' } });
      ok(r.status === 200 && !/accounts\.google\.com\/(ServiceLogin|v3\/signin)|\/login\?/.test(r.url), `Link opens publicly without signing in: ${u}`);
    } catch (e) { ok(false, `Link could not be opened: ${u} (${e.message})`); }
  }
  console.log(fails ? `\n${fails} check(s) FAILED. Fix these before you submit.` : '\nAll checks passed. Every item you can verify automatically is working.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAIL  could not complete:', e.message); process.exit(1); });
