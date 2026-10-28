'use strict';
process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'true';
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const { seed } = require('../src/seed');

async function start() {
  process.env.ADMIN_PASSWORD = 'Scholar#Hope2026';
  process.env.SEED_DEMO = 'true';
  const db = openDb(':memory:');
  await seed(db);
  const app = createApp(db);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, server, base, close: () => server.close() };
}

/** Tiny browser-like client: keeps cookies, follows no redirects, extracts CSRF tokens. */
class Client {
  constructor(base) { this.base = base; this.jar = {}; }
  _cookieHeader() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '); }
  async req(method, path, body) {
    const headers = { cookie: this._cookieHeader() };
    let payload;
    if (body) { headers['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(body).toString(); }
    const res = await fetch(this.base + path, { method, headers, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';'); const i = kv.indexOf('=');
      const name = kv.slice(0, i); const val = kv.slice(i + 1);
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)) delete this.jar[name]; else this.jar[name] = val;
    }
    const text = await res.text();
    return { status: res.status, text, location: res.headers.get('location'), headers: res.headers };
  }
  get(path) { return this.req('GET', path); }
  async csrf(path = '/login') { const r = await this.get(path); const m = r.text.match(/name="_csrf" value="([^"]+)"/); return m ? m[1] : null; }
  async post(path, body, csrfFrom) { const t = await this.csrf(csrfFrom || path); return this.req('POST', path, { ...body, _csrf: t }); }
  async login(email, password) { return this.post('/login', { email, password }, '/login'); }
}

module.exports = { start, Client };
