// Why does axe report target-size on help-cluster buttons in some states? Checks what covers them.
import { launch, newPage, serve, sleep, en, AxeBuilder } from './lib.mjs';
import { typedOnboarding } from './flow.mjs';

const srv = await serve();
const browser = await launch();
const page = await newPage(browser);
await page.goto(`${srv.base}/pages/signup.html`, { waitUntil: 'networkidle' });
let report = '';
try {
  await typedOnboarding(page, 'en', {
    'step6-support': async () => {
      const r = await new AxeBuilder({ page }).withRules(['target-size']).analyze();
      const v = r.violations[0];
      report += `scrollY=${await page.evaluate(() => scrollY)}\n`;
      for (const n of v?.nodes ?? []) report += `${n.target.join(' ')}\n  ${n.failureSummary.replace(/\n/g, '\n  ')}\n  related: ${(n.any.concat(n.all, n.none)).flatMap((c) => c.relatedNodes.map((x) => x.target.join(' '))).join(' | ')}\n`;
      const covered = await page.evaluate(() => {
        const host = document.querySelector('db-signup');
        const btn = host.shadowRoot.querySelector('[aria-haspopup="dialog"]:nth-child(5)') ?? host.shadowRoot.querySelectorAll('[aria-haspopup="dialog"]')[1];
        const r = btn.getBoundingClientRect();
        const bar = document.querySelector('.db-savanna-topbar')?.getBoundingClientRect();
        return { btn: [Math.round(r.top), Math.round(r.bottom)], topbar: bar && [Math.round(bar.top), Math.round(bar.bottom)], topbarPosition: getComputedStyle(document.querySelector('.db-savanna-topbar')).position };
      });
      report += JSON.stringify(covered) + '\n';
    },
  });
} catch (e) { report += 'stopped: ' + e.message.split('\n')[0]; }
console.log(report);
await browser.close();
srv.close();
