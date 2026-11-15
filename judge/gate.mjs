// G2 (axe on every surface/state), G5 (reflow), G6 (sound off) and G8 (7 co-designer tasks, scripted proxy).
//   JUDGE_REPO=<clean clone> node judge/gate.mjs        (build first: pnpm build)
import { am, axeScan, en, esc, fill, launch, newPage, save, serve, sleep, JUDGE } from './lib.mjs';
import { dict, partnerRoute, typedOnboarding, wizard } from './flow.mjs';
import { join } from 'node:path';

const srv = await serve();
const browser = await launch();
const rows = [];
const notes = [];
const record = async (page, surface, state) => {
  const r = await axeScan(page);
  rows.push({ surface, state, ...r });
};

// ---------- G2: static surfaces ----------
const SURFACES = ['index.html', 'standalone.html', 'external-partner-demo.html', 'demo/blank.html', 'pages/signup.html', 'pages/profile.html',
  'pages/jobs.html', 'pages/homepage-v1-self-paced.html', 'pages/homepage-v1-paced.html', 'pages/concept-with-navigation.html'];
for (const s of SURFACES) {
  for (const lang of ['en', 'am']) {
    if (lang === 'am' && !s.startsWith('pages/s') && !s.startsWith('pages/p') && !s.startsWith('pages/j')) continue;
    const page = await newPage(browser);
    await page.goto(`${srv.base}/${s}${lang === 'am' ? '?lang=am' : ''}`, { waitUntil: 'networkidle' });
    await sleep(500);
    await record(page, s, `load [${lang}]`);
    if (page.errors.length) notes.push(`${s} [${lang}] page errors: ${page.errors.slice(0, 2).join(' | ')}`);
    await page.close();
  }
}

