import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const results = [];

function check(name, run) {
  try {
    run();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false });
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function attrsFromTag(tag) {
  const attrs = {};
  const source = tag.replace(/^<[^\s/>]+\s*|\/?\s*>$/g, '');
  const matcher = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(matcher)) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function scanHtml(html) {
  const tags = [...html.matchAll(/<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gi)].map((match) => ({
    raw: match[0],
    name: match[1].toLowerCase(),
    closing: match[0].startsWith('</'),
    attrs: attrsFromTag(match[0]),
  }));
  return tags;
}

function assertUniqueIds(file) {
  const ids = scanHtml(read(file))
    .filter((tag) => !tag.closing && Object.hasOwn(tag.attrs, 'id'))
    .map((tag) => tag.attrs.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], `${file} has duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
}

function getHeadings(html) {
  return [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
}

const registration = read('apps/web-components/src/index.ts');
const base = read('apps/web-components/src/base/ReactShadowElement.ts');
const store = read('apps/web-components/src/state/store.ts');
const persistence = read('apps/web-components/src/state/persistence.ts');
const queue = read('apps/web-components/src/state/syncQueue.ts');
const mockApi = read('apps/web-components/src/api/MockApiService.ts');
const apiClient = read('apps/web-components/src/api/ApiClient.ts');
const hostCss = read('apps/savanna-host-demo/assets/css/static-page.css');
const docs = read('docs/SAVANNA_FIXES.md');
const homepages = [
  'apps/savanna-host-demo/pages/homepage-v1-self-paced.html',
  'apps/savanna-host-demo/pages/homepage-v1-paced.html',
];
const concept = 'apps/savanna-host-demo/pages/concept-with-navigation.html';

check('1 Custom elements and open Shadow DOM', () => {
  for (const tag of ['db-onboarding-wizard', 'db-career-gateway', 'db-employer-accommodations']) {
    assert.match(registration, new RegExp(`customElements\\.get\\('${tag}'\\)`));
    assert.match(registration, new RegExp(`customElements\\.define\\('${tag}'`));
  }
  assert.match(base, /attachShadow\(\{\s*mode:\s*'open'\s*\}\)/);
  assert.match(base, /style\.textContent\s*=\s*styles/);
  assert.match(base, /index\.css\?inline/);
  assert.match(read('apps/web-components/src/elements/DbOnboardingWizardElement.tsx'), /<WizardShell\b/);
  assert.match(read('apps/web-components/src/elements/DbCareerGatewayElement.tsx'), /<CareerGateway\b/);
  assert.match(read('apps/web-components/src/elements/DbEmployerAccommodationsElement.tsx'), /<EmployerForm\b/);
  for (const attribute of ['api-url', 'partner-id', 'lang', 'theme', 'mode', 'lti-token', 'session-id']) {
    assert.ok(base.includes(`'${attribute}'`), `Missing observed attribute ${attribute}`);
  }
});

check('2 One-line auto-mount modes and script attributes', () => {
  assert.match(registration, /document\.scripts/);
  for (const mode of ['true', 'onboarding', 'career', 'both']) {
    assert.ok(registration.includes(`'${mode}'`), `Missing auto-mount mode ${mode}`);
  }
  for (const attribute of ['partnerId', 'lang', 'theme', 'apiUrl']) {
    assert.ok(registration.includes(`script.dataset.${attribute}`), `Missing data-${attribute}`);
  }
  assert.match(registration, /document\.body\.append\(widget\)/);
  assert.match(registration, /document\.querySelector\(tagName\)/);
});

check('3 Composed host events and consent-gated private data', () => {
  assert.match(base, /new CustomEvent\(name,\s*\{\s*detail:\s*safeDetail,\s*bubbles:\s*true,\s*composed:\s*true\s*\}\)/);
  assert.match(base, /shareWithEmployers/);
  assert.match(base, /shareSupportWithEmployer/);
  assert.match(base, /shareConsent/);
  assert.match(base, /redactPrivateSupportData/);
  assert.match(base, /supportPreferences\|accommodations\|adjustmentRequest\|filters\|needs/);
});

check('4 Scoped IndexedDB/localStorage persistence and debounce', () => {
  assert.match(persistence, /from 'idb-keyval'/);
  assert.match(persistence, /localStorageIfAvailable/);
  assert.match(persistence, /firstQueuedAt \+ 300/);
  assert.match(persistence, /db:\$\{partnerId\}:\$\{sessionId\}/);
  assert.match(store, /export interface OnboardingState/);
  for (const method of ['setLang', 'updateProfile', 'setStep', 'setStatusMessage', 'setProfileIdentity']) {
    assert.match(store, new RegExp(`\\b${method}:`));
  }
});

check('5 Ordered offline PATCH replay on online event', () => {
  assert.match(queue, /window\.addEventListener\('online'/);
  assert.match(queue, /enqueueProfilePatch/);
  assert.match(queue, /await activeClient\.saveStep/);
  assert.match(queue, /for \(const item of queue\)/);
  assert.match(queue, /await updateQueue/);
  assert.match(queue, /navigator\.onLine/);
});

check('6 Mock jobs, schema.org metadata, privacy and fallback data', () => {
  const count = (mockApi.match(/id: 'mock-job-\d+'/g) ?? []).length;
  assert.ok(count >= 8, `Expected at least 8 mock jobs, found ${count}`);
  assert.match(mockApi, /offeredAccommodations/);
  assert.match(mockApi, /https:\/\/schema\.org/);
  assert.match(mockApi, /'@type': 'JobPosting'/);
  assert.match(mockApi, /24 \* 60 \* 60 \* 1000/);
  assert.match(mockApi, /devLink: `\$\{window\.location\.origin\}\/\?resumeToken=/);
  assert.match(mockApi, /VOUCH-/);
  assert.match(mockApi, /verifyPartnerVoucher/);
  assert.match(mockApi, /exportMyData/);
  assert.match(mockApi, /deleteMyData/);
  const jobsMethod = mockApi.slice(mockApi.indexOf('async getJobs'), mockApi.indexOf('getJobPostingMetadata'));
  assert.doesNotMatch(jobsMethod, /console\.(log|info|warn|error)/);
});

