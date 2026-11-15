// Replays the voice-control part of scripts/judge-audit.mjs step by step and prints the state after each command.
import { launch, newPage, serve, sleep } from './lib.mjs';

const srv = await serve();
const browser = await launch();
const page = await newPage(browser, {
  init: () => {
    if (window.speechSynthesis) window.speechSynthesis.getVoices = () => [];
    class R extends EventTarget { start() { window.__activeRec = this; } stop() { this.onend?.(); } abort() { if (window.__activeRec === this) window.__activeRec = null; } }
    window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
    window.__say = (t) => { const r = window.__activeRec; if (!r) return false; r.onresult?.({ results: [[{ transcript: t, confidence: 1 }]] }); return true; };
  },
});
const say = async (t) => { for (let i = 0; i < 20 && !(await page.evaluate((x) => window.__say(x), t)); i++) await sleep(100); await sleep(500); };
const state = (label) => page.evaluate((l) => {
  const root = document.querySelector('db-signup').shadowRoot;
  return `${l}: checked=${root.querySelector('input[type=checkbox]')?.checked} dialogOpen=${!!root.querySelector('dialog[open]')} badges=${root.querySelectorAll('[data-vc-num]').length}`;
}, label);
const holders = () => page.evaluate(() => [...document.querySelector('db-signup').shadowRoot.querySelectorAll('[data-vc-num]')]
  .map((e) => `${e.getAttribute('data-vc-num')}:${e.tagName}:${e.textContent.trim().slice(0, 25)}`).join(' | '));
const checkbox = () => page.evaluate(() => {
  const i = document.querySelector('db-signup').shadowRoot.querySelector('input[type=checkbox]');
  return `checkbox id=${i.id} labels=${i.labels?.length} rects=${i.getClientRects().length} visible=${i.checkVisibility?.()}`;
});

await page.goto(`${srv.base}/pages/signup.html?lang=am`, { waitUntil: 'networkidle' });
const w = page.locator('db-signup');
await w.locator('h2[tabindex]').first().waitFor();
await page.keyboard.press('Alt+KeyV');
await sleep(800);
console.log(await state('on'));
console.log(await holders());
console.log(await checkbox());
await browser.close();
srv.close();
