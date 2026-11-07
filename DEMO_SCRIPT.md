# Hope Scholar: demo video script (target 7 to 8 minutes; the rubric requires 5 to 10)

Record your screen and your voice (Zoom, Loom, OBS or the built-in recorder). Quiet room, speak slowly, test the audio first. Use the **live public URL**. Upload to YouTube (Unlisted) or Google Drive set to "Anyone with the link can view", then open the link in a private window to confirm it plays.

**0:00 Who you are and what the system is (45 s)** (rubric: description of the system, presentation)
"Hello, I'm Gabriel Mugisha, a Software Engineering student at ALU. This is Hope Scholar, a web platform that helps students from underserved communities, such as refugees and rural students in East Africa, to discover, match, save and track scholarships in one place. It has three actors: the student, the scholarship provider and the administrator."

**0:45 Problem statement and why it is a problem (60 s)**
"Scholarship information is scattered across hundreds of websites, often out of date, and many students have slow internet and limited guidance. They cannot tell which scholarships they qualify for, they miss deadlines, and some fall for fake offers that ask for fees. The result is that talented students never apply, and education, the best way out of poverty, stays out of reach."

**1:45 Proposed solution (45 s)**
"Hope Scholar collects scholarships from official sources only, shows how well each one matches the student's profile, lets students save a shortlist, reminds them before deadlines, tracks every application, and sends them to the official website to apply. An administrator verifies every listing, and a help desk assistant answers questions."

**2:30 Demo: public pages, no account (60 s)** (FR 3.1 to 3.3)
Show the cover page and its motion. Click *Browse all programmes*. Search "refugee", use the Field, Level, Country filters. Open one scholarship: point at the official apply button with the real address, and "Where this information comes from" with the last-checked date.

**3:30 Demo: student (150 s)** (FR 1.1, 1.2, 2.1, 4.1, 4.2, 5.1 to 5.3)
Sign up (show the password rules; mention the Google button and that it needs credentials). Fill the profile. Show the dashboard recommendations and match percentages, then a scholarship's "Why it matches". Click *Save* with a 7-day reminder, show Saved and Alerts, set the status to *Applied* with a note, show the Applications tracker. Log out.

**6:00 Demo: provider and administrator (75 s)** (FR 6.1, 6.2)
Log in as the provider, open *Add scholarship*, and submit one. Log out, log in as the admin: verify it in the review queue, show Manage listings (edit/deactivate), Users, and the Audit log. Show that the verified listing now appears to students.

**7:15 Help desk, security and access control (45 s)**
Open the Help button and ask one platform question and one general question. Then: "Passwords are hashed, accounts lock after repeated failures, every form has CSRF protection, access is role-based, and every admin action is logged." As a student open /admin and show *Not allowed*.

**8:00 Requirements, design, challenges, close (45 s)**
"The prototype implements the SRS requirements FR 1.1 to 6.2 and the actors and processes in the use case, class, sequence and component diagrams; the README has the full mapping. Challenges: there is no reliable free scholarship API, so I curated the data from official sites and show honest date notes; free hosting sleeps when idle; Google sign-in and the AI assistant need the owner's own keys. The code is public on GitHub with step-by-step setup, and the live site is at <your URL>. Thank you."

**Before you record:** run `node scripts/verify-live.js <your URL>` and make sure it prints "All checks passed".


## Ready-made tutorial video (6:25)

`scripts/make-presentation-video.js` re-creates a narrated tutorial for students and applicants: what the platform does, then how to use every feature step by step (search, filters, study destination, official apply link, sign-up, profile, recommendations, save and reminders, tracking, account and password reset, help desk), followed by short sections for providers and administrators. The course rubric asks for a **self-recorded** video that also covers the SRS and system design, so record your own using the script above and use this video as a user guide.
