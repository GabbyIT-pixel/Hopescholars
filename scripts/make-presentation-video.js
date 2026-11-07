'use strict';
// Records the full project presentation (description, problem, solution, demo of every feature, SRS mapping).
// Dev only: needs Playwright + ffmpeg.
//   node scripts/make-presentation-video.js --texts > texts.json          (list of narration lines, for text-to-speech)
//   node scripts/make-presentation-video.js http://localhost:3706 out-dir narration.json
// Start the app first on a fresh database with DEMO_MODE=true (so the reset link shows on screen).
const fs = require('node:fs');

const W = 1280, H = 720;
const stamp = Date.now().toString(36);
const NEW_EMAIL = `student.${stamp}@example.org`, NEW_PASS = 'Welcome#2026ok', NEW_PASS2 = 'Brighter#2026ok';
const LISTING = `Demo Scholarship ${stamp.toUpperCase()}`;

const card = (title, items) => `<!doctype html><meta charset=utf-8><body style="margin:0;height:100vh;background:linear-gradient(135deg,#0b1b33,#17406b);color:#fff;font-family:Figtree,Segoe UI,system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 90px 90px">
<div style="color:#f6b73c;font-weight:800;letter-spacing:.14em;font-size:20px;text-transform:uppercase">Hope Scholar</div>
<h1 style="font-size:54px;margin:10px 0 28px;line-height:1.1">${title}</h1>
<ul style="font-size:30px;line-height:1.5;margin:0;padding-left:34px">${items.map((i) => `<li style="margin-bottom:6px">${i}</li>`).join('')}</ul></body>`;