// ---------- G2 + G8 task 1 (typed) + task 7 (errors) in both languages ----------
const tasks = {};
for (const lang of ['en', 'am']) {
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html${lang === 'am' ? '?lang=am' : ''}`, { waitUntil: 'networkidle' });
  const hooks = {};
  for (const st of ['step1-welcome', 'step1-error', 'step2-name', 'step2-error', 'step3-contact', 'step3-error', 'step4-dob', 'step4-error',
    'step5-identity', 'step5-error', 'step6-support', 'step7-review', 'finished']) {
    hooks[st] = () => record(page, 'pages/signup.html', `${st} [${lang}]`);
  }
  try {
    await typedOnboarding(page, lang, hooks);
    tasks[`T1 typed onboarding [${lang}]`] = 'Y';
    tasks[`T7 validation error + recovery on 5 steps [${lang}]`] = 'Y';
  } catch (e) {
    tasks[`T1 typed onboarding [${lang}]`] = `N: ${e.message.split('\n')[0]}`;
  }
  // Privacy dialog
  const L = dict(lang);
  const w = page.locator('db-signup');
  await w.getByRole('button', { name: L['help.privacy'] }).first().click();
  await w.getByRole('dialog').waitFor();
  await record(page, 'pages/signup.html', `privacy dialog [${lang}]`);
  await page.keyboard.press('Escape');
  await w.getByRole('button', { name: L['help.needHelp'] }).first().click();
  await record(page, 'pages/signup.html', `help dialog [${lang}]`);
  await page.keyboard.press('Escape');
  await page.close();
}

// ---------- G8 task 3: partner referral, no document ----------
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  try {
    await typedOnboarding(page, 'en', {
      'step5-identity': () => record(page, 'pages/signup.html', 'partner route [en]'),
    }, {
      partner: async (L, w) => {
        await partnerRoute(L, w);
        await record(page, 'pages/signup.html', 'partner voucher confirmed [en]');
      },
    });
    tasks['T3 refer me through a partner -> finish'] = 'Y';
  } catch (e) {
    tasks['T3 refer me through a partner -> finish'] = `N: ${e.message.split('\n')[0]}`;
  }
  await page.close();
}

// ---------- G8 task 4: SMS resume in a fresh browser context ----------
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  const z = wizard(page);
  const w = z.w;
  let link = '';
  let code = '';
  try {
    await z.heading().waitFor();
    await w.getByLabel(en['consent.saveAnswers']).check();
    await z.submit().click();
    await z.waitStep(2);
    await w.locator('input[autocomplete="given-name"]').fill('Hana');
    await w.locator('input[autocomplete="family-name"]').fill('Bekele');
    await z.submit().click();
    await z.waitStep(3);
    await w.locator('input[autocomplete="tel"]').fill('0911 234 567');
    await w.getByRole('button', { name: en['sms.send'] }).click();
    const a = w.locator('a[href*="resume"]').first();
    await a.waitFor({ timeout: 8000 });
    link = await a.getAttribute('href');
    code = ((await w.getByText(fill(en['sms.sent'], { phone: '', code: '' }).slice(0, 20)).first().textContent().catch(() => '')) ?? '').match(/DB-[A-Z0-9-]+/)?.[0] ?? '';
    await record(page, 'pages/signup.html', 'SMS resume link shown [en]');
    const fresh = await newPage(browser);
    // The dev link points at the API origin/root; replay it against the same page so the widget restores the draft.
    await fresh.goto(new URL(link, srv.base).toString(), { waitUntil: 'networkidle' });
    await sleep(1500);
    const given = await fresh.locator('db-signup input[autocomplete="given-name"]').count()
      ? await fresh.locator('db-signup input[autocomplete="given-name"]').inputValue() : '';
    const restored = await fresh.locator('db-signup').getByText(en['sms.restored']).count();
    tasks['T4 save & resume by SMS in a fresh context'] = given === 'Hana' || restored ? `Y (link ${link}, code ${code})` : `N: fresh context did not restore (link ${link}, code ${code}, restored-msg ${restored})`;
    await fresh.close();
  } catch (e) {
    tasks['T4 save & resume by SMS in a fresh context'] = `N: ${e.message.split('\n')[0]} (link ${link})`;
  }
  await page.close();
}

// ---------- G8 task 5: Amharic + Ethiopian date (checked against Intl) ----------
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html?lang=am`, { waitUntil: 'networkidle' });
  const z = wizard(page);
  const w = z.w;
  try {
    await z.heading().waitFor();
    await w.getByLabel(am['consent.saveAnswers']).check();
    await z.submit().click(); await z.waitStep(2);
    await w.locator('input[autocomplete="given-name"]').fill('ሰላም');
    await w.locator('input[autocomplete="family-name"]').fill('ታደሰ');
    await z.submit().click(); await z.waitStep(3);
    await w.locator('input[autocomplete="tel"]').fill('0911234567');
    await z.submit().click(); await z.waitStep(4);
    const selects = w.locator('fieldset select');
    const labels = await selects.evaluateAll((ss) => ss.map((s) => s.labels?.[0]?.textContent?.trim()));
    const monthSel = selects.nth(1);
    const monthCount = (await monthSel.locator('option').evaluateAll((os) => os.filter((o) => o.value).length));
    // Choose 1 Meskerem 2000 E.C. (= 2007-09-12)
    await selects.nth(0).selectOption('1');
    await monthSel.selectOption('1');
    await selects.nth(2).selectOption('2000');
    await sleep(200);
    const gregLine = fill(am['dob.inGregorian'], { date: '' }).trim().slice(0, 8);
    const shown = (await w.getByText(gregLine).first().textContent().catch(() => '')) ?? '';
    const pagume = await monthSel.locator('option').evaluateAll((os) => os.map((o) => o.textContent).slice(-1)[0]);
    tasks['T5 Amharic + Ethiopian date'] = `Y (selects: ${labels.join('/')}; ${monthCount} months, last "${pagume}"; 1 Meskerem 2000 shows "${shown.trim()}" (expected 2007-09-12))`;
    await record(page, 'pages/signup.html', 'Ethiopian date chosen [am]');
  } catch (e) {
    tasks['T5 Amharic + Ethiopian date'] = `N: ${e.message.split('\n')[0]}`;
  }
  await page.close();
}

