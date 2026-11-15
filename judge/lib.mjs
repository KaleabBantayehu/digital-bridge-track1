// Shared helpers for the judge scripts. Read-only: nothing here writes outside judge/out.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

export const JUDGE = resolve(import.meta.dirname);
export const REPO = resolve(process.env.JUDGE_REPO ?? join(JUDGE, '..'));
export const DIST = join(REPO, 'apps/web-components/dist');
export const OUT = join(JUDGE, 'out');
mkdirSync(OUT, { recursive: true });
mkdirSync(join(JUDGE, 'screens'), { recursive: true });

const require = createRequire(join(REPO, 'package.json'));
export const { chromium } = require('@playwright/test');
export const { AxeBuilder } = require('@axe-core/playwright');
export { AxeBuilder as Axe };

export const en = JSON.parse(readFileSync(join(REPO, 'apps/web-components/src/i18n/en.json'), 'utf8'));
export const am = JSON.parse(readFileSync(join(REPO, 'apps/web-components/src/i18n/am.json'), 'utf8'));
export const fill = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

/** Plain static server over dist/ (like `python -m http.server`, plus gzip like any real host). Logs every request. */
export async function serve({ gzip = true } = {}) {
  const log = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    let file = resolve(DIST, '.' + path);
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { log.push({ path, status: 404 }); res.writeHead(404).end(); return; }
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    let body = readFileSync(file);
    const headers = { 'Content-Type': type };
    if (gzip && /gzip/.test(req.headers['accept-encoding'] ?? '') && /text|javascript|json|svg/.test(type)) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
    log.push({ path, status: 200, bytes: body.length });
    res.writeHead(200, headers).end(body);
  });
  // Chrome refuses some ports (ERR_UNSAFE_PORT, e.g. 6000, 6665-6669, 10080); keep asking the OS until it gives a safe one.
  const UNSAFE_PORTS = new Set([1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);
  for (;;) {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    if (!UNSAFE_PORTS.has(server.address().port)) break;
    await new Promise((r) => server.close(r));
  }
  return { base: `http://127.0.0.1:${server.address().port}`, log, close: () => server.close() };
}

export async function launch(extraArgs = []) {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...extraArgs];
  try { return await chromium.launch({ args }); } catch { return chromium.launch({ channel: 'chrome', args }); }
}

/** New page that records every request and page error. `blockFonts` keeps third-party font calls out of timing runs. */
export async function newPage(browser, { viewport = { width: 1280, height: 800 }, init, offline = false } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.requests = [];
  page.errors = [];
  page.on('request', (r) => page.requests.push({ url: r.url(), method: r.method(), body: r.postData() ?? '' }));
  page.on('pageerror', (e) => page.errors.push(String(e)));
  if (init) await page.addInitScript(init);
  if (offline) await context.setOffline(true);
  return page;
}

export async function axeScan(page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const by = (impact) => r.violations.filter((v) => v.impact === impact).length;
  return {
    critical: by('critical'), serious: by('serious'), moderate: by('moderate'), minor: by('minor'),
    rules: r.violations.map((v) => `${v.id}(${v.impact}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`),
  };
}

/** The widget's shadow-root active element (document.activeElement is only the host). */
export const activeInfo = (page, host = 'db-signup') =>
  page.evaluate((hostSel) => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // Not obscured: the element found at its centre is the element or inside it (checks across shadow roots).
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let top = document.elementFromPoint(cx, cy);
    while (top?.shadowRoot) { const inner = top.shadowRoot.elementFromPoint(cx, cy); if (!inner || inner === top) break; top = inner; }
    const name = el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.textContent || el.getAttribute('href') || el.tagName;
    return {
      tag: el.tagName.toLowerCase(), type: el.type ?? '', name: name.replace(/\s+/g, ' ').trim().slice(0, 70),
      tabindex: el.getAttribute('tabindex'),
      outline: `${cs.outlineStyle} ${cs.outlineWidth}`, outlineOk: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
      inView: r.bottom > 0 && r.top < innerHeight,
      obscured: !(top && (top === el || el.contains(top) || top.contains?.(el))),
      w: Math.round(r.width), h: Math.round(r.height), host: hostSel,
    };
  }, host);

export function save(name, data) {
  const file = join(OUT, name);
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return file;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
