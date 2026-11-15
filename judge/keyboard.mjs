// G3 keyboard-only main task (page.keyboard only, no mouse) + G4 accessibility-tree proxy.
import { activeInfo, am, en, fill, launch, newPage, save, serve, sleep } from './lib.mjs';
import { typedOnboarding, wizard } from './flow.mjs';

const srv = await serve();
const browser = await launch();
const log = [];
const problems = [];
let keys = 0;

async function press(page, key) { keys++; await page.keyboard.press(key); await sleep(60); }
async function type(page, text) { keys += text.length; await page.keyboard.type(text, { delay: 5 }); }

/** Tab forward until `want(active)` is true; checks focus visibility and obscuring on every stop. */
async function tabTo(page, want, label, host, max = 80) {
  for (let i = 0; i < max; i++) {
    await press(page, 'Tab');
    const a = await activeInfo(page, host);
    if (a) {
      log.push({ label, ...a });
      if (!a.outlineOk && a.tag !== 'body') problems.push(`no >=2px outline on ${a.tag} "${a.name}" (${a.outline})`);
      if (a.obscured && a.inView) problems.push(`focused ${a.tag} "${a.name}" is covered by another element`);
      if (a.tabindex && Number(a.tabindex) > 0) problems.push(`positive tabindex on ${a.tag} "${a.name}"`);
      if (want(a)) return a;
    }
  }
  throw new Error(`could not reach "${label}" by Tab within ${max} presses`);
}
const named = (re) => (a) => re.test(a.name);
const headingFocused = async (page, host) => (await activeInfo(page, host))?.tag === 'h2';

const result = {};
// ---------------- onboarding, keyboard only ----------------
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  const z = wizard(page);
  await z.heading().waitFor();
  const H = 'db-signup';
  const steps = [];
  try {
    await press(page, 'Tab');
    const skip = await activeInfo(page, H);
    steps.push(`first Tab lands on: ${skip?.name}`);
    await tabTo(page, named(new RegExp(en['consent.saveAnswers'])), 'consent', H);
    await press(page, 'Space');
    await tabTo(page, named(/^Continue/), 'continue', H);
    await press(page, 'Enter');
    await z.waitStep(2);
    steps.push(`step 2 heading focused: ${await headingFocused(page, H)}`);
    await tabTo(page, (a) => a.tag === 'input' && /First name/.test(a.name), 'first name', H);
    await type(page, 'Abebe');
    await tabTo(page, (a) => a.tag === 'input' && /Father/.test(a.name), 'father name', H);
    await type(page, 'Kebede');
    await tabTo(page, named(/^Continue/), 'continue', H);
    await press(page, 'Enter');
    await z.waitStep(3);
    steps.push(`step 3 heading focused: ${await headingFocused(page, H)}`);
    await tabTo(page, (a) => a.type === 'tel', 'phone', H);
    await type(page, '0911234567');
    await tabTo(page, named(/^Continue/), 'continue', H);
    await press(page, 'Enter');
    await z.waitStep(4);
    for (const label of [en['dob.day'], en['dob.month'], en['dob.year']]) {
      await tabTo(page, (a) => a.tag === 'select' && a.name.startsWith(label), label, H);
      await press(page, 'ArrowDown');
      if (label === en['dob.year']) for (let i = 0; i < 20; i++) await press(page, 'ArrowDown');
    }
    await tabTo(page, named(/^Continue/), 'continue', H);
    await press(page, 'Enter');
    const onStep5 = await z.waitStep(5);
    if (!onStep5) {
      const err = await page.locator('db-signup [role="alert"]').first().textContent().catch(() => '');
      throw new Error(`date step did not accept keyboard selection: ${err}`);
    }
    await tabTo(page, (a) => a.type === 'radio', 'identity radio', H);
    await press(page, 'Space');
    await tabTo(page, (a) => a.tag === 'input' && /ID number/.test(a.name), 'ID number', H);
    await type(page, 'ET1234567');
    await tabTo(page, named(/^Continue/), 'continue', H);
    await press(page, 'Enter');
    await z.waitStep(6);
    await tabTo(page, named(/Extra time/), 'extra time', H);
    await press(page, 'Space');
    await tabTo(page, named(/^Continue/), 'continue', H);
    await press(page, 'Enter');
    await z.waitStep(7);
    await tabTo(page, named(/^Finish onboarding/), 'finish', H);
    await press(page, 'Enter');
    await page.locator('db-signup').getByText(en['review.finishedTitle']).first().waitFor({ timeout: 5000 });
    steps.push('finished onboarding');
    // Dialog: open by keyboard, Escape, focus returns to opener.
    await tabTo(page, named(/^My data/), 'My data', H);
    await press(page, 'Enter');
    await sleep(300);
    const inDialog = await page.evaluate(() => !!document.querySelector('db-signup').shadowRoot.activeElement?.closest('dialog[open]'));
    await press(page, 'Escape');
    await sleep(200);
    const back = await activeInfo(page, H);
    steps.push(`privacy dialog: focus inside=${inDialog}, after Esc focus on "${back?.name}"`);
    const positive = await page.evaluate(() => {
      const all = [...document.querySelectorAll('[tabindex]')];
      document.querySelectorAll('*').forEach((h) => h.shadowRoot && all.push(...h.shadowRoot.querySelectorAll('[tabindex]')));
      return all.filter((e) => Number(e.getAttribute('tabindex')) > 0).length;
    });
    steps.push(`elements with positive tabindex: ${positive}`);
    result.onboarding = { completed: 'Y', keys, steps };
  } catch (e) {
    result.onboarding = { completed: 'N', keys, steps, error: e.message.split('\n')[0] };
  }
  await page.close();
}