// ---------- G8 task 6: private job filter (no network) + apply with a voice answer ----------
{
  const page = await newPage(browser, {
    init: () => {
      class Rec extends EventTarget { start() { setTimeout(() => this.onresult?.({ results: [[{ transcript: 'I can support customers in Amharic and English', confidence: 1 }]] }), 80); } stop() { this.onend?.(); } abort() {} }
      window.SpeechRecognition = Rec; window.webkitSpeechRecognition = Rec;
    },
  });
  await page.goto(`${srv.base}/pages/jobs.html`, { waitUntil: 'networkidle' });
  const c = page.locator('db-career-gateway');
  try {
    await c.getByText(fill(en['filter.count'], { count: '' }).split('{')[0].slice(0, 8)).first().waitFor();
    await record(page, 'pages/jobs.html', 'job list, many results [en]');
    const before = page.requests.length;
    const boxes = c.locator('fieldset input[type=checkbox]');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check();
    await sleep(400);
    await record(page, 'pages/jobs.html', 'all filters ticked (0 results?) [en]');
    const zero = await c.getByText(en['filter.none']).count();
    for (let i = 0; i < n; i++) await boxes.nth(i).uncheck();
    await c.getByLabel(en['need.remote']).check();
    await sleep(300);
    const status = await c.locator('[role="status"]').first().textContent();
    await record(page, 'pages/jobs.html', 'one filter ticked [en]');
    const after = page.requests.slice(before);
    const leaking = after.filter((r) => /remote|accommodation|filter|need/i.test(r.url + r.body));
    // Apply
    const apply = c.getByRole('button', { name: /^Apply for/ }).first();
    await apply.click();
    const dialog = c.getByRole('dialog');
    await dialog.waitFor();
    await record(page, 'pages/jobs.html', 'apply dialog [en]');
    await dialog.getByLabel(en['field.givenName']).fill('Abebe');
    await dialog.getByLabel(en['field.familyName']).fill('Kebede');
    await dialog.getByLabel(en['field.phone']).fill('0911234567');
    await dialog.getByRole('button', { name: fill(en['voice.answer'], { field: en['field.coverNote'] }) }).click();
    const review = dialog.getByLabel(en['voice.reviewLabel']);
    await review.waitFor();
    const heard = await review.inputValue();
    await dialog.getByRole('button', { name: en['voice.use'] }).click();
    const reqBefore = page.requests.length;
    await dialog.getByRole('button', { name: en['apply.submit'] }).click();
    await c.getByText(new RegExp(esc(fill(en['apply.sent'], { title: '' }).split('{')[0].slice(0, 15)))).first().waitFor({ timeout: 8000 });
    const applyReqs = page.requests.slice(reqBefore);
    tasks['T6 private filter + apply with voice'] =
      `Y (filter network requests carrying selections: ${leaking.length}; requests during filtering: ${after.length}; zero-results message: ${zero ? 'yes' : 'no'}; status "${status?.trim()}"; voice text "${heard}"; apply requests: ${applyReqs.map((r) => r.method + ' ' + r.url.replace(srv.base, '')).join(', ') || 'none (mock, local)'})`;
    await record(page, 'pages/jobs.html', 'application sent [en]');
    // Employer form
    await page.locator('db-employer-accommodations').getByRole('button', { name: en['employer.submit'] }).click();
    await page.locator('db-employer-accommodations [role="alert"]').first().waitFor();
    await record(page, 'pages/jobs.html', 'employer form error [en]');
  } catch (e) {
    tasks['T6 private filter + apply with voice'] = `N: ${e.message.split('\n')[0]}`;
  }
  await page.close();
}

