# SRS and rubric traceability

Maps every requirement in the Hope Scholar SRS (v1.1, 26 Oct 2026) to the place it is implemented and how it is proven.
Status values: **Met**, **Partly met** (with the reason), **Needs your action** (depends on keys or hosting you control).
Tests are in `test/` (run `npm test`, 34 tests).

## Functional requirements

| ID | Requirement | Where in the app | Evidence | Status |
|---|---|---|---|---|
| FR 1.1 | Student registration | `/register` (`src/routes/auth.js`), optional Google sign-up (`src/routes/google.js`) | features test: register + duplicate email + weak password | Met (Google needs your OAuth keys) |
| FR 1.2 | Secure login | `/login`, bcrypt, session cookie, lock-out and rate limit | security tests | Met |
| FR 1.3 | Update account, reset forgotten password | `/account`, `/forgot`, `/reset/:token` | features + v2 tests (reset link emailed, one use, expires) | Met (email needs SMTP settings; demo mode shows the link on screen) |
| FR 2.1 | Create/update profile (level, field, standing, need, location) | `/profile` | features test | Met |
| FR 3.1 | Keyword search | home finder, `/scholarships?q=` (title, provider, description, eligibility, study destination) | features + v2 tests | Met |
| FR 3.2 | Filters: field, level, eligibility, country, deadline | `/scholarships` filters plus "Study in" destination | features + v2 tests | Met |
| FR 3.3 | Details: description, eligibility, value, deadline, provider, how to apply | `/scholarships/:id` with official link and "last verified" | features test | Met |
| FR 4.1 | Matching | `src/services.js` match score and reasons, `/dashboard` | features test | Met |
| FR 4.2 | Recommendations from profile and interaction history | same scorer uses saved and tracked items | features test | Met |
| FR 5.1 | Save scholarships | Save/unsave on the details page, `/saved` | features test | Met |
| FR 5.2 | Deadline reminders | `runReminders` (in-app alerts at `/notifications`, plus email via `src/mailer.js`) | v2 test (reminder email) | Met (email needs SMTP settings) |
| FR 5.3 | Track status: Interested, Saved, Preparing, Applied, Interview / Next stage, Accepted, Rejected, Withdrawn | Track form, `/applications` | features test | Met |
| FR 6.1 | Admin add, edit, update, deactivate, remove listings | `/admin/listings`, `/admin/listings/new`, edit, delete | features test | Met |
| FR 6.2 | Admin verifies before publishing | Review queue on `/admin` (verify/reject); provider listings start as pending | features test | Met |

## Non-functional requirements

| ID | Requirement | How it is met | Status |
|---|---|---|---|
| NFR 1 | About 3 s response | Server-rendered pages, indexed SQLite queries. Run `node scripts/verify-live.js <URL>` to time pages. Free Render tier needs about 30 s to wake after idling. | Met (cold start excepted) |
| NFR 2 | Available except planned maintenance | Health route, auto-restart on Render. Free tier sleeps when idle. | Partly met on free tier |
| NFR 3 | Simple interface | Guided finder, `/guide` walkthrough video, help desk | Met |
| NFR 4 | Desktops to phones | Responsive CSS, tested at phone, tablet, desktop widths | Met |
| NFR 5 | Chrome, Firefox, Edge | Standard HTML/CSS/JS, no browser-specific features. Automated checks were run in Chromium (the engine of Chrome and Edge) only. | Partly verified: please click through once in Firefox |
| NFR 6 | Scalable | Indexed schema, stateless pages. SQLite is one node; move to PostgreSQL to scale out. | Partly met (prototype scale) |
| NFR 7 | Accurate records, minimal data loss | Foreign keys, transactions, constraints, daily backups | Met |
| NFR 8 | Maintainable | Separate routes, services, validation, security, mailer, backup modules; tests | Met |
| NFR 9 | Privacy | Students see only their own data (checked in tests); no personal data in logs | Met |
| NFR 10 | Accessibility | Semantic HTML, labels, skip link, focus styles, contrast, reduced-motion support | Met (no formal audit) |
| NFR 11 | No loss of saved or tracked data | Saved/tracked rows survive listing edits; backups | Met |
| NFR 12 | Authenticate before protected features | `requireLogin` on all account routes | Met |
| NFR 13 | Hashed passwords | bcrypt (cost 12 in production) | Met |
| NFR 14 | Role-based access | Student / provider / admin guards, checked in security tests | Met |
| NFR 15 | HTTPS/TLS | Render provides TLS; production redirects HTTP to HTTPS; secure cookies, HSTS | Met on the deployed site |
| NFR 16 | Data used only for legitimate purposes | Only profile fields needed for matching are collected | Met |
| NFR 17 | Audit log of admin actions | `/admin/audit` records create, edit, verify, reject, delete, backup | Met |
| NFR 18 | Time-limited recovery | Random single-use token, hashed in the database, 30 minute expiry, sent by email | Met (email needs SMTP settings) |
| NFR 19 | Regular backups | `src/backup.js`: a consistent copy of the database every day (newest 7 kept), plus an admin "Back up now" button | Met. On Render's free plan the disk is erased on deploy, so use a persistent disk or download copies. |

