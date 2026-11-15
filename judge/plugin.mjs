// Level 1 plug-in checks on demo/blank.html (globals, host styles, hostile CSS, size, events) and support-data
// separation against the running API (start apps/api first; API_BASE defaults to http://localhost:3000).
import { en, JUDGE, launch, newPage, save, serve, sleep } from './lib.mjs';
import { join } from 'node:path';
import { typedOnboarding } from './flow.mjs';

const API = (process.env.API_BASE ?? 'http://localhost:3000') + '/api/v1';
const srv = await serve();
const browser = await launch();
const out = {};

// Globals + host style changes: same page with and without the module script.
async function snapshot(stripScript) {
  const page = await newPage(browser);
  if (stripScript) {
    await page.route(/demo\/blank\.html$/, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: (await res.text()).replace(/<script type="module"[^>]*><\/script>/, '') });
    });
  }
  await page.goto(`${srv.base}/demo/blank.html`, { waitUntil: 'networkidle' });
  await sleep(600);
  const r = await page.evaluate(() => ({
    globals: Object.keys(window),
    styles: [...document.querySelectorAll('body, main, h1, h2, p, section, ol')].slice(0, 20).map((e) => { const c = getComputedStyle(e); return `${e.tagName}:${c.fontFamily}|${c.fontSize}|${c.color}|${c.margin}`; }),
    headAdds: [...document.head.children].map((e) => e.outerHTML.slice(0, 120)),
  }));
  await page.close();
  return r;
}
const without = await snapshot(true);
const withMod = await snapshot(false);
out.newGlobals = withMod.globals.filter((g) => !without.globals.includes(g));
out.hostStyleChanges = withMod.styles.filter((s, i) => s !== without.styles[i]);
out.headAdditions = withMod.headAdds.filter((h) => !without.headAdds.includes(h));

// Hostile host CSS must not restyle the widget.
{
  const page = await newPage(browser);
  await page.goto(`${srv.base}/demo/blank.html`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '* { all: revert; font-size: 40px !important; color: lime !important; } button { display: none !important; }' });
  await sleep(300);
  out.hostileCss = await page.evaluate(() => {
    const root = document.querySelector('db-signup').shadowRoot;
    const label = root.querySelector('label'); const btn = root.querySelector('button');
    return { labelFontSize: getComputedStyle(label).fontSize, labelColor: getComputedStyle(label).color, buttonDisplay: getComputedStyle(btn).display };
  });
  await page.screenshot({ path: join(JUDGE, 'screens', 'hostile-css.png') });
  await page.close();
}

// Host tokens: Savanna page (Bootstrap) vs blank page (fallbacks).
{
  const page = await newPage(browser);
  const read = () => page.evaluate(() => { const h = document.querySelector('db-signup'); const c = getComputedStyle(h); return { primary: c.getPropertyValue('--db-primary').trim(), font: c.fontFamily.slice(0, 60) }; });
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
  out.tokensInSavanna = await read();
  await page.goto(`${srv.base}/demo/blank.html`, { waitUntil: 'networkidle' });
  out.tokensOnBlank = await read();
  await page.close();
}

// First-load bytes on the blank host (all same-origin requests, gzipped as served).
{
  const before = srv.log.length;
  const page = await newPage(browser);
  await page.goto(`${srv.base}/demo/blank.html`, { waitUntil: 'networkidle' });
  await sleep(500);
  const reqs = srv.log.slice(before).filter((l) => l.status === 200);
  out.firstLoadBlank = { requests: reqs.length, kb: +(reqs.reduce((a, l) => a + l.bytes, 0) / 1024).toFixed(1), files: reqs.map((l) => l.path) };
  out.thirdParty = [...new Set(page.requests.map((r) => new URL(r.url).host).filter((h) => !h.startsWith('127.0.0.1')))];
  await page.close();
}

// API-backed run: what leaves the browser, and in which call, when the learner finishes with support needs.
{
  const page = await newPage(browser, {
    init: (api) => {
      window.__events = [];
      for (const n of ['db-signup:step', 'db-signup:done', 'db-signup:support', 'db:onboarding-completed', 'db:onboarding-step-saved']) document.addEventListener(n, (e) => window.__events.push({ n, detail: e.detail }));
      new MutationObserver(() => { const el = document.querySelector('db-signup'); if (el && !el.hasAttribute('api')) el.setAttribute('api', api); }).observe(document, { childList: true, subtree: true });
    },
  });
  await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((api) => document.querySelector('db-signup').setAttribute('api', api), API);
  await sleep(800);
  let error = '';
  try { await typedOnboarding(page, 'en', {}); } catch (e) { error = e.message.split('\n')[0]; }
  await sleep(1500);
  const apiCalls = page.requests.filter((r) => r.url.startsWith(API));
  const supportWords = /extra_time|sign_language|supportPreferences|"needs"/;
  out.apiRun = {
    error,
    calls: apiCalls.map((r) => `${r.method} ${r.url.replace(API, '')} ${supportWords.test(r.body) ? '<- CONTAINS SUPPORT DATA' : ''} ${/givenName|phone/.test(r.body) && supportWords.test(r.body) ? '<- PROFILE AND SUPPORT IN SAME CALL' : ''}`.trim()),
    events: (await page.evaluate(() => window.__events)).map((e) => `${e.n}: ${JSON.stringify(e.detail).slice(0, 140)}`),
    storageKeys: await page.evaluate(() => Object.keys(localStorage)),
  };
  await page.close();
}

await browser.close();
srv.close();
save('plugin.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 7000));
