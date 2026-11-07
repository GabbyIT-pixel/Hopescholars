# Hope Scholar

A secure web platform that helps students from underserved communities **discover, match, save and track scholarships** in one place.
Built from the Hope Scholar SRS and UML design (use case, class, sequence and component diagrams).

**Live demo:** _add your public URL here after deploying (see "Deploy")_  
**Code:** https://github.com/GabbyIT-pixel/Hopescholars  
**Actors:** Student, Scholarship provider, Administrator.

> Hope Scholar does not award scholarships or guarantee outcomes. Students apply on each provider's official website.

## Contents
1. [Quick start (5 minutes)](#quick-start)
2. [Demo accounts](#demo-accounts)
3. [Features mapped to the SRS](#features-mapped-to-the-srs)
4. [Security](#security)
5. [Tests](#tests)
6. [Deploy (public URL)](#deploy)
7. [Project structure](#project-structure)
8. [Known limitations](#known-limitations)

## Quick start

Follow every step in order. It works on Windows (use **Git Bash**), macOS and Linux. No database server, API key or paid account is needed.

**Step 1. Install the tools (once).**
- Node.js **22.5 or newer** (24 is fine) from [nodejs.org](https://nodejs.org) (choose "LTS"), and Git from [git-scm.com](https://git-scm.com).
- Close and reopen your terminal, then check: `node -v` must print `v22.5.0` or higher, and `git --version` must print a version. On Windows, use **Git Bash** for every command below.

**Step 2. Download the code.**
```bash
git clone https://github.com/GabbyIT-pixel/Hopescholars.git
cd Hopescholars
```

**Step 3. Install the dependencies.** Wait until it finishes and returns to the prompt (about 30 seconds). Do not close the terminal.
```bash
npm install
```

**Step 4. Start the app.**
```bash
npm start
```
You should see `Hope Scholar running on http://localhost:3000`.

**Step 5. Open it.** Go to **http://localhost:3000** in your browser. On first start the app creates its own database, an administrator, demo accounts and the 27-scholarship catalogue. Log in with a demo account from the table below.

**Step 6 (optional). Check everything works.**
```bash
npm test                                          # 30 automated tests
node scripts/verify-live.js http://localhost:3000 # walks through login, signup flows, buttons and redirects
```

Stop the server with `Ctrl + C`. Reset all data: stop the server and delete the files in the `data` folder that start with `hopescholar.db`.

**Troubleshooting**
| Problem | Fix |
|---|---|
| `node -v` shows a version below 22.5 | Install the current LTS from nodejs.org and reopen the terminal |
| `Port 3000 is already in use` | Run `PORT=3001 npm start` and open http://localhost:3001 |
| `Cannot find module 'express'` | `npm install` did not finish. Run it again and wait for it to end |
| Login works but the page loops back to login | Use `http://localhost:3000`, not a network address, when running in production mode |
| "Continue with Google" is greyed out | Normal. It needs your own Google credentials, see "Sign in with Google" below. Email sign up works without it |

## Demo accounts

Created automatically outside production (or when `SEED_DEMO=true`).

| Role | Email | Password |
|---|---|---|
| Student | `student@hopescholar.demo` | `Student#2026demo` |
| Scholarship provider | `provider@hopescholar.demo` | `Provider#2026demo` |
| Administrator | `admin@hopescholar.demo` | `Scholar#Hope2026` (or the value of `ADMIN_PASSWORD`) |

You can also create your own student or provider account on the **Sign up** page. Administrator accounts cannot be self-registered.

The only fake item is one clearly labelled **"Demo submission"** waiting in the admin review queue; students never see it.

## Where the scholarship data comes from

There is no free, reliable public API for scholarships in East Africa, and scraping aggregator sites gives out-of-date or wrong dates. So Hope Scholar uses **official sources only**:

1. **Curated catalogue** (`data/scholarships.json`): 27 programmes written from each owner's own website (UNHCR DAFI, Mastercard Foundation Scholars, Chevening, Commonwealth, DAAD, Fulbright, Erasmus Mundus, Australia Awards, Rhodes, Aga Khan, Pan African University, HELB and more). Every record has the official application link, the page the facts came from, and the date it was last checked.
2. **Honest dates.** Most programmes publish next year's dates only shortly before they open. Those show "Dates on the official site" with the programme's own timing note instead of an invented date. Students can add the date they find to get their own reminder.
3. **Country rules.** Where a programme is limited to certain countries (for example Commonwealth: Kenya, Rwanda, Tanzania, Uganda), search and match scores respect it.
4. **Providers and admins** can add listings in the app; an administrator verifies each one.
5. **Link checker.** Admin > Listings > "Check official links" (or `npm run check-links`) tests every official link and flags broken ones.

To update the data: edit `data/scholarships.json` (keep `official_url`, `source_url`, `last_verified`, and a `deadline_note` when there is no fixed date), then restart the app or run `npm run import`. Records removed from the file are hidden, not deleted. Review the file every few months and before each application season.

## Features mapped to the SRS

| SRS requirement | Where to see it |
|---|---|
| **FR 1.1** Student registration | `/register` |
| **FR 1.2** Secure login | `/login` (hashed passwords, lockout, audit), plus optional **Continue with Google** |
| **FR 1.3** Update account, secure password reset | `/account`, `/forgot` → `/reset/<token>` |
| **FR 2.1** Create/update profile | `/profile` (level, field, country, need, standing) |
| **FR 3.1** Keyword search | `/scholarships` search box |
| **FR 3.2** Filters (field, level, **study destination anywhere in the world**, your country, deadline, need) | filter bar on `/scholarships`; keyword search also matches the country (e.g. "Costa Rica") |
| **FR 3.3** Scholarship details | `/scholarships/:id` (description, eligibility, award, deadline, provider, how to apply) |
| **FR 4.1** Scholarship matching | match % and reasons on cards and detail pages (`src/matching.js`) |
| **FR 4.2** Personalised recommendations | "Recommended for you" on `/dashboard` (profile + saved-topic history) |
| **FR 5.1** Save scholarships | "Save scholarship" button, `/saved` |
| **FR 5.2** Deadline reminders | in-app alerts (`/notifications`) created before each saved deadline |
| **FR 5.3** Application tracking | status + notes on detail page, `/applications` (Interested → Accepted/Rejected/Withdrawn) |
| **FR 6.1** Listing management | `/admin/listings` (add, edit, deactivate, reactivate, delete) |
| **FR 6.2** Listing verification | `/admin` review queue (verify or reject with reason) |
| Provider submits listings (use case diagram) | `/provider`, `/provider/new` |
| Review audit log (use case diagram) | `/admin/audit` |
| Help desk (extra) | Floating **Help** button on every page and `/help` page: instant answers about the platform, live answers (open scholarships, your own deadlines), and an optional general AI assistant |
| Official application (FR 3.3) | "Apply on the official website" button on every detail page, with the provider's own address and a "last checked" date |
| Sign in with Google (FR 1.2) | `/auth/google` (OpenID Connect with PKCE), active once credentials are set |
| **NFR 3/4/5/10** usability, responsive, accessible | mobile-first CSS, skip link, labels, focus styles, no JavaScript required |
| **NFR 1** performance | server-rendered light pages, SQLite indexes |

## Security

Implemented to match SRS NFR 9 and NFR 12 to 19 and the component diagram:

- **Passwords** hashed with bcrypt (never stored in plain text); password policy (10+ chars, mixed case, number, not common).
- **Sessions**: random 256-bit ids, only a SHA-256 hash is stored server-side; `HttpOnly`, `SameSite=Lax`, `Secure` in production; id rotated at login (no session fixation); 30 min idle / 12 h absolute expiry; all sessions revoked on password reset.
- **CSRF** protection (synchroniser token) on every state-changing request.
- **RBAC** on every route (student / provider / admin); denied attempts are audited.
- **Brute-force protection**: per-account lockout after 5 failures plus per-IP rate limits; identical error messages and timing for unknown emails (no user enumeration).
- **Password reset**: single-use token, stored hashed, expires in 30 minutes, same response whether or not the email exists.
- **Injection**: all SQL is parameterised; every page output is HTML-escaped; strict Content-Security-Policy (no inline scripts, same-origin only); input validation and length limits; only `http(s)` links accepted.
- **Transport**: HTTPS enforced in production via HSTS and secure cookies (your host terminates TLS).
- **Audit log** of logins (success and failure), account changes and every administrative action.
- **Data minimisation**: only the profile fields needed for matching are collected.
- Pages are served with `Cache-Control: no-store`.

## Sign in with Google (optional)

The "Continue with Google" / "Sign up with Google" button is shown on the Log in and Sign up pages. It is **greyed out until you add your own Google credentials** (Google requires every website to register its own).

1. Open [console.cloud.google.com](https://console.cloud.google.com) > create a project > **APIs & Services > OAuth consent screen** (External, add your email as a test user) > **Credentials > Create credentials > OAuth client ID > Web application**.
2. Under **Authorized redirect URIs** add exactly:
   - for your computer: `http://localhost:3000/auth/google/callback`
   - for your live site: `https://YOUR-APP.onrender.com/auth/google/callback`
3. Copy the **Client ID** and **Client secret**.
4. On your computer run `npm run setup:google` (it asks for the two values and saves them in `.env`), then restart `npm run dev`. Full guide with every click: [docs/GOOGLE_SIGNIN.md](docs/GOOGLE_SIGNIN.md).
   On Render: **Environment > Add** the same two variables, and set `PUBLIC_URL=https://YOUR-APP.onrender.com`. Render redeploys by itself.
5. Reload the Sign up page: the Google button is now active.

Only the name and verified email are received. Administrator accounts cannot use Google. If the email already has a password account, the accounts are linked and the old password is switched off.

## Help desk assistant

Every page has a **Help** button (and `/help` lists common questions). It works with no setup using a built-in knowledge base and live data (open scholarships, a signed-in student's own deadlines and profile status). Set `ANTHROPIC_API_KEY` (from console.anthropic.com) to turn the help desk into a general AI assistant: it then answers any question (school work, CVs, essays, careers, coding, general knowledge) as well as questions about the platform, and remembers the last few turns of the chat. The model is set with `HELPDESK_MODEL` (default `claude-sonnet-5-5`; use `claude-haiku-5-5` for lower cost). Without a key it only answers platform questions and says so. On any API error it falls back to the built-in answers. Limits: 1000 characters per question, 20 per minute and 300 per day per connection; answers are shown as plain text.

## Email, backups and HTTPS

- **Email** (password-reset links and deadline reminders): set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` (see `.env.example`). Without them the app still shows in-app alerts, and with `DEMO_MODE=true` it shows the reset link on screen.
- **Backups**: the server copies the database to `data/backups/` once a day (newest 7 kept). Admins can also press **Back up now** on the admin page. On hosts that erase the disk on deploy, attach a persistent disk.
- **HTTPS**: in production, plain HTTP requests are redirected to HTTPS.
- Full requirement-by-requirement evidence: [docs/SRS_TRACEABILITY.md](docs/SRS_TRACEABILITY.md).

## Tests

```bash
npm test
```

30 automated tests (plus `node scripts/verify-live.js <url>`, which checks a running site end to end) cover hashing, weak-password rejection, CSRF, session rotation, generic login errors, lockout, RBAC, SQL injection, XSS escaping, security headers, password-reset rules, the matching engine, the student journey (profile → search → save → remind → track) and the provider → admin verification flow.

## Deploy

The app is a single Node process with a SQLite file, so it runs on any Node host or in Docker.

### Render (free tier, public HTTPS URL)
1. Push this repository to GitHub (public).
2. On [render.com](https://render.com): **New + → Blueprint**, pick the repository. `render.yaml` configures everything.
3. When asked, type a strong `ADMIN_PASSWORD` (12+ characters, upper/lower case and a number).
4. After the build finishes, open the `https://<name>.onrender.com` URL. Put it in this README and in your submission.

Free instances sleep when idle (first load may take about 30 seconds) and their disk is erased on each deploy; the seed runs again automatically on an empty database, so the demo always starts with sample data. For real use, attach a persistent disk and set `DB_PATH` to it.

### Docker
```bash
docker build -t hope-scholar .
docker run -p 3000:3000 -e ADMIN_PASSWORD='ChangeMe#2026x' -e SEED_DEMO=true -v hs-data:/app/data -e DB_PATH=/app/data/hs.db hope-scholar
```
Note: `NODE_ENV=production` uses secure cookies, so log in over HTTPS (or run behind a TLS proxy).

### Environment variables
See `.env.example`. **`DEMO_MODE=true` shows password-reset links on screen because no email service is connected; never enable it for real students.**

## Project structure

```
hope-scholar/
├── server.js              # entry point: start, seed, reminder job
├── src/
│   ├── app.js             # Express app: headers, CSP, rate limits, routes
│   ├── config.js          # settings from environment variables
│   ├── db.js              # SQLite schema
│   ├── security.js        # hashing, sessions, CSRF, RBAC, audit log
│   ├── helpdesk.js        # help desk assistant (knowledge base + optional AI)
│   ├── validate.js        # input validation and allowed values
│   ├── matching.js        # scholarship matching engine
│   ├── services.js        # search, recommendations, reminders
│   ├── catalogue.js       # loads the official-source catalogue
│   ├── linkcheck.js       # official link checker
│   ├── seed.js            # admin, demo accounts, catalogue
│   └── routes/            # auth, google, help, student, scholarships, provider, admin
├── data/scholarships.json # curated catalogue (official sources)
├── scripts/               # import-catalogue.js, check-links.js
├── views/                 # EJS templates (auto-escaped)
├── public/                # CSS, small progressive-enhancement script, icon
├── test/                  # automated tests
├── Dockerfile  render.yaml  .env.example  .github/workflows/ci.yml
```

## Known limitations

- Reminders are in-app alerts; email/SMS delivery is a future increment (the SRS lists an external notification service as a dependency).
- Applications are completed on each provider's own site (as stated in the SRS scope).
- SQLite suits a pilot; move to PostgreSQL for large scale.
- Scholarship provider API integration is out of scope for this release, as in the SRS.

## Licence
MIT
