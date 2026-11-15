// Level 2 / Level 3 API checks against a running API (default http://localhost:3000).
//   node apps/api/dist/main.js   (in apps/api)   then   node judge/api.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, save } from './lib.mjs';

const BASE = process.env.API_BASE ?? 'http://localhost:3000';
const out = {};
const call = async (method, path, { body, headers = {}, origin } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}), ...headers },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  return { status: res.status, json, cors: res.headers.get('access-control-allow-origin') };
};

for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/api/v1/health'); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

// 1. README curl examples, verbatim (curl.exe on Windows).
const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
const curls = [...readme.matchAll(/^curl .+$/gm)].map((m) => m[0]);
out.readmeCurls = curls.map((line) => {
  try {
    const args = line.replace(/^curl /, '').match(/"(?:[^"\\]|\\.)*"|\S+/g).map((a) => (a.startsWith('"') ? a.slice(1, -1).replace(/\\"/g, '"') : a));
    const res = execFileSync('curl', ['-s', '-w', '\\nHTTP %{http_code}', ...args], { encoding: 'utf8' });
    return { line, result: res.trim().split('\n').slice(-2).join(' | ').slice(0, 220) };
  } catch (e) { return { line, result: `curl failed: ${e.message.slice(0, 120)}` }; }
});

// 2. Docs
out.docs = {};
for (const p of ['/docs', '/api/docs', '/api/v1/docs', '/openapi.yaml', '/api/docs-json']) out.docs[p] = (await call('GET', p)).status;

// 3. Status codes + one error envelope across failure types
const created = await call('POST', '/api/v1/onboarding/sessions', { body: { lang: 'en', partnerId: 'demo' } });
out.create = { status: created.status, keys: Object.keys(created.json ?? {}) };
const id = created.json?.id ?? created.json?.sessionId;
const failures = {
  'bad phone (422?)': await call('PATCH', `/api/v1/onboarding/sessions/${id}`, { body: { step: 'contact', data: { phone: '123' } } }),
  'unknown field (400)': await call('POST', '/api/v1/onboarding/sessions', { body: { lang: 'en', partnerId: 'demo', evil: 1 } }),
  'malformed JSON': await call('POST', '/api/v1/onboarding/sessions', { body: '{"lang":' }),
  'missing session (404)': await call('GET', '/api/v1/onboarding/sessions/00000000-0000-0000-0000-000000000000'),
  'unknown route (404)': await call('GET', '/api/v1/nope'),
  'bad resume token': await call('GET', '/api/v1/onboarding/resume/not-a-token'),
  'privacy export without token (401?)': await call('GET', '/api/v1/privacy/export'),
  'post job without token (401?)': await call('POST', '/api/v1/career/jobs', { body: { title: 'x' } }),
  'vouch without partner key': await call('POST', '/api/v1/onboarding/partner-vouch', { body: { sessionId: id, partnerId: 'aaapd', agentId: 'x', consent: true } }),
};
out.failures = Object.fromEntries(Object.entries(failures).map(([k, v]) => [k, {
  status: v.status,
  envelope: v.json && typeof v.json === 'object' ? Object.keys(v.json).join(',') : 'not JSON',
  bilingual: !!(v.json?.summary?.en && v.json?.summary?.am),
  sample: JSON.stringify(v.json).slice(0, 160),
}]));

// 4. Tokens and scopes
const tok = await call('POST', '/api/v1/auth/token', { body: { partnerId: 'demo', apiKey: 'demo-key', scopes: ['jobs:read'] } });
out.token = { status: tok.status, sample: JSON.stringify(tok.json).slice(0, 200) };

// 5. CORS
out.cors = (await call('GET', '/api/v1/health', { origin: 'https://evil.example' })).cors;

// 6. Job filter privacy (server-side filter exists?) + JobPosting fields
const jobs = await call('GET', '/api/v1/career/jobs?accommodations=remote');
out.jobsFilterParam = { status: jobs.status, count: Array.isArray(jobs.json) ? jobs.json.length : jobs.json?.items?.length ?? jobs.json?.data?.length };
const jobsAll = await call('GET', '/api/v1/career/jobs');
const first = Array.isArray(jobsAll.json) ? jobsAll.json[0] : (jobsAll.json?.items ?? jobsAll.json?.data ?? [])[0];
out.jobSample = JSON.stringify(first).slice(0, 400);

// 7. XSS / injection strings are stored inertly?
const xss = await call('PATCH', `/api/v1/onboarding/sessions/${id}`, { body: { step: 'name', data: { givenName: '<img src=x onerror=alert(1)>', familyName: "' OR 1=1 --" } } });
out.xss = { status: xss.status, sample: JSON.stringify(xss.json).slice(0, 160) };

// 8. LTI
for (const p of ['/api/v1/lti/jwks', '/api/v1/lti/login']) out[`lti ${p}`] = (await call('GET', p)).status;
out['lti launch tampered'] = (await call('POST', '/api/v1/lti/launch', { body: { id_token: 'x.y.z', state: 'bad' } })).status;

save('api.json', out);
console.log(JSON.stringify(out, null, 1));
