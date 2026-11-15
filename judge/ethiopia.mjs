// Built-for-Ethiopia checks: i18n parity, calendar vs Intl, phones, Slow 3G (+4x CPU), offline, clock, RTL, new language.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { am, en, launch, newPage, REPO, save, serve, sleep } from './lib.mjs';
import { wizard } from './flow.mjs';

const out = {};
const require = createRequire(join(REPO, 'package.json'));
const S = require(join(REPO, 'packages/shared-schemas/dist/index.js'));

// ---- i18n parity ----
const ethiopic = /[ሀ-፿]/;
out.i18n = {
  enKeys: Object.keys(en).length, amKeys: Object.keys(am).length,
  missingInAm: Object.keys(en).filter((k) => !(k in am)),
  missingInEn: Object.keys(am).filter((k) => !(k in en)),
  identicalToEnglish: Object.keys(en).filter((k) => am[k] === en[k] && /[A-Za-z]{3}/.test(en[k])),
  amWithoutEthiopic: Object.keys(am).filter((k) => !ethiopic.test(am[k]) && /[A-Za-z]{3}/.test(am[k])),
};

// ---- Hard-coded user-facing English in components (JSX text / aria-label / placeholder / title literals) ----
const srcDir = join(REPO, 'apps/web-components/src');
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) && !/test/.test(f) && files.push(p); });
walk(srcDir);
out.hardcoded = [];
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/(aria-label|placeholder|title)="[A-Za-z][^"{]*"/.test(line) || />\s*[A-Z][a-z]+(\s+[a-z]+){2,}\s*</.test(line)) out.hardcoded.push(`${f.replace(REPO, '').replace(/\\/g, '/')}:${i + 1}: ${line.trim().slice(0, 100)}`);
  });
}

// ---- Logical properties ----
out.physicalCss = [];
for (const f of files.concat([join(srcDir, 'styles/index.css')])) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/\b(ml|mr|pl|pr|left|right)-\d|text-left|text-right|margin-left|padding-right|float:\s*(left|right)/.test(line)) out.physicalCss.push(`${f.replace(REPO, '').replace(/\\/g, '/')}:${i + 1}: ${line.trim().slice(0, 90)}`);
  });
}

