# SRS traceability

This file shows where each requirement in the Hope Scholar SRS (v1.1, 26 Oct 2026) is built in the app and how I checked it. The tests are in the `test/` folder and run with `npm test` (33 tests).

Status values: **Met** or **Partly met** (the reason is given in the same row).

## Functional requirements

| ID | Requirement | Where in the app | How it is checked | Status |
|---|---|---|---|---|
| FR 1.1 | Student registration | `/register` (`src/routes/auth.js`) | Test: register, duplicate email, weak password | Met |
| FR 1.2 | Secure login | `/login`; bcrypt, session cookie, lock-out and rate limit | Security tests | Met |
| FR 1.3 | Update account and reset a forgotten password | `/account`, `/forgot`, `/reset/:token` | Tests: reset link is emailed, works once, expires | Met. Email needs SMTP settings; in demo mode the link shows on screen |
| FR 2.1 | Create and update profile (level, field, standing, need, location) | `/profile` | Features test | Met |
| FR 3.1 | Keyword search | Home search box and `/scholarships?q=` (title, provider, description, eligibility, study destination) | Features tests | Met |
| FR 3.2 | Filters: field, level, eligibility, country, deadline | Filters on `/scholarships`, plus "Study in" destination | Features tests | Met |
| FR 3.3 | Details: description, eligibility, value, deadline, provider, how to apply | `/scholarships/:id`, with the official link and the date it was last checked | Features test | Met |
| FR 4.1 | Matching | Match score and reasons (`src/services.js`), shown on `/dashboard` and the cards | Features test | Met |
| FR 4.2 | Recommendations from profile and history | Same scorer; saved and tracked items count towards it | Features test | Met |
| FR 5.1 | Save scholarships | Save and unsave on the details page, `/saved` | Features test | Met |
| FR 5.2 | Deadline reminders | `runReminders`: in-app alerts at `/notifications` and email (`src/mailer.js`) | Test: reminder email | Met. Email needs SMTP settings |
| FR 5.3 | Track status: Interested, Saved, Preparing, Applied, Interview / Next stage, Accepted, Rejected, Withdrawn | Track form on the details page, `/applications` | Features test | Met |
| FR 6.1 | Administrator adds, edits, updates, deactivates and removes listings | `/admin/listings`, new, edit, delete | Features test | Met |
| FR 6.2 | Administrator verifies a listing before it is published | Review queue on `/admin` (verify or reject); provider listings start as pending | Features test | Met |

## Non-functional requirements

| ID | Requirement | How it is met | Status |
|---|---|---|---|
| NFR 1 | About 3 seconds response | Server-rendered pages and indexed SQLite queries. `node scripts/verify-live.js <URL>` times the pages. On the free Render plan the first request after idle takes about 30 seconds. | Met, except the cold start |
| NFR 2 | Available except for planned maintenance | Health route and automatic restart on Render. The free plan sleeps when idle. | Partly met on the free plan |
| NFR 3 | Simple interface | Guided search, the `/guide` walkthrough, the help desk | Met |
| NFR 4 | Works from desktop to phone | Responsive CSS, checked at phone, tablet and desktop widths | Met |
| NFR 5 | Works in Chrome, Firefox and Edge | Standard HTML, CSS and JavaScript with no browser-specific features. Automated checks ran in Chromium (the engine behind Chrome and Edge) only. | Partly verified, Firefox not tested |
| NFR 6 | Scalable | Indexed schema and stateless pages. SQLite runs on one node, so scaling out would need PostgreSQL. | Partly met, prototype scale |
| NFR 7 | Accurate records, little data loss | Foreign keys, transactions, constraints, daily backups | Met |
| NFR 8 | Maintainable | Separate modules for routes, services, validation, security, mail and backups, plus tests | Met |
| NFR 9 | Privacy | Students only see their own data (covered by tests); no personal data in logs | Met |
| NFR 10 | Accessibility | Semantic HTML, form labels, skip link, focus styles, contrast, reduced-motion support | Met, no formal audit |
| NFR 11 | No loss of saved or tracked data | Saved and tracked rows survive listing edits; backups | Met |
| NFR 12 | Authenticate before protected features | `requireLogin` on all account routes | Met |
| NFR 13 | Hashed passwords | bcrypt, cost 12 in production | Met |
| NFR 14 | Role-based access control | Student, provider and admin guards, covered by security tests | Met |
| NFR 15 | HTTPS / TLS | Render provides TLS; production redirects HTTP to HTTPS and uses secure cookies and HSTS | Met on the deployed site |
| NFR 16 | Data used only for legitimate purposes | Only the profile fields needed for matching are collected | Met |
| NFR 17 | Audit log of administrator actions | `/admin/audit` records create, edit, verify, reject, delete and backup | Met |
| NFR 18 | Time-limited recovery | Random single-use token, stored hashed, 30-minute expiry, sent by email | Met. Email needs SMTP settings |
| NFR 19 | Regular backups | `src/backup.js` copies the database daily (newest 7 kept); admins can also press "Back up now" | Met. On the free Render plan the disk is erased on deploy, so a persistent disk is needed for real use |

## Business rules (SRS 5.5)

| Rule | How it is built |
|---|---|
| Personalisation only for registered users | Dashboard, profile, saved and applications need a login |
| Students see and update only their own profile | Queries filter by the session user id (tested) |
| Students cannot edit official scholarship information | Edit routes are for administrators only (tested) |
| Only administrators create, edit, verify and deactivate listings | Provider listings stay pending until an administrator verifies them |
| No publishing without description, eligibility and deadline | Server-side validation in `src/validate.js` |
| Listings whose funding period has ended are not shown | Past deadlines are hidden from active lists; removed programmes are marked inactive |
| The student sets the application status | Track form |
| No guarantee of an award | Stated on the details pages and in the help desk |

## Actors and processes in the system design

| Design element | Implementation |
|---|---|
| Student | Register, log in, profile, search, filter, details, recommendations, save, reminders, tracking |
| Administrator | Review queue, verify or reject, manage listings, users, audit log, backup, link checker |
| Scholarship provider | `/provider`: submit and edit own listings (pending until verified) |
| Notification service | Reminder job, in-app alerts and email (`src/mailer.js`) |
| API gateway and security layer | Express middleware: helmet CSP, rate limiting, sessions, CSRF, role guards |
| Auth service and application service | `src/routes/auth.js`, `src/routes/student.js`, `src/services.js` |
| Database and audit log | SQLite (`src/db.js`), `audit_log` table |
| Use cases: submit listing, review audit log, reset password, role-based access | `/provider/new`, `/admin/audit`, `/forgot`, security tests |

## Known gaps

- Email and the AI help desk only work once the keys listed in `.env.example` are set. Reminders still appear in the app without them.
- Email verification at sign-up is not built. The SRS only asks for an address that can be used for password recovery.
- The app does not encrypt the database file at rest; it relies on the host's disk.
- Cross-browser checks were automated in Chromium only.
- The free hosting plan sleeps when idle and may erase local data when the app is redeployed.
- The SRS mentions secondary-school leavers, but the app lists undergraduate level and above only.
