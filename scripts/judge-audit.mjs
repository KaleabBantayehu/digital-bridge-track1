// Judge audit for the built pages (apps/web-components/dist), headless Chromium + axe-core.
//   node scripts/judge-audit.mjs            (run `pnpm -F @db/web-components build` first)
// Checks: axe (WCAG 2.0-2.2 A/AA + best practice, any severity) in en and am; no header/sidebar overlap with <main>,
// <h1> or the widgets at 1280x800 and 320x640; no horizontal scroll at 320px; the Amharic voice-note fallback
// completes the name step without typing; the Fidel helper; the read-aloud caption box with no Amharic voice;
// mode="edit"; one db-signup:step event per step; no 404s.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const repo = resolve(import.meta.dirname, '..');
const require = createRequire(join(repo, 'package.json'));
const { chromium } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const root = join(repo, 'apps/web-components/dist');
const am = JSON.parse(readFileSync(join(repo, 'apps/web-components/src/i18n/am.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(repo, 'apps/web-components/src/i18n/en.json'), 'utf8'));
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
const missing = [];
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = resolve(root, '.' + path);
  if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { missing.push(path); res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const out = [];
let fails = 0;
const check = (ok, label) => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) fails++; };

async function launch() {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  try { return await chromium.launch({ args }); } catch { return chromium.launch({ channel: 'chrome', args }); }
}
const browser = await launch();

async function newPage(viewport = { width: 1280, height: 800 }, init) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e)));
  // Google Fonts is an optional enhancement; keep the audit offline and deterministic.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  if (init) await page.addInitScript(init);
  return page;
}

async function axe(page, label) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  check(r.violations.length === 0, `axe ${label}: ${r.violations.length} violations`);
  for (const v of r.violations) out.push(`      [${v.impact}] ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Any header/top bar/sidebar box that intersects <main>, its <h1>, or a widget (page at scroll 0). */
async function overlaps(page) {
  return page.evaluate(() => {
    const boxes = (sel) => [...document.querySelectorAll(sel)].map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ el, r }) => r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'); // skips visually-hidden headings
    const bars = boxes('header, [role="banner"], .db-savanna-topbar, .header, .logo-container, #sidebar');
    const content = boxes('main, main h1, db-signup, db-onboarding-wizard, db-career-gateway, db-employer-accommodations');
    const hits = [];
    for (const b of bars) for (const c of content) {
      if (b.el.contains(c.el) || c.el.contains(b.el)) continue;
      const x = Math.min(b.r.right, c.r.right) - Math.max(b.r.left, c.r.left);
      const y = Math.min(b.r.bottom, c.r.bottom) - Math.max(b.r.top, c.r.top);
      if (x > 0 && y > 0) hits.push(`${b.el.className || b.el.tagName} x ${c.el.tagName.toLowerCase()}`);
    }
    const topbar = document.querySelector('.db-savanna-topbar');
    const main = document.querySelector('main');
    return { hits, topbarOk: !topbar || topbar.getBoundingClientRect().bottom <= main.getBoundingClientRect().top, scrollWidth: document.documentElement.scrollWidth };
  });
}

const PAGES = ['pages/signup.html', 'pages/profile.html', 'pages/jobs.html', 'demo/blank.html', 'pages/homepage-v1-self-paced.html', 'pages/homepage-v1-paced.html'];

// 1) Layout + axe, every page, both viewports, both languages (lang via the host language switch / ?lang=am).
for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 640 }]) {
  for (const path of PAGES) {
    for (const lang of ['en', 'am']) {
      if (lang === 'am' && (path.startsWith('pages/homepage') || path === 'demo/blank.html')) continue; // no language switch on these hosts
      const page = await newPage(viewport);
      await page.goto(`${BASE}/${path}${lang === 'am' ? '?lang=am' : ''}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const tag = `${path} [${lang}] ${viewport.width}px`;
      const o = await overlaps(page);
      check(o.hits.length === 0 && o.topbarOk, `no header/sidebar overlap: ${tag}${o.hits.length ? ' -> ' + o.hits.join(', ') : ''}`);
      if (viewport.width === 320) check(o.scrollWidth <= 320, `no horizontal scroll at 320px: ${tag} (scrollWidth ${o.scrollWidth})`);
      if (lang === 'am') {
        const amRoots = await page.evaluate(() => [...document.querySelectorAll('db-signup, db-career-gateway')].every((w) => w.shadowRoot?.querySelector('[lang="am"]')));
        check(amRoots, `widgets render lang="am": ${tag}`);
      }
      await axe(page, tag);
      check(page.__errors.length === 0, `no page errors: ${tag} ${page.__errors.slice(0, 1).join('')}`);
      await page.close();
    }
  }
}

