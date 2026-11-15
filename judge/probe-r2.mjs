// Replays the round-2 voice-note check and prints what the field shows after "Record a voice note".
import { en, fill, launch, newPage, serve, sleep } from './lib.mjs';

const srv = await serve();
const browser = await launch();
const page = await newPage(browser, {
  init: () => {
    if (window.speechSynthesis) window.speechSynthesis.getVoices = () => [];
    class R extends EventTarget { start() { window.__activeRec = this; } stop() { this.onend?.(); } abort() {} }
    window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
    window.__gum = [];
    const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => { window.__gum.push(JSON.stringify(c)); return g(c).then((s) => { window.__gum.push('ok'); return s; }, (e) => { window.__gum.push('err ' + e.name); throw e; }); };
  },
});
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
const w = page.locator('db-signup');
await w.locator('h2[tabindex]').first().waitFor();
await w.getByLabel(en['consent.saveAnswers']).check();
await w.locator('form button[type=submit]').click();
await w.getByRole('heading', { level: 2, name: /2/ }).waitFor();
if (process.env.VC === '1') await page.keyboard.press('Alt+KeyV');
await sleep(600);
const rec = w.getByRole('button', { name: fill(en['note.record'], { field: en['field.givenName'] }) });
console.log('record buttons found:', await rec.count());
await rec.click();
await sleep(1500);
console.log('after click:', await page.evaluate(() => {
  const root = document.querySelector('db-signup').shadowRoot;
  const field = root.querySelector('input[autocomplete="given-name"]').closest('[data-db-field]');
  return { text: field.innerText.replace(/\s+/g, ' ').slice(0, 400), buttons: [...field.querySelectorAll('button')].map((b) => `${b.textContent.trim().slice(0, 40)} [${b.getAttribute('aria-pressed')}]`), note: field.querySelector('p.text-sm')?.textContent, paused: root.querySelector('[data-vc-paused]')?.getAttribute('data-vc-paused') };
}));
console.log('gum:', await page.evaluate(() => window.__gum));
console.log('page errors:', page.errors);
await browser.close();
srv.close();