## Business rules (SRS 5.5)

| Rule | Implementation |
|---|---|
| Personalisation only for registered users | Dashboard, profile, saved, applications require login |
| Students see and update only their own profile | Queries filter by session user id (tested) |
| Students cannot edit official scholarship information | Edit routes are admin only (tested) |
| Only admins create, edit, verify, deactivate listings | Provider listings stay pending until an admin verifies |
| No publishing without description, eligibility and deadline | Server validation in `src/validate.js` |
| Ended funding periods are not listed | Past deadlines are hidden from active lists; the catalogue marks removed programmes inactive |
| Status is set by the student | Track form |
| No guarantee of award | Stated on details pages and in the help desk |

## Actors and processes in the system design

| Design element | Implementation |
|---|---|
| Student | Register, log in, profile, search, filter, details, recommendations, save, reminders, tracking |
| Administrator | Review queue, verify/reject, manage listings, users, audit log, backup, link checker |
| Scholarship Provider | `/provider`: submit and edit own listings (pending until verified) |
| Notification Service | Reminder job, in-app alerts and email (`src/mailer.js`) |
| API gateway / security layer | Express middleware: helmet CSP, rate limiting, session, CSRF, RBAC guards |
| Auth service, application service | `src/routes/auth.js`, `src/routes/student.js`, `src/services.js` |
| Database and audit log | SQLite (`src/db.js`), `audit_log` table |
| Use cases: submit listing, review audit log, reset password, RBAC | `/provider/new`, `/admin/audit`, `/forgot`, security tests |

## Rubric

| Criterion (points) | Where it is covered | What only you can do |
|---|---|---|
| Reflections of the requirements (10) | Tables above; the video walks through every feature | Nothing |
| Presentation (5) | Narrated video script in `DEMO_SCRIPT.md` | Record the video in your own voice, 5 to 10 minutes |
| Code availability (5) | Public repo and a step-by-step README Quick start | Keep the repo public; check the README on a clean machine |
| Deployment (5) | `render.yaml`, README Deploy section | Deploy to Render and put the live URL in the README and Google Doc |
| Operation (5) | 34 tests pass; `scripts/verify-live.js` checks the live site | Run it against your live URL; mention any known limits in the video |

## Known gaps, stated honestly

- Google sign-up, AI help desk answers and email only work after you add the keys listed in `.env.example`.
- Account email verification at sign-up is not implemented (the SRS asks only for a verifiable address for password recovery).
- The database file is not encrypted at rest by the app; it relies on the host's disk.
- Cross-browser testing was automated in Chromium only.
- Free hosting sleeps when idle and may erase local data on deploy.
- The SRS mentions secondary-school leavers; by your decision the app lists undergraduate and above only.
