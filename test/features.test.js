'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { start, Client } = require('./helpers');
const { match } = require('../src/matching');
const v = require('../src/validate');
const svc = require('../src/services');

let ctx;
test.before(async () => { ctx = await start(); });
test.after(() => ctx.close());

test('matching engine scores profile fit and explains why', () => {
  const profile = { education_level: 'Undergraduate', field_of_study: 'Engineering', country: 'Rwanda', financial_need: 'High' };
  const good = match(profile, { education_level: 'Undergraduate', field_of_study: 'Engineering', country: 'Rwanda', need_based: 1 });
  const bad = match(profile, { education_level: 'PhD', field_of_study: 'Law & Public Policy', country: 'Kenya', need_based: 0 });
  assert.ok(good.score >= 90, 'perfect fit scores high: ' + good.score);
  assert.ok(bad.score < 45 && bad.blockers.length >= 2);
  assert.ok(good.reasons.length >= 3);
});

test('student journey: profile → search → save → remind → track', async () => {
  const c = new Client(ctx.base);
  await c.post('/register', { name: 'New Student', email: 'journey@test.org', password: 'Fresh#Pass1x', confirm: 'Fresh#Pass1x', role: 'student' }, '/register');
  assert.strictEqual((await c.get('/dashboard')).status, 200);
  const prof = await c.post('/profile', { education_level: 'Undergraduate', field_of_study: 'Computer Science / IT', country: 'Rwanda', financial_need: 'High', academic_standing: 'Average', location: 'Kigali' }, '/profile');
  assert.strictEqual(prof.status, 302);

  const list = await c.get('/scholarships?field=' + encodeURIComponent('Computer Science / IT'));
  assert.match(list.text, /% match/);
  const id = ctx.db.prepare("SELECT id FROM scholarships WHERE title LIKE 'Sample: Women in Computing%'").get().id;
  const detail = await c.get('/scholarships/' + id);
  assert.match(detail.text, /Your match/);

  const save = await c.post(`/scholarships/${id}/save`, { remind_days: '30' }, '/scholarships/' + id);
  assert.strictEqual(save.status, 302);
  const user = ctx.db.prepare("SELECT id FROM users WHERE email='journey@test.org'").get();
  assert.ok(ctx.db.prepare('SELECT 1 FROM saved WHERE user_id=? AND scholarship_id=?').get(user.id, id));
  const alerts = await c.get('/notifications');
  assert.match(alerts.text, /Reminder: &#34;Sample: Women in Computing Scholarship&#34; closes/);

  const track = await c.post(`/scholarships/${id}/track`, { status: 'Applied', notes: 'Sent on Friday' }, '/scholarships/' + id);
  assert.strictEqual(track.status, 302);
  const apps = await c.get('/applications');
  assert.match(apps.text, /Sent on Friday/);
  const bad = await c.post(`/scholarships/${id}/track`, { status: 'Hacked' }, '/scholarships/' + id);
  assert.strictEqual(ctx.db.prepare('SELECT status FROM applications WHERE user_id=? AND scholarship_id=?').get(user.id, id).status, 'Applied');
  assert.strictEqual(bad.status, 302);
});

test('students cannot see unpublished listings', async () => {
  const pending = ctx.db.prepare("SELECT id FROM scholarships WHERE status='pending'").get().id;
  const c = new Client(ctx.base);
  await c.login('student@hopescholar.demo', 'Student#2026demo');
  assert.strictEqual((await c.get('/scholarships/' + pending)).status, 404);
  assert.ok(!(await c.get('/scholarships')).text.includes('Community Teachers'));
});

test('provider submits → admin verifies → listing goes live; actions are audited', async () => {
  const p = new Client(ctx.base);
  await p.login('provider@hopescholar.demo', 'Provider#2026demo');
  const bad = await p.post('/provider/new', { title: 'x' }, '/provider/new');
  assert.strictEqual(bad.status, 400);
  const sub = await p.post('/provider/new', {
    title: 'Journey Test Scholarship', provider: 'Test Org', description: 'A scholarship created by the automated test to verify the review flow works.',
    eligibility: 'Any student', education_level: 'Any', field_of_study: 'Any', country: 'Any', deadline: v.today().slice(0, 4) === '' ? '' : new Date(Date.now() + 40 * 86400e3).toISOString().slice(0, 10),
    application_url: 'https://example.org/apply',
  }, '/provider/new');
  assert.strictEqual(sub.status, 302);
  const row = ctx.db.prepare("SELECT * FROM scholarships WHERE title='Journey Test Scholarship'").get();
  assert.strictEqual(row.status, 'pending');
  assert.ok(!(await new Client(ctx.base).get('/scholarships?q=Journey+Test')).text.includes('Journey Test Scholarship'));

  const a = new Client(ctx.base);
  await a.login('admin@hopescholar.demo', 'Scholar#Hope2026');
  assert.match((await a.get('/admin')).text, /Journey Test Scholarship/);
  assert.strictEqual((await a.post(`/admin/listings/${row.id}/verify`, {}, '/admin')).status, 302);
  assert.match((await new Client(ctx.base).get('/scholarships?q=Journey+Test')).text, /Journey Test Scholarship/);
  const audit = ctx.db.prepare("SELECT action FROM audit_log WHERE target LIKE ?").all(`#${row.id}%`).map((r) => r.action);
  assert.ok(audit.includes('LISTING_SUBMITTED') && audit.includes('LISTING_VERIFIED'));

  assert.strictEqual((await a.post(`/admin/listings/${row.id}/deactivate`, {}, '/admin')).status, 302);
  assert.ok(!(await new Client(ctx.base).get('/scholarships?q=Journey+Test')).text.includes('Journey Test Scholarship'));
  assert.match((await p.get('/notifications')).text, /verified and is now live/);
});

test('listing validation rejects past deadlines and unsafe links', () => {
  const base = { title: 'Valid title', provider: 'Org', description: 'd'.repeat(40), eligibility: 'Everyone ok', deadline: '2099-01-01', application_url: 'https://example.org' };
  assert.strictEqual(v.scholarshipInput(base).errors.length, 0);
  assert.ok(v.scholarshipInput({ ...base, application_url: 'javascript:alert(1)' }).errors.length >= 1);
  assert.ok(v.scholarshipInput({ ...base, deadline: '2001-01-01' }).errors.length >= 1);
});

test('expired scholarships are not listed (business rule)', () => {
  ctx.db.prepare("UPDATE scholarships SET deadline = '2001-01-01' WHERE title LIKE 'Sample: Engineering%'").run();
  const { rows } = svc.searchScholarships(ctx.db, { q: 'Engineering Innovators' }, 1, 20);
  assert.strictEqual(rows.length, 0);
});
