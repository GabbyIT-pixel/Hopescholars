# Submission checklist (rubric: 30 points)

Create a Google Doc named: `GabrielMugisha_Summative_MMDDYYYY` (use the real date, e.g. `GabrielMugisha_Summative_04112026`). Set sharing to **Anyone with the link: Viewer**. Paste:

| # | What to paste | Rubric row | Done |
|---|---|---|---|
| 1 | Video link (5 to 10 minutes, anyone-with-link) | Presentation (5) and Reflections of requirements (10) | [ ] |
| 2 | GitHub link: https://github.com/GabbyIT-pixel/Hopescholars (public) | Code availability (5) | [ ] |
| 3 | SRS document link (Google Doc, anyone-with-link) | Reflections of requirements (10) | [ ] |
| 4 | Live URL, e.g. https://hope-scholar.onrender.com | Deployment (5) and Operation (5) | [ ] |
| 5 | Demo accounts so the grader can log in (copy the table from the README) | Operation (5) | [ ] |

Put the demo accounts in the doc: student `student@hopescholar.demo` / `Student#2026demo`, provider `provider@hopescholar.demo` / `Provider#2026demo`, admin `admin@hopescholar.demo` / the `ADMIN_PASSWORD` you set on Render.

## How each rubric row is met
- **Requirements reflected (10):** README section "Features mapped to the SRS" maps FR 1.1 to 6.2 and the three actors to screens. Show every actor in the video.
- **Presentation (5):** follow `DEMO_SCRIPT.md` (description, problem, why, solution, demo).
- **Code availability (5):** public repo, README "Quick start" lists every step with troubleshooting.
- **Deployment (5):** Render public HTTPS URL (see README "Deploy"). Render free sleeps when idle, so open the site a minute before grading and mention the 30 second wake-up in the doc.
- **Operation (5):** login, signup, buttons and redirects are covered by 34 tests and `node scripts/verify-live.js <url>`. Anything not working must be stated as a challenge in the doc and video: Google sign-in needs credentials; email reminders and reset emails need SMTP settings.

## Final check (do this in a private/incognito window)
1. `node scripts/verify-live.js https://YOUR-URL --links GITHUB_URL VIDEO_URL SRS_URL DOC_URL`
2. It must end with "All checks passed". Any link that fails here will fail for the grader (score 0 for that item).
3. Submit the Google Doc link on Canvas.