// ---------------- career, keyboard only ----------------
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/jobs.html`, { waitUntil: 'networkidle' });
  await sleep(600);
  const H = 'db-career-gateway';
  const k0 = keys;
  const steps = [];
  try {
    await tabTo(page, named(/Remote work/), 'remote filter', H);
    await press(page, 'Space');
    await tabTo(page, named(/^Apply for/), 'apply', H, 120);
    await press(page, 'Enter');
    await sleep(400);
    await tabTo(page, (a) => a.tag === 'input' && /First name/.test(a.name), 'apply first name', H);
    await type(page, 'Abebe');
    await tabTo(page, (a) => a.tag === 'input' && /Father/.test(a.name), 'apply father name', H);
    await type(page, 'Kebede');
    await tabTo(page, (a) => a.type === 'tel', 'apply phone', H);
    await type(page, '0911234567');
    await tabTo(page, (a) => a.tag === 'textarea', 'cover note', H);
    await type(page, 'I write clearly and like helping people.');
    await tabTo(page, named(/^Send application/), 'send', H);
    await press(page, 'Enter');
    await page.locator(H).getByText(/application for .* was sent/i).first().waitFor({ timeout: 6000 });
    steps.push('application sent');
    result.career = { completed: 'Y', keys: keys - k0, steps };
  } catch (e) {
    result.career = { completed: 'N', keys: keys - k0, steps, error: e.message.split('\n')[0] };
  }
  await page.close();
}

// ---------------- G4: accessibility tree (proxy for a screen reader) ----------------
const g4 = {};
for (const lang of ['en', 'am']) {
  const page = await newPage(browser);
  await page.goto(`${srv.base}/pages/signup.html${lang === 'am' ? '?lang=am' : ''}`, { waitUntil: 'networkidle' });
  const snaps = {};
  const checks = {};
  const check = async (state) => {
    snaps[state] = await page.locator('db-signup').ariaSnapshot();
    checks[state] = await page.evaluate(() => {
      const root = document.querySelector('db-signup').shadowRoot;
      const h2 = [...root.querySelectorAll('h2')].filter((h) => h.getClientRects().length && !h.closest('dialog'));
      const fields = [...root.querySelectorAll('input:not([type=hidden]),select,textarea')].filter((e) => e.getClientRects().length);
      const unnamed = fields.filter((e) => !(e.labels?.length || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby'))).map((e) => e.outerHTML.slice(0, 80));
      const brokenRefs = [];
      root.querySelectorAll('[aria-describedby],[aria-labelledby],[aria-controls]').forEach((e) => {
        for (const attr of ['aria-describedby', 'aria-labelledby', 'aria-controls']) {
          for (const id of (e.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) if (!root.getElementById(id)) brokenRefs.push(`${attr}=${id}`);
        }
      });
      const status = root.querySelectorAll('[role=status][aria-live]');
      const invalid = fields.filter((e) => e.getAttribute('aria-invalid') === 'true').map((e) => (e.getAttribute('aria-describedby') ?? '').split(/\s+/).some((id) => root.getElementById(id)?.textContent.trim()));
      // Language of every visible text node (ancestor lang, crossing the shadow boundary to the host).
      const wrong = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent.trim();
        if (!text || n.parentElement.closest('style,script')) continue;
        const lang = n.parentElement.closest('[lang]')?.getAttribute('lang') ?? document.querySelector('db-signup').getAttribute('lang');
        if (/[ሀ-፿]/.test(text) && lang !== 'am') wrong.push(`Ethiopic in lang=${lang}: "${text.slice(0, 30)}"`);
        if (!/[ሀ-፿]/.test(text) && /[A-Za-z]{4,}/.test(text) && lang === 'am') wrong.push(`Latin in lang=am: "${text.slice(0, 40)}"`);
      }
      return { h2: h2.map((h) => h.textContent.trim()), unnamed, brokenRefs, statusRegions: status.length, statusText: status[0]?.textContent.trim().slice(0, 80), invalidFieldsWithMessage: invalid, langMismatches: wrong.slice(0, 8) };
    });
  };
  const hooks = {};
  for (const st of ['step1-welcome', 'step1-error', 'step2-name', 'step3-contact', 'step3-error', 'step4-dob', 'step5-identity', 'step6-support', 'step7-review', 'finished']) hooks[st] = () => check(st);
  try { await typedOnboarding(page, lang, hooks); } catch (e) { checks.error = e.message.split('\n')[0]; }
  save(`g4-aria-${lang}.yml`, Object.entries(snaps).map(([k, v]) => `# ${k}\n${v}`).join('\n\n'));
  g4[lang] = checks;
  await page.close();
}

save('g3-keyboard.json', { result, problems: [...new Set(problems)], tabLog: log });
save('g4-aria-checks.json', g4);
console.log('G3:', JSON.stringify(result, null, 1));
console.log('G3 focus problems:', [...new Set(problems)].slice(0, 15).join('\n  ') || 'none');
for (const [lang, c] of Object.entries(g4)) {
  for (const [st, v] of Object.entries(c)) {
    if (st === 'error') { console.log(`G4 [${lang}] ERROR ${v}`); continue; }
    const flags = [v.h2.length !== 1 && `h2 count ${v.h2.length}`, v.unnamed.length && `unnamed ${v.unnamed.length}`, v.brokenRefs.length && `broken refs ${v.brokenRefs.join(',')}`, v.statusRegions !== 1 && `status regions ${v.statusRegions}`, v.invalidFieldsWithMessage.includes(false) && 'invalid field without message', v.langMismatches.length && `lang: ${v.langMismatches.join(' ; ')}`].filter(Boolean);
    console.log(`G4 [${lang}] ${st}: h2="${v.h2[0] ?? ''}" ${flags.join(' | ') || 'ok'}`);
  }
}
await browser.close();
srv.close();
