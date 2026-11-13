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

Load the versioned bundle and add the custom elements to any HTML page:

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

Supported settings include `api-url`, `partner-id`, `lang` (`en` or `am`),
`theme` (`terracotta` or `high-contrast`), and `mode` (`standalone`, `lti`, or
`partner-assisted`).

The widgets emit the shared CustomEvents
`db:onboarding-step-saved`, `db:onboarding-completed`,
`db:support-requested`, `db:job-filter-changed`, `db:job-applied`, and
`db:error`. Events bubble across the Shadow DOM boundary and never include
private support or accommodation data without explicit consent.

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