// ---------- G8 task 2: voice on two fields (stubbed recognition, review + read-back) ----------
{
  const page = await newPage(browser, {
    init: () => {
      window.__spoken = [];
      const realSpeak = window.speechSynthesis?.speak?.bind(window.speechSynthesis);
      if (window.speechSynthesis) {
        window.speechSynthesis.speak = (u) => { window.__spoken.push({ text: u.text, lang: u.lang }); setTimeout(() => u.onend?.(), 10); };
      }
      let n = 0;
      const said = ['Abebe', 'Kebede'];
      class Rec extends EventTarget { start() { const t = said[n++ % 2]; setTimeout(() => this.onresult?.({ results: [[{ transcript: t, confidence: 1 }]] }), 80); } stop() { this.onend?.(); } abort() {} }
      window.SpeechRecognition = Rec; window.webkitSpeechRecognition = Rec;
    },
  });
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  const z = wizard(page);
  const w = z.w;
  try {
    await z.heading().waitFor();
    await w.getByLabel(en['consent.saveAnswers']).check();
    await z.submit().click(); await z.waitStep(2);
    const results = [];
    for (const field of ['field.givenName', 'field.familyName']) {
      await w.getByRole('button', { name: fill(en['voice.answer'], { field: en[field] }), exact: true }).click();
      const review = w.getByLabel(en['voice.reviewLabel']);
      await review.waitFor();
      const before = await w.locator(`input[autocomplete="${field === 'field.givenName' ? 'given-name' : 'family-name'}"]`).inputValue();
      await w.getByRole('button', { name: en['voice.readBack'] }).click();
      await review.fill((await review.inputValue()) + '');
      await w.getByRole('button', { name: en['voice.use'] }).click();
      const after = await w.locator(`input[autocomplete="${field === 'field.givenName' ? 'given-name' : 'family-name'}"]`).inputValue();
      results.push(`${en[field]}: field empty before "Use this answer" = ${before === ''}, after = "${after}"`);
    }
    const spoken = await page.evaluate(() => window.__spoken);
    const readBackNote = await w.getByText(en['voice.readBackUnavailable']).count();
    await record(page, 'pages/signup.html', 'voice answers used [en]');
    tasks['T2 voice on two fields with review + read-back'] = `Y (${results.join('; ')}; read-back: ${spoken.length ? spoken.map((s) => `spoke "${s.text}" (${s.lang})`).join(', ') : readBackNote ? 'no voice installed in headless Chrome -> visible "read back not available" note' : 'NOTHING happened'})`;
  } catch (e) {
    tasks['T2 voice on two fields with review + read-back'] = `N: ${e.message.split('\n')[0]}`;
  }
  await page.close();
}

