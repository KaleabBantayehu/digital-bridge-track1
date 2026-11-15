// Task 4 with the real API: save & resume by SMS link in a completely fresh browser context.
import { en, launch, newPage, save, serve, sleep } from './lib.mjs';
import { wizard } from './flow.mjs';

const API = (process.env.API_BASE ?? 'http://localhost:3000') + '/api/v1';
const srv = await serve();
const browser = await launch();
// Set api="..." while the HTML is parsed, before the module upgrades the element (what a real host page does).
const withApi = async (page, url) => {
  await page.addInitScript((api) => {
    new MutationObserver(() => document.querySelectorAll('db-signup:not([api])').forEach((el) => el.setAttribute('api', api)))
      .observe(document, { childList: true, subtree: true });
  }, API);
  await page.goto(url, { waitUntil: 'networkidle' });
  await sleep(1500);
};
const out = {};
const page = await newPage(browser);
await withApi(page, `${srv.base}/pages/signup.html`);
const z = wizard(page);
try {
  await z.heading().waitFor();
  await z.w.getByLabel(en['consent.saveAnswers']).check();
  await z.submit().click(); await z.waitStep(2);
  await z.w.locator('input[autocomplete="given-name"]').fill('Meron');
  await z.w.locator('input[autocomplete="family-name"]').fill('Haile');
  await z.submit().click(); await z.waitStep(3);
  await z.w.locator('input[autocomplete="tel"]').fill('0911 234 567');
  await z.w.getByRole('button', { name: en['sms.send'] }).click();
  const link = z.w.locator('a[href*="resume"]').first();
  await link.waitFor({ timeout: 10000 });
  out.link = await link.getAttribute('href');
  out.smsCalls = page.requests.filter((r) => r.url.includes('resume-sms')).map((r) => `${r.method} ${r.url.replace(API, '')}`);
  const fresh = await newPage(browser);
  const target = new URL(out.link, srv.base);
  await withApi(fresh, target.toString());
  await sleep(2500);
  const fz = wizard(fresh);
  out.freshStep = await fz.stepNumber().catch(() => null);
  out.freshRestoredMessage = await fz.w.getByText(en['sms.restored']).count();
  if (out.freshStep === 1) {
    out.freshConsentTicked = await fz.w.getByLabel(en['consent.saveAnswers']).isChecked();
    if (!out.freshConsentTicked) await fz.w.getByLabel(en['consent.saveAnswers']).check();
    await fz.submit().click();
    await fz.waitStep(2);
    out.freshGivenNameAfterContinue = await fz.w.locator('input[autocomplete="given-name"]').inputValue().catch(() => '');
  } else if (out.freshStep && out.freshStep >= 2) {
    if (out.freshStep > 2) { await fz.w.locator('[data-db-action="back"]').click(); await fz.waitStep(2); }
    out.freshGivenName = await fz.w.locator('input[autocomplete="given-name"]').inputValue().catch(() => '');
  }
  out.freshCalls = fresh.requests.filter((r) => r.url.startsWith(API)).map((r) => `${r.method} ${r.url.replace(API, '')}`);
  // Single use: replay the same link
  const replay = await newPage(browser);
  await withApi(replay, target.toString());
  await sleep(2000);
  out.replayMessage = (await replay.locator('db-signup [role="status"]').first().textContent().catch(() => '')).trim();
  await fresh.close(); await replay.close();
} catch (e) { out.error = e.message.split('\n')[0]; }
save('resume.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close();
srv.close();
