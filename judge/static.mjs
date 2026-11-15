// Static checks: host files untouched (vs the original Savanna zip), licences, secrets, audit, README claims, Docker.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, save } from './lib.mjs';

const sh = (cmd, cwd = REPO) => { try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }); } catch (e) { return `ERROR ${e.status}: ${(e.stdout ?? '') + (e.stderr ?? '')}`.slice(0, 2000); } };
const md5 = (buf) => createHash('md5').update(buf).digest('hex');
const out = {};

// Host files vs the original starter zip (tar on Windows 10+ reads zip files).
const zip = join(REPO, 'Savanna-static-pages-main.zip');
out.hostFiles = {};
if (existsSync(zip)) {
  const list = sh(`tar -tf "${zip}"`).split('\n');
  for (const name of ['application_alx.css', 'app.css', 'static-page.js']) {
    const entry = list.find((l) => l.endsWith('/' + name));
    const local = readdirSync(join(REPO, 'apps/savanna-host-demo/assets'), { recursive: true }).find((p) => p.endsWith(name));
    if (!entry || !local) { out.hostFiles[name] = `not found (zip entry ${entry}, local ${local})`; continue; }
    const original = execSync(`tar -xOf "${zip}" "${entry}"`, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
    const mine = readFileSync(join(REPO, 'apps/savanna-host-demo/assets', local));
    const norm = (b) => b.toString('utf8').replace(/\r\n/g, '\n');
    out.hostFiles[name] = md5(norm(original)) === md5(norm(mine)) ? 'unchanged' : `CHANGED (${original.length} -> ${mine.length} bytes)`;
  }
} else out.hostFiles = 'starter zip not in repo';

// Licence file + dependency licences
out.licenceFile = ['LICENSE', 'LICENSE.md', 'LICENCE', 'COPYING'].filter((f) => existsSync(join(REPO, f)));
const lic = sh('pnpm licenses list --json --prod');
try {
  const j = JSON.parse(lic);
  out.licences = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, v.map((p) => p.name).slice(0, 40)]));
  out.copyleft = Object.keys(j).filter((k) => /GPL|AGPL|LGPL|Unknown|UNLICENSED/i.test(k));
} catch { out.licences = lic.slice(0, 300); }

// Audit (sends the dependency list to the npm registry, nothing else)
const audit = sh('pnpm audit --json');
try { const j = JSON.parse(audit); out.audit = j.metadata?.vulnerabilities ?? j; } catch { out.audit = audit.slice(0, 300); }

// Secrets: committed .env, hard-coded secrets in source (file:line only, never the value)
out.envCommitted = sh('git ls-files').split('\n').filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.example'));
out.secretLikeLines = sh('git grep -n -I -E "(secret|api[_-]?key|password|private[_-]?key)\\s*[:=]\\s*[\\"\'][^\\"\']{8,}" -- ":!*.lock" ":!pnpm-lock.yaml" ":!*.md" ":!*.json"').split('\n').filter(Boolean).map((l) => l.split(':').slice(0, 2).join(':'));
out.fallbackJwtSecret = sh('git grep -n "JWT_SECRET ||"').split('\n').filter(Boolean).map((l) => l.split(':').slice(0, 2).join(':'));

// Medical-proof language anywhere user-facing
out.medicalWords = sh('git grep -n -i -E "medical (proof|certificate|document)|diagnos|upload your" -- "apps/web-components/src" "packages/shared-schemas/src" "apps/api/src"').split('\n').filter(Boolean).slice(0, 12);

// Logging of bodies in the API
out.apiLogging = sh('git grep -n -E "console\\.log|Logger\\.(log|debug)\\(.*(body|phone|dto|support)" -- apps/api/src').split('\n').filter(Boolean).slice(0, 12);

// README claims
const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
const headings = [...readme.matchAll(/^##? (.+)$/gm)].map((m) => m[1]);
const required = ['Module name / title', 'team members', 'co-designer', 'What it does', 'The one task we tested', 'Run it', 'docker compose', 'Install Level 1', 'every event', 'Install Level 2', 'openapi.yaml', 'Install Level 3', 'Languages', 'Offline and slow', 'Data and privacy', 'Cost to run', 'Finished and not finished', 'Libraries and their licences', '21 October'];
out.readme = {
  headings,
  mentionsDockerCompose: /docker compose/i.test(readme),
  mentionsTeam: /team|member|co-designer/i.test(readme.replace(/Install|Level/g, '')),
  mentionsEvents: /db-signup:done/.test(readme),
  mentions21Oct: /21 Oct|October/i.test(readme),
  openapiYaml: existsSync(join(REPO, 'openapi.yaml')),
  openapiJson: existsSync(join(REPO, 'docs/openapi.json')),
  changelog: existsSync(join(REPO, 'CHANGELOG.md')),
  required,
};

// Docker
const dockerfile = readFileSync(join(REPO, 'Dockerfile'), 'utf8');
const webPkg = JSON.parse(readFileSync(join(REPO, 'apps/web-components/package.json'), 'utf8'));
out.docker = {
  cmd: dockerfile.match(/CMD .+/)?.[0],
  webDevScript: webPkg.scripts.dev,
  viteBindsAllInterfaces: /--host/.test(webPkg.scripts.dev),
  healthcheck: /HEALTHCHECK|healthcheck/.test(dockerfile + readFileSync(join(REPO, 'docker-compose.yml'), 'utf8')),
  frozenLockfile: !/frozen-lockfile=false/.test(dockerfile),
};

// Tests present
out.tests = sh('git ls-files "*.test.ts" "*.spec.ts" "e2e/*"').split('\n').filter(Boolean);
out.rootScripts = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts;

save('static.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 8000));
