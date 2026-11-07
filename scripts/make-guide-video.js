'use strict';
// Re-creates public/media/guide.mp4: films the real app with on-screen captions.
// Needs Playwright + ffmpeg (dev only):  npm i -D playwright && npx playwright install chromium
// Usage: start the app on a fresh database (PORT=3705 DB_PATH=/tmp/guide.db node server.js), then
//        node scripts/make-guide-video.js http://localhost:3705 out-dir
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:3705').replace(/\/$/, '');
const out = process.argv[3] || './guide-out';

const W = 1280, H = 720;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, bypassCSP: true, recordVideo: { dir: out, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  // Narration support: optional narration.json ({ "caption text": seconds }) makes each scene last at least as long as its spoken line.
  let durations = {}; try { durations = JSON.parse(require('fs').readFileSync(process.argv[4] || 'narration.json', 'utf8')); } catch { /* captions only */ }
  const t0 = Date.now(); const log = []; let lastEnd = 0;
  const cap = async (title, text) => {
    const now = Date.now(); if (lastEnd > now) await page.waitForTimeout(lastEnd - now);
    log.push({ t: (Date.now() - t0) / 1000, text }); lastEnd = Date.now() + ((durations[text] || 0) * 1000) + 450;
    await page.evaluate(([t, x]) => {
      let el = document.getElementById('__cap');
      if (!el) {
        el = document.createElement('div'); el.id = '__cap';
        el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:16px 36px 20px;background:rgba(11,27,51,.94);color:#fff;font:600 24px/1.35 Figtree,system-ui,sans-serif;border-top:4px solid #f6b73c;pointer-events:none';
        document.body.appendChild(el);
      }
      el.innerHTML = '<span style="color:#f6b73c;font-weight:800;margin-right:12px"></span>';
      el.firstChild.textContent = t; el.appendChild(document.createTextNode(x));
    }, [title, text]);
  };
  const go = async (path) => { await page.goto(base + path); await page.waitForLoadState('networkidle'); };
  const wait = (ms) => page.waitForTimeout(ms);
  const type = async (sel, text) => { await page.click(sel); await page.type(sel, text, { delay: 70 }); };

  // 1. Home
  await go('/'); await cap('Welcome', 'Hope Scholar helps you find scholarships you can actually apply for.'); await wait(4500);
  await page.mouse.wheel(0, 700); await wait(2500);
  await cap('Honest data', 'Every scholarship comes from an official website and shows when we last checked it.'); await wait(3500);
  await page.mouse.wheel(0, -700); await wait(800);

  // 2. Search
  await cap('Step 1', 'Search without an account. Type a word like "refugee" or "master".');
  await type('#hero-q', 'refugee'); await wait(800); await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle'); await wait(1500);
  await cap('Step 1', 'Use the filters: field, level, country and deadline. Hope Scholar covers undergraduate and above.');
  await page.selectOption('select[name=level]', { index: 1 }).catch(() => {}); await wait(3500);

  // 3. A scholarship page
  await go('/scholarships?q=Mastercard');
  await cap('Step 2', 'Open a scholarship. Each Mastercard partner university is listed directly.'); await wait(3500);
  await page.locator('a:has-text("Details")').first().click(); await page.waitForLoadState('networkidle');
  await cap('Step 2', 'You see who can apply, what it covers, and the real deadline notes.'); await wait(4000);
  await page.mouse.wheel(0, 500); await wait(1500);
  await cap('Step 2', 'The Apply button opens the official website, shown with its real address.'); await wait(4500);
  await page.mouse.wheel(0, -500);

  // 4. Sign up page
  await go('/register'); await cap('Step 3', 'Create a free account with your email, or tap "Sign up with Google" for one click.'); await wait(5500);

  // 5. Log in as the demo student
  await go('/login'); await cap('Step 4', 'Log in. (Here we use the demo student account.)');
  await type('#email', 'student@hopescholar.demo'); await type('#password', 'Student#2026demo'); await wait(600);
  await page.click('button[type=submit]'); await page.waitForLoadState('networkidle'); await wait(1500);

  // 6. Profile
  await go('/profile'); await cap('Step 5', 'Fill in your profile once: level, field, country and need.'); await wait(2500);
  await page.selectOption('select[name=education_level]', 'Undergraduate'); await wait(700);
  await page.selectOption('select[name=field_of_study]', { index: 3 }); await wait(700);
  await page.selectOption('select[name=country]', 'Rwanda').catch(() => {}); await wait(700);
  await page.selectOption('select[name=financial_need]', 'High').catch(() => {}); await wait(1500);
  await page.locator('main form button[type=submit]').first().click(); await page.waitForLoadState('networkidle'); await wait(1500);

  // 7. Dashboard
  await go('/dashboard'); await cap('Step 6', 'Your dashboard shows recommended scholarships with a match score and the reasons.'); await wait(5500);

  // 8. Save + remind
  await go('/scholarships?q=Mastercard'); await page.locator('a:has-text("Details")').first().click(); await page.waitForLoadState('networkidle');
  await cap('Step 7', 'Tap "Save scholarship" and choose when to be reminded, so you never miss the deadline.'); await wait(3000);
  await page.locator('form[action$="/save"] button').first().click(); await page.waitForLoadState('networkidle'); await wait(2000);
  await go('/saved'); await cap('Step 7', 'Your saved scholarships are in one list.'); await wait(3500);
  await go('/notifications'); await cap('Step 7', 'Alerts appear here before a deadline. Add the date you find on the official site when you save.'); await wait(3000);

  // 9. Track
  await go('/scholarships?q=Mastercard'); await page.locator('a:has-text("Details")').first().click(); await page.waitForLoadState('networkidle');
  await cap('Step 8', 'After you apply on the official site, track your application and add notes.'); await wait(3000);
  await page.selectOption('form[action$="/track"] select[name=status]', 'Applied').catch(() => {}); await wait(800);
  await page.locator('form[action$="/track"] button').first().click().catch(() => {}); await page.waitForLoadState('networkidle'); await wait(1500);
  await go('/applications'); await cap('Step 8', 'The Applications page shows every application and its status.'); await wait(3500);

  // 10. Help desk
  await go('/'); await page.click('[data-help-open], .help-fab, button:has-text("Help")').catch(() => {});
  await cap('Step 9', 'Stuck? The Help button answers questions about the app, and anything else you ask.'); await wait(5500);

  await go('/'); await cap('Ready', 'Free for students. Never pay to apply. Create your account and start today.'); await wait(5000);

  if (lastEnd > Date.now()) await page.waitForTimeout(lastEnd - Date.now());
  require('fs').writeFileSync(out + '/captions.json', JSON.stringify(log, null, 1));
  const video = page.video(); await ctx.close(); console.log(await video.path()); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