// ---- Calendar vs Intl ----
const intl = new Intl.DateTimeFormat('en-u-ca-ethiopic', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
const viaIntl = (d) => { const p = Object.fromEntries(intl.formatToParts(d).map((x) => [x.type, x.value])); return { year: Number(p.year), month: Number(p.month), day: Number(p.day) }; };
const mismatches = [];
const dates = [];
for (let i = 0; i < 400; i++) dates.push(new Date(Date.UTC(1900, 0, 1) + Math.floor(Math.random() * 200 * 365.25 * 864e5)));
for (const iso of ['2026-09-11', '2026-11-14', '2023-09-12', '2023-09-11', '2024-02-29', '2000-02-29', '1900-03-01', '2099-12-31', '2027-09-11', '2027-09-12', '2025-09-10', '2025-09-11']) dates.push(new Date(iso + 'T00:00:00Z'));
for (const d of dates) {
  const ours = S.gregorianToEthiopian(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  const ref = viaIntl(d);
  if (ours.year !== ref.year || ours.month !== ref.month || ours.day !== ref.day) mismatches.push(`${d.toISOString().slice(0, 10)}: ours ${ours.day}/${ours.month}/${ours.year} Intl ${ref.day}/${ref.month}/${ref.year}`);
  const back = S.ethiopianToGregorian(ours);
  if (back.iso !== d.toISOString().slice(0, 10)) mismatches.push(`round-trip ${d.toISOString().slice(0, 10)} -> ${back.iso}`);
}
const pagume = [2014, 2015, 2016, 2017, 2018, 2019].map((y) => `${y}:${S.daysInEthiopianMonth(y, 13)}`);
out.calendar = { tested: dates.length, mismatches: mismatches.slice(0, 10), mismatchCount: mismatches.length, pagumeDays: pagume,
  anchors: ['2026-09-11', '2026-11-14'].map((iso) => { const [y, m, d] = iso.split('-').map(Number); const e = S.gregorianToEthiopian(y, m, d); return `${iso} = ${e.day}/${e.month}/${e.year}`; }) };

// ---- Phones ----
const phones = ['0911234567', '0911 234 567', '091-123-4567', '+251911234567', '251911234567', '0711234567', '+251711234567', '091123456', '09112345678', '0811234567', 'abcdefghij', '0፱፩፩234567'];
out.phones = Object.fromEntries(phones.map((p) => [p, S.normaliseEtPhone(p)]));

// ---- Browser checks ----
const srv = await serve();
const browser = await launch();

// Slow 3G: ~500 kbit/s, 400 ms, 4x CPU, gzip like a real host, fonts allowed (they are part of real first load).
out.slow3g = {};
for (const path of ['demo/blank.html', 'pages/signup.html']) {
  const page = await newPage(browser);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto(`${srv.base}/${path}`, { timeout: 180000 });
  await page.locator('db-signup h2[tabindex]').first().waitFor({ timeout: 180000 });
  const ms = Date.now() - t0;
  const thirdParty = [...new Set(page.requests.map((r) => new URL(r.url).host).filter((h) => !h.startsWith('127.0.0.1')))];
  out.slow3g[path] = { secondsToFirstQuestion: +(ms / 1000).toFixed(1), thirdPartyHosts: thirdParty };
  await page.close();
}
const firstLoad = srv.log.filter((l) => l.status === 200);
out.bundleBytesGzipOnWire = firstLoad.filter((l) => /db-(signup|widgets)/.test(l.path)).map((l) => `${l.path}: ${(l.bytes / 1024).toFixed(1)} KB`);

// Offline mid-wizard + reload
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  const z = wizard(page);
  await z.heading().waitFor();
  await z.w.getByLabel(en['consent.saveAnswers']).check();
  await z.submit().click();
  await z.waitStep(2);
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await z.w.locator('input[autocomplete="given-name"]').fill('Yonas');
  await z.w.locator('input[autocomplete="family-name"]').fill('Alemu');
  await z.submit().click();
  await z.waitStep(3);
  const offlineText = await z.w.getByText(en['status.offlineSaved']).count();
  await sleep(600);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(1500);
  const reloaded = await page.locator('db-signup').count().catch(() => 0);
  let sameQuestion = null; let kept = null;
  if (reloaded) {
    sameQuestion = await z.stepNumber().catch(() => null);
    await page.context().setOffline(false);
  }
  await page.context().setOffline(false);
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  await sleep(1200);
  const step = await z.stepNumber();
  if (step === 3) { await z.w.locator('[data-db-action="back"]').click(); await z.waitStep(2); }
  kept = await z.w.locator('input[autocomplete="given-name"]').inputValue().catch(() => '');
  out.offline = { offlineMessageShown: offlineText > 0, pageReloadWhileOffline: reloaded ? `loaded, on step ${sameQuestion}` : 'page itself does not load offline (no service worker)', afterReconnectStep: step, answerKept: kept };
  await page.close();
}

// No time-outs: fast-forward 3 hours on the wizard.
{
  const page = await newPage(browser);
  await page.clock.install();
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  const z = wizard(page);
  await z.heading().waitFor();
  await z.w.getByLabel(en['consent.saveAnswers']).check();
  await z.submit().click();
  await z.waitStep(2);
  await z.w.locator('input[autocomplete="given-name"]').fill('Tigist');
  await page.clock.fastForward('03:00:00');
  await sleep(300);
  out.noTimeouts = { stepAfter3h: await z.stepNumber(), valueAfter3h: await z.w.locator('input[autocomplete="given-name"]').inputValue() };
  await page.close();
}

// RTL render
{
  const page = await newPage(browser, { viewport: { width: 375, height: 700 } });
  await page.goto(`${srv.base}/demo/blank.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; document.querySelector('db-signup').setAttribute('dir', 'rtl'); });
  await sleep(400);
  out.rtl = await page.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  await page.screenshot({ path: join(import.meta.dirname, 'screens', 'rtl-blank.png') });
  await page.close();
}

// Amharic typography on a rendered node
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html?lang=am`, { waitUntil: 'networkidle' });
  await sleep(500);
  out.amTypography = await page.evaluate(() => {
    const root = document.querySelector('db-signup').shadowRoot;
    const p = [...root.querySelectorAll('[lang="am"] p, [lang="am"] label, [lang="am"] h2')].find((e) => /[ሀ-፿]/.test(e.textContent));
    const cs = getComputedStyle(p);
    return { fontFamily: cs.fontFamily, lineHeightRatio: +(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2), textTransform: cs.textTransform, letterSpacing: cs.letterSpacing };
  });
  out.thirdPartyOnLoad = [...new Set(page.requests.map((r) => new URL(r.url).host).filter((h) => !h.startsWith('127.0.0.1')))];
  await page.close();
}

await browser.close();
srv.close();
save('ethiopia.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
