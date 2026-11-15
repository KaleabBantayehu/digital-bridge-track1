// Task 3 alone: "I have no document - refer me through a partner" must finish successfully (mock/offline mode).
import { axeScan, launch, newPage, save, serve } from './lib.mjs';
import { partnerRoute, typedOnboarding } from './flow.mjs';
const srv = await serve();
const browser = await launch();
const page = await newPage(browser);
await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
const out = {};
try {
  await typedOnboarding(page, 'en', {
    finished: async () => { out.finishedAxe = await axeScan(page); },
    'step7-review': async () => { out.reviewText = (await page.locator('db-signup').innerText()).match(/Refer[^\n]*|partner[^\n]*/gi)?.slice(0, 4); },
  }, { partner: async (L, w) => { await partnerRoute(L, w); out.voucherShown = (await w.getByText(/voucher code is/i).first().textContent()).trim(); out.voucherAxe = await axeScan(page); } });
  out.result = 'Y: finished onboarding via partner referral';
} catch (e) { out.result = 'N: ' + e.message.split('\n')[0]; }
save('task3.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close();
