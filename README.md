# Digital Bridge Accessibility Hackathon 2026

## Track 1: Accessible Onboarding

Digital Bridge provides an offline-first, bilingual (English and Amharic)
onboarding journey for learners, together with a privacy-preserving Career
Gateway. The project exposes the same core capabilities through:

1. Web Components for partner pages and LMS hosts
2. A versioned REST API under `/api/v1`
3. LTI 1.3 for LMS launch, grade passback, roster progress, and deep linking

The implementation is designed for WCAG 2.2 AA, low-connectivity environments,
Android WebViews, and Ethiopian learner needs. Read
[CLAUDE.md](./CLAUDE.md) for the binding engineering and accessibility rules,
[TRACK_1_MASTER_REQUIREMENTS.md](./TRACK_1_MASTER_REQUIREMENTS.md) for product
requirements, and
[TEAM_TASKS_AND_ACCOUNTABILITY_CHARTER.md](./TEAM_TASKS_AND_ACCOUNTABILITY_CHARTER.md)
for ownership.

## Repository layout

```text
apps/
├── web-components/       React 19 + Vite custom elements
├── api/                  NestJS + TypeORM REST and LTI services
└── savanna-host-demo/    Patched Savanna pages and Mock LMS launchpad
packages/
└── shared-schemas/       Zod schemas, types, i18n, calendar, phone, and events
scripts/                  PowerShell API verification suites
e2e/                      Playwright and axe accessibility gate tests
```

## Quick start

### Prerequisites

- Node.js 20 or newer LTS
- pnpm 9 or newer
- No paid API keys are required

### Install and run

```powershell
git clone https://github.com/KaleabBantayehu/digital-bridge-track1.git
Set-Location digital-bridge-track1
corepack enable
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
pnpm dev
```

Use pnpm for all dependency operations. Do not commit `package-lock.json` or
`yarn.lock`.

### Local URLs

| Service | URL |
| --- | --- |
| Standalone Web Components demo | http://localhost:5173 |
| REST health check | http://localhost:3000/api/v1/health |
| Swagger / OpenAPI | http://localhost:3000/api/docs |

Build the Web Component bundle with:

```powershell
pnpm -F @db/web-components build
```

Run the full automated gate with:

```powershell
pnpm gate
```

## Partner integration

The shortest install is one script and one tag (Technical Guide §3–§4):

```html
<script type="module" src="https://your-module.example/db-signup.js"></script>
<db-signup lang="am" api="https://your-module.example/api/v1"></db-signup>
<script>
  document.addEventListener('db-signup:done', (e) => console.log(e.detail));
</script>
```

`<db-signup>` is an alias of `<db-onboarding-wizard>`, and `api` is an alias of `api-url`. The same file is
published as `db-signup.js`, `module/db-signup.js`, `assets/js/db-signup.js` and the versioned
`db-widgets.v1.0.0.js`.

The longer form with every widget:

```html
<script type="module"
  src="https://your-cdn.example.com/db-widgets.v1.0.0.js"></script>

<db-onboarding-wizard
  api-url="http://localhost:3000/api/v1"
  partner-id="alx-savanna"
  lang="en"
  theme="terracotta"
  mode="standalone">
</db-onboarding-wizard>

<db-career-gateway
  api-url="http://localhost:3000/api/v1"
  partner-id="alx-savanna"
  lang="en"
  theme="terracotta">
</db-career-gateway>
```

If `api-url` is missing or unreachable, the client automatically uses the
deterministic offline `MockApiService`. Draft data remains on the device and is
synced when connectivity returns.

Supported settings include `api-url` (or `api`), `partner-id`, `lang` (`en` or `am`),
`theme` (`terracotta` or `high-contrast`), `mode` (`standalone`, `edit`, `lti`, or
`partner-assisted`), and `audio-base-url` (folder that holds `audio/am/manifest.json` for read-aloud
fallback clips; `pages/*.html` use `../assets`).

The widgets emit the shared CustomEvents
`db:onboarding-step-saved`, `db:onboarding-completed`,
`db:support-requested`, `db:job-filter-changed`, `db:job-applied`, and
`db:error`, plus the Technical Guide v2 contract:

| Event | `detail` |
| --- | --- |
| `db-signup:step` | `{ step, of }` (1-based, once per step change) |
| `db-signup:done` | `{ profile: { name, phone, language, idRoute }, voiceNotes }`, never support choices |
| `db-signup:support` | `{ support: [...] }`, sent separately and only when the learner chose to share |

Events bubble across the Shadow DOM boundary (`composed: true`) and never include
private support or accommodation data without explicit consent.

### Where to see it

| Page (after `pnpm -F @db/web-components build`, serve `apps/web-components/dist`) | What it proves |
| --- | --- |
| `pages/signup.html` | `<db-signup>` inside Savanna; listens for `db-signup:done` and links to the learner homepage |
| `pages/profile.html` | `<db-signup mode="edit">`: review and edit answers, export or delete data |
| `pages/jobs.html` | Career Gateway + employer accommodations form + schema.org `JobPosting` JSON-LD |
| `pages/homepage-v1-self-paced.html`, `homepage-v1-paced.html`, `concept-with-navigation.html` | Savanna pages patched only through `assets/css/host-a11y-fixes.css` and `assets/js/host-a11y-fixes.js` |
| `demo/blank.html` | Outside Savanna: no Bootstrap, no Savanna CSS, same widgets |

Add `?lang=am` to signup, profile or jobs, or use the English / አማርኛ switch in the top bar.

## Voice, Amharic and low-literacy support

- **Answer by voice** on every text field (browser Web Speech API, `am-ET` or `en-US`). The transcript always
  lands in an editable review box with **Read back my answer** and **Use this answer**; nothing is auto-submitted.
- **Spoken numbers and symbols:** "ዜሮ ዘጠኝ አንድ አንድ …" or "zero nine one one …" becomes `0911…`; Ethiopic
  numerals (፩–፱) are accepted; "abebe at gmail dot com" / "… አት … ዶት com" becomes an e-mail address.
- **Voice notes:** "Record a voice note instead" (MediaRecorder) on free-text fields. When Amharic speech-to-text
  is missing or fails (no text after 5 s, or `language-not-supported`, `network`, `not-allowed`, …), the
  widget switches to recording a voice note by itself and explains why. A kept note answers the field.
- **Voice control** (hands-free, for learners who cannot see the screen or cannot type or point): turn it on with
  the first button in the widget or **Alt + V**, then say *next / back / repeat / down / up / choose / answer /
  help / stop* (or ቀጥል / ተመለስ / ድገም / ታች / ላይ / ምረጥ / መልስ / እርዳታ / አቁም). Each command gets a soft cue,
  a visible confirmation and a screen-reader announcement. If the device has no Amharic recognition it says so and
  listens for the English words.
- **Read aloud** uses an installed voice when there is one. Otherwise it plays a bundled cue and always shows a
  caption box with the current phrase highlighted, so it also works with the sound off.
- **Fidel helper** (Amharic UI): type sounds with English letters (`abebe` → አበበ, `addis ababa` → አዲስ አበባ)
  and fix the last letter's vowel with one tap.
- **Simple words** switch, icons with each choice, Ethiopian calendar (13 months, Intl Ethiopic formatting in
  Amharic), Ethiopian phone formats (`09…`, `07…`, `+251…`).

## Verified on 14 November 2026

| Check | Command | Result |
| --- | --- | --- |
| Type check | `pnpm typecheck` | web-components and API clean |
| Unit tests | `pnpm -F @db/web-components test` | 27 / 27 |
| Judge audit of built pages (axe en + am, overlap, reflow, voice fallback, voice control, captions, 404s) | `node scripts/judge-audit.mjs` | 103 / 103, 0 axe violations of any impact |
| Dev 1 audit | `node scripts/test-dev1.mjs` | 13 / 13 |
| API judge checks | `scripts/test-api.ps1` (API running) | 13 / 13 |
| Bundle | Vite build | 597 KB raw, **148.5 KB gzipped** (budget 250 KB) |
| Slow 3G (400 ms, 400 kbit/s, gzipped) | CDP emulation | widget usable in 4.2 s on `demo/blank.html`, 8.5 s inside Savanna (its own 1.3 MB CSS) |

Details and the criterion-by-criterion table: [CONFORMANCE.md](./CONFORMANCE.md) and
[WCAG_2_2_AA_CONFORMANCE_REPORT.md](./WCAG_2_2_AA_CONFORMANCE_REPORT.md).

