'use strict';
// npm run check-links : verify every official link and print the ones that need attention.
const config = require('../src/config');
const { openDb } = require('../src/db');
const { checkLinks } = require('../src/linkcheck');

const db = openDb(config.dbPath);
checkLinks(db, { limit: 500 }).then((r) => {
  console.log(`Checked ${r.checked} links: ${r.ok} ok, ${r.blocked} blocked (open manually), ${r.broken} broken.`);
  for (const row of db.prepare("SELECT title, application_url, link_status FROM scholarships WHERE status = 'verified' AND link_status = 'broken'").all()) {
    console.log(`BROKEN  ${row.title}\n        ${row.application_url}`);
  }
});
