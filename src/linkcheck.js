'use strict';
// Checks that each listing's official link still opens. Many official sites refuse automated requests (403/429);
// those are reported as "blocked" (open manually), not "broken". Only public https addresses are ever requested.
const net = require('net');
const sec = require('./security');

function safeTarget(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') return false;
    const h = url.hostname.toLowerCase();
    if (net.isIP(h) || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return false;
    return true;
  } catch { return false; }
}

async function checkOne(url) {
  if (!safeTarget(url)) return 'broken';
  const opts = { redirect: 'follow', signal: AbortSignal.timeout(9000), headers: { 'user-agent': 'HopeScholarLinkCheck/1.0 (+scholarship link verification)', accept: 'text/html,*/*' } };
  try {
    let res = await fetch(url, { ...opts, method: 'HEAD' });
    if (res.status === 405 || res.status === 403 || res.status === 400) res = await fetch(url, { ...opts, signal: AbortSignal.timeout(9000), method: 'GET' });
    if (res.status < 400) return 'ok';
    if ([401, 403, 429, 999].includes(res.status)) return 'blocked';
    return 'broken';
  } catch { return 'broken'; }
}

/** Checks verified listings (oldest check first). Returns counts. */
async function checkLinks(db, { limit = 60, concurrency = 5 } = {}) {
  const rows = db.prepare("SELECT id, application_url FROM scholarships WHERE status = 'verified' ORDER BY COALESCE(link_checked_at, 0) ASC LIMIT ?").all(limit);
  const upd = db.prepare('UPDATE scholarships SET link_status = ?, link_checked_at = ? WHERE id = ?');
  const counts = { ok: 0, blocked: 0, broken: 0 };
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (i < rows.length) {
      const r = rows[i++];
      const status = await checkOne(r.application_url);
      upd.run(status, sec.now(), r.id);
      counts[status]++;
    }
  }));
  return { checked: rows.length, ...counts };
}

module.exports = { checkLinks, checkOne, safeTarget };