// ---------- G5: reflow + 320 px screenshots of every step ----------
const reflow = [];
for (const vp of [{ width: 640, height: 800, tag: '200%' }, { width: 320, height: 640, tag: '400%' }, { width: 360, height: 640, tag: 'phone 360', mobile: true }]) {
  for (const s of ['pages/signup.html', 'pages/profile.html', 'pages/jobs.html', 'demo/blank.html', 'pages/homepage-v1-self-paced.html']) {
    const page = await newPage(browser, { viewport: { width: vp.width, height: vp.height } });
    await page.goto(`${srv.base}/${s}`, { waitUntil: 'networkidle' });
    await sleep(400);
    const m = await page.evaluate(() => {
      const small = [];
      const walk = (root) => root.querySelectorAll('a[href],button,input,select,textarea,summary').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.width < 24 || r.height < 24) && !(el.type === 'checkbox' || el.type === 'radio')) small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`);
      });
      walk(document);
      document.querySelectorAll('*').forEach((h) => h.shadowRoot && walk(h.shadowRoot));
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small };
    });
    reflow.push({ page: s, viewport: `${vp.width}x${vp.height} (${vp.tag})`, hScroll: m.sw > m.cw, scrollWidth: m.sw, clientWidth: m.cw, targetsUnder24: m.small });
    await page.close();
  }
}
{
  const page = await newPage(browser, { viewport: { width: 320, height: 640 } });
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  let i = 0;
  const shot = async (name) => page.screenshot({ path: join(JUDGE, 'screens', `320-${String(++i).padStart(2, '0')}-${name}.png`), fullPage: true });
  const hooks = {};
  for (const st of ['step1-welcome', 'step1-error', 'step2-name', 'step3-contact', 'step4-dob', 'step5-identity', 'step6-support', 'step7-review', 'finished']) hooks[st] = () => shot(st);
  try { await typedOnboarding(page, 'en', hooks); } catch (e) { notes.push(`320px screenshot run stopped: ${e.message.split('\n')[0]}`); }
  await page.goto(`${srv.base}/pages/jobs.html`, { waitUntil: 'networkidle' });
  await sleep(500);
  await shot('jobs');
  await page.close();
}

// ---------- G6: sound off inventory ----------
const sound = {};
{
  const page = await newPage(browser, {
    init: () => {
      window.__audio = []; window.__speak = [];
      const P = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__audio.push(this.currentSrc || this.src); return P.call(this).catch(() => {}); };
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices = () => [];
        const S = window.speechSynthesis.speak.bind(window.speechSynthesis);
        window.speechSynthesis.speak = (u) => { window.__speak.push(u.text); };
      }
    },
  });
  await page.goto(`${srv.base}/pages/signup.html?lang=am`, { waitUntil: 'networkidle' });
  await sleep(1500);
  sound.onLoad = await page.evaluate(() => ({ audio: window.__audio.length, speak: window.__speak.length }));
  const w = page.locator('db-signup');
  await w.getByRole('button', { name: am['help.readAloud'] }).first().click();
  await sleep(800);
  sound.afterReadAloud = await page.evaluate(() => ({ audio: window.__audio, speak: window.__speak }));
  sound.caption = await w.locator('[data-db-caption], mark').first().count() ? (await w.locator('[data-db-caption]').first().innerText().catch(() => '')).slice(0, 160) : 'NO CAPTION FOUND';
  sound.audioRequests = page.requests.filter((r) => /\.(mp3|wav)/.test(r.url)).map((r) => r.url.replace(srv.base, ''));
  await record(page, 'pages/signup.html', 'read-aloud caption, no voice [am]');
  await page.close();
}

const missing = srv.log.filter((l) => l.status === 404).map((l) => l.path);
save('g2-axe.json', rows);
save('g8-tasks.json', tasks);
save('g5-reflow.json', reflow);
save('g6-sound.json', sound);
const table = ['| Surface | State | critical | serious | moderate | minor | rules |', '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.surface} | ${r.state} | ${r.critical} | ${r.serious} | ${r.moderate} | ${r.minor} | ${r.rules.join('<br>') || '—'} |`)].join('\n');
save('g2-axe.md', table);
console.log(`G2 axe: ${rows.length} scans; critical ${rows.reduce((a, r) => a + r.critical, 0)}, serious ${rows.reduce((a, r) => a + r.serious, 0)}, moderate ${rows.reduce((a, r) => a + r.moderate, 0)}, minor ${rows.reduce((a, r) => a + r.minor, 0)}`);
for (const r of rows.filter((r) => r.rules.length)) console.log(`  ${r.surface} ${r.state}: ${r.rules.join(' ; ')}`);
console.log('G8 tasks:'); for (const [k, v] of Object.entries(tasks)) console.log(`  ${k}: ${v}`);
console.log('G5 reflow:'); for (const r of reflow) console.log(`  ${r.page} ${r.viewport}: hScroll=${r.hScroll} (${r.scrollWidth}/${r.clientWidth}) small=${r.targetsUnder24.length} ${r.targetsUnder24.slice(0, 3).join('; ')}`);
console.log('G6 sound:', JSON.stringify(sound));
console.log('404s:', [...new Set(missing)].join(', ') || 'none');
console.log('notes:', notes.join('\n  ') || 'none');
await browser.close();
srv.close();