// Each scene: [caption title, narration text, async (ctx) => action]
const scenes = [
  ['Welcome', 'Welcome to Hope Scholar. In the next few minutes I will show you how to use every part of the platform to find a scholarship and apply with confidence.', async (c) => c.slide('Hope Scholar', ['Find, save and track scholarships', 'For undergraduate students and above', 'Free to use. Never pay to apply'])],
  ['What it is', 'Hope Scholar is a free website that brings scholarships for undergraduate students and above into one place. You tell it about yourself, and it shows you the scholarships that fit, reminds you before deadlines, and helps you keep track of every application.', async (c) => c.slide('What it does', ['Brings scholarships into one place', 'Matches them to your profile', 'Reminds you before deadlines', 'Tracks every application'])],
  ['Why use it', 'Finding scholarships is hard. The information is spread over hundreds of websites, it is often out of date, and some offers are fake. It is easy to miss a deadline or to apply for something you do not qualify for.', async (c) => c.slide('Why use it', ['Information is scattered and outdated', 'Hard to know what you qualify for', 'Deadlines are easy to miss', 'Some offers are fake'])],
  ['How it helps', 'Hope Scholar helps in four ways. Every scholarship comes from an official website, with the date we last checked it. You see how well each one matches you, and why. You get reminders before deadlines. And you track every application in one list.', async (c) => c.slide('How it helps', ['Official sources, with last-checked dates', 'Match score and reasons', 'Deadline reminders', 'One list for all applications'])],
  ['Before we start', 'One important rule. Hope Scholar never asks you for money. You always apply on the official website of the scholarship, and you should never pay anyone to apply.', async (c) => c.slide('Stay safe', ['Always apply on the official website', 'Never pay to apply', 'Check the address of the website'])],
  ['Step 1', 'Step one, find scholarships. You do not even need an account for this. Start on the home page.', async (c) => { await c.go('/'); await c.wait(3500); }],
  ['Home page', 'The home page shows how many scholarships and study destinations are listed, and a search box right at the top. Scroll down to see featured scholarships and how it works.', async (c) => { await c.scroll(650); await c.wait(2500); await c.scroll(700); await c.wait(2500); await c.scroll(-1400); }],
  ['Search', 'To search, type a word in the search box, for example refugee, engineering or master, and press enter. The results show only scholarships that match your word.', async (c) => { await c.type('#hero-q', 'refugee'); await c.wait(500); await c.page.keyboard.press('Enter'); await c.page.waitForLoadState('networkidle'); await c.wait(1500); }],
  ['Filters', 'Use the filters to narrow the list. You can choose your level of study, your field, your country, and the deadline. This way you only see scholarships that are open to you.', async (c) => { await c.go('/scholarships'); await c.safe(() => c.page.selectOption('select[name=level]', { index: 1 })); await c.wait(1800); await c.safe(() => c.page.selectOption('select[name=field]', { index: 2 })); await c.wait(1500); }],
  ['Study abroad', 'Want to study in a particular country? Use Study in. Choose Costa Rica and you see EARTH University. Choose Germany and you see the D A A D scholarships. Searching works for destinations all over the world.', async (c) => { await c.go('/scholarships?study=Costa+Rica'); await c.wait(3500); await c.go('/scholarships?study=Germany'); await c.wait(3000); }],
  ['Open a scholarship', 'Open any scholarship with the Details button. You see what it covers, who can apply, the award value, the deadline, and who offers it.', async (c) => { await c.go('/scholarships?q=EARTH'); await c.page.locator('a:has-text("Details")').first().click(); await c.page.waitForLoadState('networkidle'); await c.wait(3000); await c.scroll(450); await c.wait(2500); }],
  ['Apply safely', 'The apply button takes you to the official website and shows you its real address, so you know it is genuine. A panel also shows where the facts came from and when they were last checked. Always confirm the final details on that official page.', async (c) => { await c.scroll(500); await c.wait(3500); await c.scroll(-950); }],
  ['Step 2', 'Step two, create your free account. This lets the platform match scholarships to you and remember your choices. Enter your name, your email and a strong password. The form tells you the password rules.', async (c) => { await c.go('/register'); await c.wait(2500); }],
  ['Sign up', 'You can also choose Sign up with Google to create an account in one click, without typing a password, once the site owner has switched Google sign-in on. Here I will sign up with email.', async (c) => { await c.wait(1500); await c.fillRegister(); }],
  ['Step 3', 'Step three, complete your profile. Choose your level of study, your field, your country and how much financial help you need. The more accurate your profile, the better your matches.', async (c) => { await c.go('/profile'); await c.wait(2000); await c.safe(() => c.page.selectOption('select[name=education_level]', 'Undergraduate')); await c.safe(() => c.page.selectOption('select[name=field_of_study]', { index: 3 })); await c.safe(() => c.page.selectOption('select[name=country]', 'Rwanda')); await c.safe(() => c.page.selectOption('select[name=financial_need]', 'High')); await c.wait(1500); await c.page.locator('main form button[type=submit]').first().click(); await c.page.waitForLoadState('networkidle'); await c.wait(1500); }],
  ['Step 4', 'Step four, your dashboard. It lists scholarships recommended for you, each with a match score and the reasons it matched. It also learns from the scholarships you save and track.', async (c) => { await c.go('/dashboard'); await c.wait(3500); await c.scroll(450); await c.wait(3000); await c.scroll(-450); }],
  ['Step 5', 'Step five, save a scholarship. Open one you like and press Save. Choose how many days before the deadline you want a reminder.', async (c) => { await c.go('/scholarships?q=EARTH'); await c.page.locator('a:has-text("Details")').first().click(); await c.page.waitForLoadState('networkidle'); await c.wait(1500); await c.safe(() => c.page.locator('form[action$="/save"] button').first().click()); await c.page.waitForLoadState('networkidle'); await c.wait(1500); }],
  ['Saved and alerts', 'Everything you save is in your Saved list. Your reminders appear under Alerts as the deadline gets close, and they can also arrive by email when the site has email switched on.', async (c) => { await c.go('/saved'); await c.wait(3000); await c.go('/notifications'); await c.wait(2500); }],
  ['Step 6', 'Step six, track your application. After you apply on the official website, come back and set a status. You can choose Interested, Preparing, Applied, Interview, Accepted, Rejected or Withdrawn, and add your own notes.', async (c) => { await c.go('/scholarships?q=EARTH'); await c.page.locator('a:has-text("Details")').first().click(); await c.page.waitForLoadState('networkidle'); await c.scroll(300); await c.wait(1200); await c.safe(() => c.page.selectOption('form[action$="/track"] select[name=status]', 'Applied')); await c.wait(1200); await c.safe(() => c.page.locator('form[action$="/track"] button').first().click()); await c.page.waitForLoadState('networkidle'); await c.wait(1000); }],
  ['Your applications', 'The Applications page shows all of your applications and their status, so you always know what to do next.', async (c) => { await c.go('/applications'); await c.wait(3500); }],
  ['Your account', 'Under your name you find account settings, where you can change your details and your password.', async (c) => { await c.go('/account'); await c.wait(3500); }],
  ['Forgot password', 'If you forget your password, choose Forgot password and enter your email. We send you a secure link that works only once and expires after thirty minutes. In this demo the link is shown on screen.', async (c) => { await c.logout(); await c.go('/forgot'); await c.type('input[name=email]', NEW_EMAIL); await c.page.locator('main form button[type=submit]').first().click(); await c.page.waitForLoadState('networkidle'); await c.wait(2000); }],
  ['Reset', 'Open the link and choose a new password.', async (c) => { await c.safe(async () => { await c.page.locator('a[href*="/reset/"]').first().click(); await c.page.waitForLoadState('networkidle'); }); await c.wait(1000); await c.safe(async () => { const f = c.page.locator('input[type=password]'); await f.nth(0).fill(NEW_PASS2); await f.nth(1).fill(NEW_PASS2).catch(() => {}); await c.wait(800); await c.page.locator('main form button[type=submit]').first().click(); await c.page.waitForLoadState('networkidle'); }); await c.wait(1500); }],
  ['Log in', 'To log in, enter your email and password. If you type a wrong password, you get a safe message. After several wrong tries the account is locked for a short time to protect you.', async (c) => { await c.go('/login'); await c.type('#email', NEW_EMAIL); await c.type('#password', 'wrong-Password1'); await c.page.click('button[type=submit]'); await c.page.waitForLoadState('networkidle'); await c.wait(2500); }],
  ['Log in', 'Now I log in with the new password.', async (c) => { await c.go('/login'); await c.type('#email', NEW_EMAIL); await c.type('#password', NEW_PASS2); await c.page.click('button[type=submit]'); await c.page.waitForLoadState('networkidle'); await c.wait(2000); }],
  ['Privacy', 'Your account is private. For example, students cannot open the administrator pages. If you try, you are told you are not allowed.', async (c) => { await c.go('/admin'); await c.wait(3500); }],
  ['Help', 'Stuck? The Help button, bottom right on every page, answers questions about the platform, and also general questions. Type your question and read the answer.', async (c) => { await c.go('/help'); await c.wait(2500); await c.safe(async () => { const box = c.page.locator('#q'); await box.click(); await box.type('How do I apply for a scholarship?', { delay: 55 }); await c.page.keyboard.press('Enter'); }); await c.wait(3500); }],
  ['How to use', 'The How to use page has a short narrated video and written steps for first-time users.', async (c) => { await c.go('/guide'); await c.wait(3500); }],
  ['For providers', 'Now, if you are a scholarship provider, such as a university or a foundation. Create a provider account and log in. You can submit scholarships for students to find.', async (c) => { await c.logout(); await c.login('provider@hopescholar.demo', 'Provider#2026demo'); await c.go('/provider'); await c.wait(2500); }],
  ['Submit a scholarship', 'Fill in the title, a description, who is eligible, the deadline and the official link. All of these are required, so every listing is complete.', async (c) => { await c.go('/provider/new'); await c.fillListing(); }],
  ['Review', 'Your submission is now pending. It is checked by an administrator before students can see it.', async (c) => { await c.wait(3000); await c.go('/scholarships?q=' + encodeURIComponent(LISTING)); await c.wait(2500); }],
  ['For administrators', 'If you are an administrator, the review queue shows every submission waiting for a check.', async (c) => { await c.logout(); await c.login('admin@hopescholar.demo', 'Scholar#Hope2026'); await c.go('/admin'); await c.wait(3500); }],
  ['Verify', 'Verify the listing to publish it, or reject it and give a reason.', async (c) => { await c.verifyNew(); await c.wait(2500); }],
  ['Manage listings', 'Under Listings you can edit, deactivate, reactivate or delete any scholarship, and check that every official link still works.', async (c) => { await c.go('/admin/listings'); await c.wait(3500); await c.scroll(400); await c.wait(2000); await c.scroll(-400); }],
  ['Users', 'Under Users you can disable or enable accounts.', async (c) => { await c.go('/admin/users'); await c.wait(3000); }],
  ['Audit log', 'The audit log records every important administrator action, who did it and when, so changes can always be checked.', async (c) => { await c.go('/admin/audit'); await c.wait(4000); }],
  ['Backups', 'Administrators can also back up the database with one button. Backups are also made automatically every day.', async (c) => { await c.go('/admin'); await c.safe(() => c.page.locator('button:has-text("Back up now")').click()); await c.page.waitForLoadState('networkidle'); await c.wait(3000); }],
  ['Published', 'And now the verified scholarship is visible to students.', async (c) => { await c.go('/scholarships?q=' + encodeURIComponent(LISTING)); await c.wait(3500); }],
  ['Tips', 'Here are three tips. Complete your profile, so your matches are accurate. Save scholarships early and set reminders. And update your status after every step, so you never lose track.', async (c) => c.slide('Three tips', ['Complete your profile for better matches','Save early and set reminders','Update your status after every step'])],
  ['Thank you', 'That is Hope Scholar. Create your free account, complete your profile, and start finding scholarships that fit you. Good luck with your applications.', async (c) => { await c.go('/'); await c.wait(3500); }],
];

