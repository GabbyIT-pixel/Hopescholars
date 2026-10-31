# Hope Scholar

A secure web platform that helps students from underserved communities **discover, match, save and track scholarships** in one place.
Built from the Hope Scholar SRS and UML design (use case, class, sequence and component diagrams).

**Live demo:** _add your public URL here after deploying (see "Deploy")_

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

Requirements: **Node.js 22.5 or newer (Node 24 works too)** ([nodejs.org](https://nodejs.org)) and Git. No database server is needed (it uses a local SQLite file).

```bash
git clone https://github.com/<your-username>/hope-scholar.git
cd hope-scholar
npm install
npm start
```

Open **http://localhost:3000**. On the first start the app creates the database, an administrator account, demo accounts and sample scholarships automatically.

Run it in development mode with auto-restart: `npm run dev`.
Reset everything: stop the server and delete the `data/hopescholar.db*` files.

## Demo accounts

Created automatically outside production (or when `SEED_DEMO=true`).

| Role | Email | Password |
|---|---|---|
| Student | `student@hopescholar.demo` | `Student#2026demo` |
| Scholarship provider | `provider@hopescholar.demo` | `Provider#2026demo` |
| Administrator | `admin@hopescholar.demo` | `Scholar#Hope2026` (or the value of `ADMIN_PASSWORD`) |

You can also create your own student or provider account on the **Sign up** page. Administrator accounts cannot be self-registered.

Scholarships titled **"Sample: ..."** are demonstration data. Others are real programmes summarised for demonstration; always confirm details on the provider's site.

## Features mapped to the SRS

| SRS requirement | Where to see it |
|---|---|
| **FR 1.1** Student registration | `/register` |
| **FR 1.2** Secure login | `/login` (hashed passwords, lockout, audit), plus optional **Continue with Google** |
| **FR 1.3** Update account, secure password reset | `/account`, `/forgot` → `/reset/<token>` |
| **FR 2.1** Create/update profile | `/profile` (level, field, country, need, standing) |
| **FR 3.1** Keyword search | `/scholarships` search box |
| **FR 3.2** Filters (field, level, country, deadline, need) | filter bar on `/scholarships` |
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
| Help desk (extra) | Floating **Help** button on every page and `/help` page: instant answers about the platform, live answers (open scholarships, your own deadlines) |
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

The "Continue with Google" button appears only when you set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID** → type **Web application** (set up the consent screen first if asked: External, add your email as a test user).
2. Add **Authorised redirect URIs**:
   - `http://localhost:3000/auth/google/callback` (local)
   - `https://<your-app>.onrender.com/auth/google/callback` (deployed)
3. Local: copy the values into a `.env`-style shell export before `npm start`:
   ```bash
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=xxxx npm start
   ```
   Render: **Environment** tab → add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` → save (it redeploys).

Security: authorization-code flow with PKCE (S256), `state` and `nonce` checks, id-token issuer/audience/expiry/verified-email checks, HttpOnly short-lived OAuth cookie. Administrator accounts cannot use Google. If someone signs in with Google using an email that already has a password account, the accounts are linked and the old password is disabled (stops anyone who pre-registered that email).

## Help desk assistant

Every page has a **Help** button (and `/help` lists common questions). It works with no setup using a built-in knowledge base and live data (open scholarships, a signed-in student's own deadlines and profile status). Optional: set `ANTHROPIC_API_KEY` and the Claude API writes the replies, restricted to the same knowledge base; on any error it falls back to the built-in answer. Questions are limited to 300 characters and 12 per minute per connection; answers are shown as plain text.

## Tests

```bash
npm test
```

25 automated tests cover hashing, weak-password rejection, CSRF, session rotation, generic login errors, lockout, RBAC, SQL injection, XSS escaping, security headers, password-reset rules, the matching engine, the student journey (profile → search → save → remind → track) and the provider → admin verification flow.

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
│   ├── seed.js            # admin, demo accounts, sample scholarships
│   └── routes/            # auth, google, help, student, scholarships, provider, admin
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