### Known limitations

- NVDA, TalkBack, real microphones and real Amharic voices have not been tested with a co-designer yet.
- The bundled read-aloud files are tone cues, not recorded Amharic speech (regenerate with
  `node scripts/generate-audio-cues.mjs`; replace with native-speaker recordings through the manifest).
- Chrome's speech recognition sends audio to Google's speech service; voice notes stay on the device.
- The Amharic wording needs a native-speaker review.

## REST API

All routes are versioned under `/api/v1` and return bilingual validation
errors. Core endpoints include:

- `POST|PATCH|GET /onboarding/sessions`
- `POST /onboarding/sessions/:id/resume-sms`
- `GET /onboarding/resume/:token`
- `POST /onboarding/partner-vouch`
- `GET|POST /career/jobs`
- `POST /career/applications`
- `GET /privacy/export`
- `DELETE /privacy/data`
- `GET|POST /lti/login`
- `POST /lti/launch`
- `POST /lti/ags/sync`
- `GET /lti/nrps/roster`
- `POST /lti/deep-link`
- `GET /lti/jwks`

Example API checks:

```powershell
$session = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/v1/onboarding/sessions" `
  -ContentType "application/json" `
  -Body '{"lang":"en","partnerId":"alx-demo"}'

try {
  Invoke-RestMethod -Method Patch `
    -Uri "http://localhost:3000/api/v1/onboarding/sessions/$($session.id)" `
    -ContentType "application/json" `
    -Body '{"step":"contact","data":{"phone":"123"}}'
} catch {
  $_.ErrorDetails.Message
}
```

## LTI 1.3

The Mock LMS signs real RS256 launch tokens so the production verification path
is exercised locally. Launch validation checks state, JWKS signature, issuer,
audience, time claims, nonce, and required LTI claims. Any failure returns a
bilingual `401 Unauthorized` response and does not render the tool.

LTI Advantage support includes AGS completion passback, privacy-safe NRPS
progress, and deep linking for the Onboarding Wizard and Career Gateway.

## Accessibility and privacy commitments

- Native HTML controls, explicit labels, keyboard navigation, visible focus, and
  focus management within Shadow DOM
- Error summaries, field-level errors, bilingual live status messages, and
  screen-reader language switching
- No timeouts that erase data, CAPTCHA puzzles, paste blocking, or medical proof
- 44px minimum targets, 400% zoom reflow, reduced-motion support, and
  high-contrast theme
- Browser-native speech with editable review before acceptance and graceful
  text fallback
- Support preferences stored separately and never logged, analyzed, or shared
  with employers without explicit consent
- One-click export and deletion through the privacy API

The accessibility gate requires zero serious or critical axe-core findings on
both the standalone demo and Savanna host page, plus keyboard and co-designer
completion of the main journey. See section 9 of
[CLAUDE.md](./CLAUDE.md) for the complete definition of done.

## Team branches

| Role | Branch | Ownership |
| --- | --- | --- |
| Dev 1 | `feat/dev1-shadow-host` | Shadow DOM, offline sync, host fixes |
| Dev 2 | `feat/dev2-wizard-a11y` | Wizard, voice/TTS, Career Gateway UI |
| Dev 3 | `feat/dev3-api-v1` | REST API, voucher/SMS, privacy |
| Dev 4 | `feat/dev4-lti-qa` | LTI, Mock LMS, Playwright, axe CI |

Do not push directly to `main`. Open a pull request with the accessibility gate
checklist completed.


---

## ??? ZERO-CONFLICT & ZERO-WAITING MODULE BRIDGES (MANDATORY)

To guarantee zero Git merge conflicts, zero duplicate work, and zero waiting between team members, the repository has been pre-wired with **Module Bridges**. Every human developer and AI coding agent MUST obey these strict file-ownership and interface boundaries:

### 1. Strict Folder & File Locks (Never Edit Outside Your Scope)
| Role & Branch | ALLOWED Paths (ONLY Edit These) | FORBIDDEN Paths (NEVER Edit These) |
| :--- | :--- | :--- |
| **Dev 1**<br>(`feat/dev1-shadow-host`) | ? `apps/web-components/src/index.ts`<br>? `apps/web-components/src/{base,elements,state,api,styles}/**`<br>? `apps/savanna-host-demo/{index.html,standalone.html,pages/**,assets/**}` | ? `apps/web-components/src/{wizard,fields,voice,tts,career,i18n}/**`<br>? `apps/savanna-host-demo/mock-lms/**`<br>? `apps/api/**` |
| **Dev 2**<br>(`feat/dev2-wizard-a11y`) | ? `apps/web-components/src/{wizard,fields,voice,tts,career,i18n}/**`<br>? `apps/web-components/dev2-preview.html` *(optional local harness)* | ? `apps/web-components/src/{index.ts,base/**,elements/**,state/**,api/**}`<br>? `apps/savanna-host-demo/**`<br>? `apps/api/**` |
| **Dev 3**<br>(`feat/dev3-api-v1`) | ? `apps/api/src/core-api.module.ts`<br>? `apps/api/src/{common,auth,onboarding,vouch,sms,career,privacy,seed}/**`<br>? `scripts/test-api.ps1` | ? `apps/api/src/main.ts` *(already imports CoreApiModule & LtiModule)*<br>? `apps/api/src/lti/**`<br>? `apps/web-components/**` & `e2e/**` |
| **Dev 4**<br>(`feat/dev4-lti-qa`) | ? `apps/api/src/lti/**` *(register all LTI controllers/services in `lti.module.ts`)*<br>? `apps/savanna-host-demo/mock-lms/**`<br>? `e2e/**`, `playwright.config.ts`, `.github/workflows/**` | ? `apps/api/src/main.ts` & `apps/api/src/core-api.module.ts`<br>? `apps/api/src/{onboarding,career,privacy}/**`<br>? `apps/web-components/**` |

### 2. Lockfile & Shared-Schema Freeze Rule
- **No Unannounced `pnpm add`:** All required packages (`react`, `zustand`, `idb-keyval`, `react-hook-form`, `zod`, `lucide-react`, `jose`, `sql.js`, `class-validator`, `@axe-core/playwright`) are already installed. Do NOT run `pnpm add` or modify `package.json` / `pnpm-lock.yaml` without Team Lead approval.
- **Additive-Only Shared Contracts:** Never rename or delete existing exports in `packages/shared-schemas/src/index.ts`, `WizardShellProps`, `CareerGatewayProps`, or `OnboardingState`.

### 3. Pre-Wired Decoupling Bridges (Zero Waiting)
1. **Dev 1 ? Dev 2 Bridge:**
   - Dev 1 mounts `<WizardShell />` (from `src/wizard/WizardShell.tsx`) and `<CareerGateway />` (from `src/career/CareerGateway.tsx`) inside the Shadow DOM custom elements without editing Dev 2's files.
   - Dev 2 imports `useOnboardingStore` from `../state/store` without editing Dev 1's store or custom element files. If Dev 2 needs a new store action, post `[CONTRACT]` in team chat and Dev 1 adds it in 2 minutes.
2. **Frontend (Dev 1 & 2) ? Backend (Dev 3) Bridge:**
   - The frontend uses `ApiClient` which automatically falls back to `MockApiService` (`localStorage`) whenever `api-url` is omitted, times out (> 4s), or returns a network error. Frontend never waits on Backend.
3. **Dev 3 ? Dev 4 NestJS Bridge:**
   - `apps/api/src/main.ts` is locked and already imports both `CoreApiModule` (`./core-api.module`) and `LtiModule` (`./lti/lti.module`). Dev 3 registers all REST modules inside `CoreApiModule`; Dev 4 registers all LTI 1.3 providers/controllers inside `LtiModule`.

### 4. Checkpoint PR & Squash-Merge Protocol
1. Every **45 minutes**, push your branch: `git push origin feat/devN-...`.
2. Before opening a Pull Request at each 2-hour checkpoint:
   - Run `pnpm build:schemas && pnpm typecheck && pnpm build` locally and ensure zero errors.
   - Run `git fetch origin main && git merge origin/main` on your branch and resolve any local issues before requesting review.
3. **Team Lead Squash-Merges PRs into `main`** (which triggers the automatic Vercel HTTPS production build), and all 4 developers immediately run `git pull origin main` into their working branches.
