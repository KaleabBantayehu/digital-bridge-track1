// Writes en.json / am.json (Technical Guide v2 §3: "Text lives in language files") from the single source of truth
// in @db/shared-schemas (CLAUDE.md §1: i18n strings live only there). Run after `pnpm build:schemas`:
//   node apps/web-components/src/i18n/sync-json.mjs          -> regenerate
//   node apps/web-components/src/i18n/sync-json.mjs --check  -> exit 1 if the JSON files are out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../package.json'));
const { I18N } = require('@db/shared-schemas');
const check = process.argv.includes('--check');
let stale = 0;

for (const lang of ['en', 'am']) {
  const file = join(here, `${lang}.json`);
  const sorted = Object.fromEntries(Object.entries(I18N[lang]).sort(([a], [b]) => a.localeCompare(b)));
  const json = `${JSON.stringify(sorted, null, 2)}\n`;
  if (check) {
    let current = '';
    try { current = readFileSync(file, 'utf8'); } catch { /* missing */ }
    if (current !== json) { stale++; console.error(`${lang}.json is out of date`); }
  } else {
    writeFileSync(file, json, 'utf8');
    console.log(`wrote ${lang}.json (${Object.keys(sorted).length} strings)`);
  }
}
process.exit(stale ? 1 : 0);