// 2) Amharic journey on signup.html: no SpeechRecognition (first name) and a failing one (father's name),
//    both fall back to a voice note; the step is completed without typing.
{
  const page = await newPage({ width: 1280, height: 800 }, () => {
    window.__events = [];
    for (const n of ['db-signup:step', 'db-signup:done', 'db-signup:support']) document.addEventListener(n, (e) => window.__events.push([n, e.detail]));
    // Device without an Amharic TTS voice.
    if (window.speechSynthesis) window.speechSynthesis.getVoices = () => [];
    // Speech-to-text that fails with "language-not-supported" for am-ET (the common real-world case).
    class FailingRecognition extends EventTarget {
      start() { setTimeout(() => { this.onerror?.({ error: 'language-not-supported' }); this.onend?.(); }, 50); }
      stop() { this.onend?.(); }
      abort() {}
    }
    window.__setRecognition = (mode) => {
      if (mode === 'none') { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }
      else { window.SpeechRecognition = FailingRecognition; window.webkitSpeechRecognition = FailingRecognition; }
    };
    window.__setRecognition('none');
  });
  await page.goto(`${BASE}/pages/signup.html?lang=am`, { waitUntil: 'networkidle' });
  const w = page.locator('db-signup');
  await w.locator('section[lang="am"] h2[tabindex]').first().waitFor();
  const submit = w.locator('form button[type=submit]');

  await w.getByLabel(am['consent.saveAnswers']).check();
  await submit.click();
  await w.getByRole('heading', { level: 2, name: /2/ }).waitFor();
  await axe(page, 'signup [am] name step');

  // First name: no SpeechRecognition at all -> voice note starts automatically.
  await w.getByRole('button', { name: fill(am['voice.answer'], { field: am['field.givenName'] }), exact: true }).click();
  const stop = w.getByRole('button', { name: am['note.stop'] });
  await stop.waitFor();
  check(await w.getByText(am['voice.amFallback']).first().isVisible(), 'am: fallback explanation shown when SpeechRecognition is missing');
  check(await page.evaluate(() => document.querySelector('db-signup').shadowRoot.activeElement?.getAttribute('aria-pressed') === 'true'), 'am: focus moved to the Stop recording button');
  await page.waitForTimeout(1200);
  await stop.click();
  await w.getByRole('button', { name: am['note.keep'] }).waitFor();
  check(await w.locator('audio[controls]').count() > 0, 'am: recorded voice note has an audio preview');
  await axe(page, 'signup [am] voice-note preview');
  await w.getByRole('button', { name: am['note.keep'] }).click();
  const badgeText = fill(am['note.savedBadge'], { seconds: '' }).split('(')[0].trim();
  await w.getByText(badgeText).first().waitFor();
  check(true, 'am: "voice note saved" badge shown on the field');

  // Father's name: SpeechRecognition exists but fails for am-ET -> voice note.
  await page.evaluate(() => window.__setRecognition('failing'));
  await w.getByRole('button', { name: fill(am['voice.answer'], { field: am['field.familyName'] }) }).click();
  await stop.waitFor();
  await page.waitForTimeout(1200);
  await stop.click();
  await w.getByRole('button', { name: am['note.keep'] }).click();
  await page.waitForTimeout(200);
  check(await w.getByText(badgeText).count() === 2, 'am: both name fields answered by voice note');

  // Fidel helper on the first-name field.
  await w.getByRole('button', { name: am['fidel.toggle'] }).first().click();
  await w.getByLabel(am['fidel.label']).first().fill('abebe');
  check((await w.locator('output').first().textContent()).includes('አበበ'), 'am: Fidel helper turns "abebe" into አበበ');
  await axe(page, 'signup [am] Fidel helper open');
  await w.getByRole('button', { name: am['fidel.toggle'] }).first().click();

  const typed = await page.evaluate(() => [...document.querySelector('db-signup').shadowRoot.querySelectorAll('input[autocomplete="given-name"], input[autocomplete="family-name"]')].map((i) => i.value).join(''));
  check(typed === '', 'am: nothing was typed into the name fields');
  await submit.click();
  await w.getByRole('heading', { level: 2, name: /3/ }).waitFor({ timeout: 5000 });
  check(true, 'am: name step completed with voice notes only, now on step 3');

  // Read aloud with no Amharic voice -> caption box + bundled cue (no 404).
  await w.getByRole('button', { name: am['help.readAloud'] }).click();
  const caption = w.locator('[data-db-caption]');
  await caption.waitFor();
  check((await caption.textContent()).trim().length > 0, 'am: read-aloud caption box shows the words with no am-ET voice');
  check(await w.locator('mark.db-phrase-current').count() === 1, 'am: current phrase highlighted');
  await axe(page, 'signup [am] read-aloud caption box');

  const steps = await page.evaluate(() => window.__events.filter(([n]) => n === 'db-signup:step').map(([, d]) => d.step));
  check(steps.length === new Set(steps).size, `db-signup:step fires once per step (${steps.join(',')})`);
  check(page.__errors.length === 0, `no page errors in the Amharic journey ${page.__errors.slice(0, 1).join('')}`);
  await page.close();
}

