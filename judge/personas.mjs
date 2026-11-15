// Persona proxies: Dawit (forced colours, text resize), Abebech (simple words, icons, reading level), Deaf user.
import { join } from 'node:path';
import { axeScan, en, JUDGE, launch, newPage, save, serve, sleep } from './lib.mjs';
import { wizard } from './flow.mjs';

const srv = await serve();
const browser = await launch();
const out = {};

// Dawit: forced colours + reduced motion + text resize (root font-size 200 %).
{
  const page = await newPage(browser);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  await sleep(400);
  out.forcedColorsAxe = await axeScan(page);
  await page.screenshot({ path: join(JUDGE, 'screens', 'forced-colors.png') });
  await page.emulateMedia({ forcedColors: 'none' });
  const before = await page.evaluate(() => getComputedStyle(document.querySelector('db-signup').shadowRoot.querySelector('label')).fontSize);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await sleep(200);
  const after = await page.evaluate(() => getComputedStyle(document.querySelector('db-signup').shadowRoot.querySelector('label')).fontSize);
  const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  out.textResize200 = { labelBefore: before, labelAfter: after, hScroll };
  await page.close();
}

// Abebech: simple words changes copy? icons with choices? Listen on every step?
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  const z = wizard(page);
  await z.heading().waitFor();
  const steps = [];
  await z.w.getByLabel(en['consent.saveAnswers']).check();
  for (let s = 1; s <= 7; s++) {
    const hintBefore = await z.w.locator('form > p').nth(s === 1 ? 1 : 0).textContent().catch(() => '');
    const simple = z.w.getByRole('button', { name: en['help.simpleWords'] });
    await simple.click();
    await sleep(150);
    const hintAfter = await z.w.locator('form > p').nth(s === 1 ? 1 : 0).textContent().catch(() => '');
    const choiceIcons = await page.evaluate(() => {
      const root = document.querySelector('db-signup').shadowRoot;
      const labels = [...root.querySelectorAll('input[type=radio], input[type=checkbox]')].map((i) => i.closest('label') ?? i.labels?.[0]).filter(Boolean);
      return { choices: labels.length, withIcon: labels.filter((l) => l.querySelector('svg') || l.parentElement?.querySelector('svg')).length };
    });
    const listen = await z.w.getByRole('button', { name: en['help.readAloud'] }).count();
    steps.push({ step: s, simpleChangesHint: hintBefore !== hintAfter, ...choiceIcons, listenButton: listen > 0 });
    await simple.click();
    if (s === 2) { await z.w.locator('input[autocomplete="given-name"]').fill('Abebech'); await z.w.locator('input[autocomplete="family-name"]').fill('Tadesse'); }
    if (s === 3) await z.w.locator('input[autocomplete="tel"]').fill('0911234567');
    if (s === 4) { const sel = z.w.locator('fieldset select'); for (let i = 0; i < 3; i++) { const v = await sel.nth(i).locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean)); await sel.nth(i).selectOption(i === 2 ? v[Math.min(20, v.length - 1)] : v[0]); } }
    if (s === 5) { await z.w.getByLabel(en['id.partner_voucher']).check(); break; }
    await z.submit().click();
    await z.waitStep(s + 1);
  }
  out.lowLiteracy = steps;
  await page.close();
}

// Reading level of English strings.
const jargon = /\b(authenticat\w*|credential\w*|proof|verif\w*|identity|consent|preferences|accommodation\w*)\b/i;
out.readingLevel = {
  longSentences: Object.entries(en).filter(([, v]) => v.split(/[.!?]/).some((s) => s.trim().split(/\s+/).length > 15)).map(([k, v]) => `${k}: ${v.slice(0, 90)}`).slice(0, 15),
  jargon: Object.entries(en).filter(([, v]) => jargon.test(v)).map(([k, v]) => `${k}: ${v.slice(0, 70)}`).slice(0, 15),
};

// Deaf user: support options include captions / sign language / interpreter language?
out.deaf = Object.entries(en).filter(([k, v]) => k.startsWith('need.') && /caption|sign|interpret/i.test(v)).map(([k, v]) => `${k}: ${v}`);

await browser.close();
srv.close();
save('personas.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