if (process.argv[2] === '--texts') { console.log(JSON.stringify(scenes.map((s) => s[1]), null, 1)); process.exit(0); }

const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:3706').replace(/\/$/, '');
const out = process.argv[3] || './presentation-out';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, bypassCSP: true, recordVideo: { dir: out, size: { width: W, height: H } } });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  let durations = {}; try { durations = JSON.parse(fs.readFileSync(process.argv[4] || 'narration.json', 'utf8')); } catch { /* captions only */ }
  const t0 = Date.now(); const log = []; let lastEnd = 0;
  const wait = (ms) => page.waitForTimeout(ms);
  const c = {
    page, wait,
    safe: async (fn) => { try { await fn(); } catch (e) { console.error('step skipped:', String(e.message).split('\n')[0]); } },
    go: async (p) => { await page.goto(base + p); await page.waitForLoadState('networkidle'); await bar().catch(() => {}); },
    scroll: async (dy) => { await page.mouse.wheel(0, dy); await wait(700); },
    type: async (sel, text) => { await page.click(sel); await page.type(sel, text, { delay: 60 }); },
    slide: async (title, items) => { await page.setContent(card(title, items)); await wait(800); await bar().catch(() => {}); },
    logout: async () => { await c.safe(async () => { await page.goto(base + '/'); await page.locator('form[action="/logout"] button').first().click(); await page.waitForLoadState('networkidle'); }); },
    login: async (e, p) => { await c.go('/login'); await c.type('#email', e); await c.type('#password', p); await page.click('button[type=submit]'); await page.waitForLoadState('networkidle'); },
    fillRegister: async () => {
      const f = page.locator('main form');
      await c.safe(async () => { await c.type('input[name=name]', 'Demo Student'); await c.type('input[name=email]', NEW_EMAIL); await page.locator('input[type=password]').first().fill(NEW_PASS); });
      await c.safe(async () => { const n = await page.locator('input[type=password]').count(); if (n > 1) await page.locator('input[type=password]').nth(1).fill(NEW_PASS); });
      await c.safe(async () => { const r = page.locator('select[name=role]'); if (await r.count()) await r.selectOption('student'); });
      await wait(900); await f.locator('button[type=submit]').first().click(); await page.waitForLoadState('networkidle'); await wait(1500);
    },
    fillListing: async () => {
      await c.type('input[name=title]', LISTING); await c.type('input[name=provider]', 'Example Education Trust');
      await page.fill('textarea[name=description]', 'A demonstration scholarship used in the project video to show the provider workflow.');
      await page.fill('textarea[name=eligibility]', 'Undergraduate students in East Africa with strong academic results and financial need.');
      await c.safe(() => page.selectOption('select[name=education_level]', 'Undergraduate'));
      await c.safe(() => page.selectOption('select[name=deadline_type]', 'fixed'));
      await c.safe(() => page.fill('input[name=deadline]', '2027-03-31'));
      await c.type('input[name=award_value]', 'Full tuition');
      await page.fill('input[name=application_url]', 'https://example.org/apply');
      await wait(1200);
      await page.locator('main form button[type=submit]').last().click(); await page.waitForLoadState('networkidle'); await wait(1500);
    },
    verifyNew: async () => {
      await c.go('/admin/listings');
      const row = page.locator('tr', { hasText: LISTING }).first();
      await c.safe(async () => { await row.locator('form[action$="/verify"] button').click(); await page.waitForLoadState('networkidle'); });
      await wait(1200);
    },
  };
  let current = ['', ''];
  const fixCaps = (t) => t.replace(/\bN F R\b/g, 'NFR').replace(/\bF R\b/g, 'FR').replace(/\bS R S\b/g, 'SRS').replace(/\bA L U\b/g, 'ALU').replace(/\bD A A D\b/g, 'DAAD').replace(/\bA I\b/g, 'AI');
  const bar = async () => {
    const [title, text] = current;
    await page.evaluate(([t, x]) => {
      let el = document.getElementById('__cap');
      if (!el) {
        el = document.createElement('div'); el.id = '__cap';
        el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:14px 36px 18px;background:rgba(11,27,51,.94);color:#fff;font:600 22px/1.35 Figtree,system-ui,sans-serif;border-top:4px solid #f6b73c;pointer-events:none';
        document.body.appendChild(el);
      }
      el.textContent = ''; const s = document.createElement('span'); s.style.cssText = 'color:#f6b73c;font-weight:800;margin-right:12px'; s.textContent = t; el.appendChild(s); el.appendChild(document.createTextNode(x));
    }, [title, text]);
  };
  for (const [title, text, action] of scenes) {
    const now = Date.now(); if (lastEnd > now) await wait(lastEnd - now);
    // The caption is re-applied after the action so it stays visible after page navigations.
    log.push({ t: (Date.now() - t0) / 1000, text });
    current = [title, (() => { const f = fixCaps(text); return f.length > 150 ? f.slice(0, 147).replace(/\s+\S*$/, '') + '…' : f; })()];
    await bar().catch(() => {});
    lastEnd = Date.now() + ((durations[text] || 0) * 1000) + 500;
    await action(c).catch((e) => console.error('scene error:', title, String(e.message).split('\n')[0]));
    await bar().catch(() => {});
  }
  if (lastEnd > Date.now()) await wait(lastEnd - Date.now());
  fs.writeFileSync(out + '/captions.json', JSON.stringify(log, null, 1));
  const video = page.video(); await ctx.close(); console.log(await video.path()); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