// 2b) Hands-free voice control in Amharic: a scripted speech engine stands in for the microphone, so every
//     command below is exactly what a learner would say.
{
  const page = await newPage({ width: 1280, height: 800 }, () => {
    if (window.speechSynthesis) window.speechSynthesis.getVoices = () => [];
    class ScriptedRecognition extends EventTarget {
      start() { window.__activeRec = this; }
      stop() { if (window.__activeRec === this) window.__activeRec = null; this.onend?.(); }
      abort() { if (window.__activeRec === this) window.__activeRec = null; }
    }
    window.SpeechRecognition = ScriptedRecognition;
    window.webkitSpeechRecognition = ScriptedRecognition;
    window.__say = (text) => {
      const rec = window.__activeRec;
      if (!rec) return false;
      const results = [[{ transcript: text, confidence: 1 }]];
      rec.onresult?.({ results });
      return true;
    };
  });
  const say = async (text) => {
    for (let i = 0; i < 20 && !(await page.evaluate((t) => window.__say(t), text)); i++) await page.waitForTimeout(100);
    await page.waitForTimeout(450);
  };
  const activeIs = (selector) => page.evaluate((sel) => !!document.querySelector('db-signup').shadowRoot.activeElement?.matches(sel), selector);
  const downUntil = async (selector) => {
    for (let i = 0; i < 25 && !(await activeIs(selector)); i++) await say('ታች');
    return activeIs(selector);
  };
  await page.goto(`${BASE}/pages/signup.html?lang=am`, { waitUntil: 'networkidle' });
  const w = page.locator('db-signup');
  await w.locator('section[lang="am"] h2[tabindex]').first().waitFor();

  await page.keyboard.press('Alt+KeyV');
  await w.getByText(am['vc.listening']).waitFor();
  check(await w.getByRole('button', { name: am['vc.toggle'] }).getAttribute('aria-pressed') === 'true', 'voice control: Alt+V turns it on (aria-pressed)');
  await axe(page, 'signup [am] voice control on');

  check(await downUntil('input[type="checkbox"]'), 'voice control: "ታች" (down) moves focus to the consent checkbox');
  await say('ምረጥ');
  check(await w.getByLabel(am['consent.saveAnswers']).isChecked(), 'voice control: "ምረጥ" (choose) ticks the focused checkbox');
  check((await w.locator('[data-db-voice-status]').textContent()).includes(am['vc.checked']), 'voice control: spoken/visible confirmation says it is ticked');
  await say('ቀጥል');
  await w.getByRole('heading', { level: 2, name: /2/ }).waitFor();
  check(true, 'voice control: "ቀጥል" (next) saves and moves to step 2');
  await say('ተመለስ');
  await w.getByRole('heading', { level: 2, name: /1/ }).waitFor();
  check(true, 'voice control: "ተመለስ" (back) returns to step 1');
  await say('next');
  await w.getByRole('heading', { level: 2, name: /2/ }).waitFor();
  check(true, 'voice control: English "next" also works in the Amharic UI');

  check(await downUntil('input[autocomplete="given-name"]'), 'voice control: reaches the first-name text box');
  await say('መልስ');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__say('አበበ'));
  const review = w.getByLabel(am['voice.reviewLabel']);
  await review.waitFor();
  check(await review.inputValue() === 'አበበ', 'voice control: "መልስ" (answer) dictates into the focused field, shown for review');
  await page.waitForTimeout(500);
  check(await downUntil('button.bg-terracotta'), 'voice control: moves to "Use this answer"');
  await say('ምረጥ');
  check(await w.locator('input[autocomplete="given-name"]').inputValue() === 'አበበ', 'voice control: "ምረጥ" uses the reviewed answer');

  await w.locator('input[autocomplete="family-name"]').fill('ከበደ');
  await say('ቀጥል');
  await w.getByRole('heading', { level: 2, name: /3/ }).waitFor();
  await w.locator('input[autocomplete="tel"]').focus();
  await say('መልስ');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__say('ዜሮ ዘጠኝ አንድ አንድ ሁለት ሶስት አራት አምስት ስድስት ሰባት'));
  await review.waitFor();
  check(await review.inputValue() === '0911234567', 'spoken Amharic number words become a phone number (0911234567)');

  await page.waitForTimeout(500);
  await say('አቁም');
  check(await w.getByRole('button', { name: am['vc.toggle'] }).getAttribute('aria-pressed') === 'false', 'voice control: "አቁም" (stop) turns it off');
  check(page.__errors.length === 0, `no page errors in the voice-control journey ${page.__errors.slice(0, 1).join('')}`);
  await page.close();
}

// 3) Profile edit mode opens on the summary.
{
  const page = await newPage();
  await page.goto(`${BASE}/pages/profile.html`, { waitUntil: 'networkidle' });
  await page.locator('db-signup').getByRole('heading', { level: 2, name: en['edit.title'] }).waitFor();
  check(true, 'profile.html (mode="edit") opens on "Edit my profile"');
  const focusedHost = await page.evaluate(() => document.activeElement === document.body);
  check(focusedHost, 'page load does not move focus into the widget');
  await page.close();
}

check(missing.length === 0, `no 404s (${[...new Set(missing)].join(', ')})`);
await browser.close();
server.close();
console.log(out.join('\n'));
console.log(fails ? `\n${fails} FAILED` : `\nALL ${out.filter((l) => l.startsWith('PASS')).length} JUDGE CHECKS PASSED`);
process.exit(fails ? 1 : 0);
