// Which element covers the focused control? (G3 found focused controls hidden behind something.)
import { launch, newPage, serve, sleep } from './lib.mjs';

const srv = await serve();
const browser = await launch();
const page = await newPage(browser);
await page.goto(`${srv.base}/pages/jobs.html`, { waitUntil: 'networkidle' });
await sleep(600);
const out = [];
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('Tab');
  const r = await page.evaluate(() => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    let top = document.elementFromPoint(cx, cy);
    while (top?.shadowRoot) { const inner = top.shadowRoot.elementFromPoint(cx, cy); if (!inner || inner === top) break; top = inner; }
    if (b.bottom < 0 || b.top > innerHeight) return null;
    const covered = !(top === el || el.contains(top) || top?.contains?.(el));
    const name = (el.labels?.[0]?.textContent || el.textContent || '').trim().slice(0, 30);
    return covered ? `${name} @y=${Math.round(b.top)}..${Math.round(b.bottom)} covered by <${top?.tagName.toLowerCase()} class="${(top?.className ?? '').toString().slice(0, 50)}">` : null;
  });
  if (r) out.push(r);
}
console.log(out.join('\n') || 'nothing covered');
await browser.close();
srv.close();
