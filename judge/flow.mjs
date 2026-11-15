// Wizard / career helpers shared by the gate and task scripts. Selectors come from en.json / am.json so the same
// code drives both languages and fails loudly if a label disappears.
import { am, en, esc, fill, sleep } from './lib.mjs';

export const dict = (lang) => (lang === 'am' ? am : en);

export function wizard(page, host = 'db-signup') {
  const w = page.locator(host).first();
  return {
    w,
    heading: () => w.locator('h2[tabindex="-1"]').first(),
    submit: () => w.locator('form button[type=submit]').first(),
    async stepNumber() {
      const text = (await w.locator('h2[tabindex="-1"]').first().textContent()) ?? '';
      const m = text.match(/(\d+)/);
      return m ? Number(m[1]) : null;
    },
    async waitStep(n) {
      for (let i = 0; i < 50; i++) { if ((await this.stepNumber()) === n) return true; await sleep(100); }
      return false;
    },
  };
}

/** Typed onboarding, step by step. `hooks[state]` is awaited at each named state (used for axe scans). */
export async function typedOnboarding(page, lang, hooks = {}, opts = {}) {
  const L = dict(lang);
  const z = wizard(page);
  const { w } = z;
  const hook = async (name) => { if (hooks[name]) await hooks[name](); };
  await z.heading().waitFor();
  await hook('step1-welcome');
  await z.submit().click(); // continue without consent -> error state
  await w.locator('[role="alert"]').first().waitFor();
  await hook('step1-error');
  await w.getByLabel(L['consent.saveAnswers']).check();
  await z.submit().click();
  await z.waitStep(2);
  await hook('step2-name');
  await z.submit().click();
  await w.locator('[role="alert"]').first().waitFor();
  await hook('step2-error');
  await w.locator('input[autocomplete="given-name"]').fill(lang === 'am' ? 'አበበ' : 'Abebe');
  await w.locator('input[autocomplete="family-name"]').fill(lang === 'am' ? 'ከበደ' : 'Kebede');
  await z.submit().click();
  await z.waitStep(3);
  await hook('step3-contact');
  await w.locator('input[autocomplete="tel"]').fill('123');
  await z.submit().click();
  await w.locator('[role="alert"]').first().waitFor();
  await hook('step3-error');
  await w.locator('input[autocomplete="tel"]').fill('0911 234 567');
  if (opts.sms) await opts.sms(L, w);
  await z.submit().click();
  await z.waitStep(4);
  await hook('step4-dob');
  await z.submit().click();
  await w.locator('[role="alert"]').first().waitFor();
  await hook('step4-error');
  const selects = w.locator('fieldset select');
  // Day / Month / Year in DOM order (Ethiopian calendar is the default).
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const options = await selects.nth(i).locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    await selects.nth(i).selectOption(i === count - 1 ? options[Math.min(20, options.length - 1)] : options[0]);
  }
  await z.submit().click();
  await z.waitStep(5);
  await hook('step5-identity');
  await z.submit().click();
  await w.locator('[role="alert"]').first().waitFor();
  await hook('step5-error');
  if (opts.partner) {
    await opts.partner(L, w, z);
  } else {
    await w.getByLabel(L['id.national_id_or_passport']).check();
    await w.getByLabel(L['field.referenceNumber']).fill('ET1234567');
  }
  await z.submit().click();
  await z.waitStep(6);
  await hook('step6-support');
  await w.getByLabel(L['need.extra_time']).check();
  await w.getByLabel(L['need.sign_language_captions']).check();
  await z.submit().click();
  await z.waitStep(7);
  await hook('step7-review');
  await z.submit().click();
  await w.getByText(L['review.finishedTitle']).first().waitFor();
  await hook('finished');
}

/** "I have no document — refer me through a partner", with consent. */
export async function partnerRoute(L, w) {
  await w.getByLabel(L['id.partner_voucher']).check();
  const partner = w.getByLabel(new RegExp('^' + esc(L['field.partnerId'])));
  const values = await partner.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
  await partner.selectOption(values[0]);
  await w.getByLabel(new RegExp('^' + esc(L['field.agentId']))).fill('Selam Tesfaye');
  await w.getByLabel(L['partner.consent']).check();
  const ask = w.getByRole('button', { name: L['partner.request'] });
  if (await ask.count()) {
    await ask.click();
    await w.getByText(new RegExp(esc(fill(L['partner.vouched'], { code: '' }).trim().slice(0, 12)))).first().waitFor({ timeout: 8000 });
  }
}

export { fill, esc };