check('7 Four-second API timeout and automatic mock fallback', () => {
  assert.match(apiClient, /new AbortController\(\)/);
  assert.match(apiClient, /setTimeout\(\(\) => controller\.abort\(\),\s*4_000\)/);
  assert.match(apiClient, /this\.activateMock\(\)/);
  assert.match(apiClient, /this\.mock\.getJobs/);
  assert.match(apiClient, /this\.mock\.saveStep/);
  assert.match(apiClient, /this\.mock\.apply/);
});

check('8 Native homepage hamburger and named logo links', () => {
  for (const file of homepages) {
    const tags = scanHtml(read(file));
    const hamburgers = tags.filter((tag) => !tag.closing && tag.attrs.class?.split(/\s+/).includes('hamburger'));
    assert.ok(hamburgers.length > 0, `${file} has no hamburger`);
    for (const button of hamburgers) {
      assert.equal(button.name, 'button', `${file} has a non-button hamburger`);
      assert.equal(button.attrs.type, 'button');
      assert.ok(button.attrs['aria-label']);
      assert.ok(button.attrs['aria-expanded']);
      assert.equal(button.attrs['aria-controls'], 'sidebar');
    }
    const logos = tags.filter((tag) => !tag.closing && tag.name === 'a' && tag.attrs.class?.split(/\s+/).includes('logo-container'));
    assert.ok(logos.length > 0, `${file} has no logo link`);
    assert.ok(logos.every((tag) => tag.attrs['aria-label'] === 'ALX Savanna Home'));
  }
});

check('9 Skip links, main headings, hierarchy and widget embedding', () => {
  for (const file of [...homepages, concept]) {
    const html = read(file);
    const tags = scanHtml(html);
    assert.ok(tags.some((tag) => tag.name === 'a' && tag.attrs.class?.split(/\s+/).includes('skip-link') && tag.attrs.href === '#main-content'), `${file} missing skip link`);
    assert.ok(tags.some((tag) => tag.name === 'main' && tag.attrs.id === 'main-content'), `${file} missing main landmark`);
    assert.equal(getHeadings(html).filter((level) => level === 1).length, 1, `${file} must have one h1`);
    const headings = getHeadings(html);
    for (let index = 1; index < headings.length; index += 1) {
      assert.ok(headings[index] <= headings[index - 1] + 1, `${file} skips heading level h${headings[index - 1]} to h${headings[index]}`);
    }
    assert.match(html, /<db-onboarding-wizard\b/);
    assert.match(html, /<db-career-gateway\b/);
  }
});

check('10 Focus scroll margin and visible focus ring', () => {
  assert.match(hostCss, /scroll-margin-top:\s*6rem/);
  assert.match(hostCss, /:focus-visible[\s\S]*outline:\s*3px\s+solid/);
});

check('11 No duplicate IDs on required host and demo pages', () => {
  for (const file of [
    ...homepages,
    concept,
    'apps/savanna-host-demo/standalone.html',
    'apps/savanna-host-demo/index.html',
    'apps/savanna-host-demo/external-partner-demo.html',
  ]) {
    assertUniqueIds(file);
  }
  assert.match(read('apps/savanna-host-demo/pages/homepage-v1-paced.html'), /id="markdown-guide-modal"/);
  assert.match(docs, /before host patches[\s\S]*after host patches/i);
});

check('12 Production bundle, copied pages, audio and gzip budget', () => {
  const build = spawnSync('pnpm', ['-F', '@db/web-components', 'build'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (build.status !== 0) {
    const output = `${build.stdout ?? ''}\n${build.stderr ?? ''}`.trim().split('\n').slice(-28).join('\n');
    throw new Error(`Production build failed (exit ${build.status ?? 'unknown'}):\n${output}`);
  }

  const bundlePath = join(root, 'apps/web-components/dist/db-widgets.v1.0.0.js');
  const bundle = readFileSync(bundlePath);
  const gzipKb = gzipSync(bundle).byteLength / 1024;
  assert.ok(gzipKb < 250, `Gzipped bundle is ${gzipKb.toFixed(2)} KB (target < 250 KB)`);
  for (const file of [
    'apps/web-components/dist/db-widgets.v1.0.0.js',
    'apps/web-components/dist/assets/js/db-widgets.v1.0.0.js',
    'apps/web-components/dist/index.html',
    'apps/web-components/dist/standalone.html',
    'apps/web-components/dist/external-partner-demo.html',
    'apps/web-components/dist/pages/homepage-v1-self-paced.html',
    'apps/web-components/dist/assets/audio/am/manifest.json',
  ]) {
    assert.ok(statSync(join(root, file)).isFile(), `Missing build output ${file}`);
  }
  console.log(`  gzipped bundle: ${gzipKb.toFixed(2)} KB`);
});

const passed = results.filter((result) => result.passed).length;
console.log(`\nDev 1 judge audit: ${passed}/12 passed.`);
if (passed !== results.length) process.exitCode = 1;
