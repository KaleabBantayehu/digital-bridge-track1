// Does keyboard focus scroll the focused control into view? Lists focus stops that end up off-screen.
import { launch, newPage, serve, sleep } from './lib.mjs';
const srv = await serve();
const browser = await launch();
for (const path of ['pages/jobs.html', 'pages/signup.html']) {
  const page = await newPage(browser);
  await page.goto(`${srv.base}/${path}`, { waitUntil: 'networkidle' });
  await sleep(600);
  const off = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    await sleep(700);
    const r = await page.evaluate(() => {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      const b = el.getBoundingClientRect();
      return { name: (el.labels?.[0]?.textContent || el.textContent || el.tagName).trim().slice(0, 30), top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, sy: Math.round(scrollY) };
    });
    if (r.bottom < 0 || r.top > r.vh) off.push(`${r.name} top=${r.top} vh=${r.vh} scrollY=${r.sy}`);
  }
  console.log(path, off.length ? `${off.length} off-screen focus stops:\n  ${off.slice(0, 6).join('\n  ')}` : 'every focus stop scrolled into view');
  await page.close();
}
await browser.close();
srv.close();
