# Digital Bridge Accessible Onboarding & Career Gateway (`<db-signup>` & `<db-career-gateway>`)

## What it does
Digital Bridge provides offline-first, bilingual (English and Amharic) onboarding and a privacy-preserving Career Gateway through Web Components, REST, and LTI 1.3. The same core capabilities work in partner pages, LMS hosts, Android WebViews, and low-connectivity environments.

The project uses native controls, explicit labels, keyboard navigation, visible focus, Shadow DOM focus management, bilingual errors and live regions, 44px targets, 400% reflow, and a high-contrast theme. Support preferences are isolated and never shared without explicit consent.

### 21 October Co-Design Feedback → What We Built

| Barrier heard on 21 October | What we built |
| --- | --- |
| Forms timed out or erased progress | Offline-first drafts persist on the device, with no expiry and resumable SMS links. |
| Learners had no Kebele ID | Inclusive identity routes accept national ID, refugee ID, community documents, or a consented partner voucher; no Kebele ID is mandatory. |
| Fear of disclosing disability to employers | Support preferences are private, stored separately, excluded from normal profiles and applications, and shared only with explicit consent. |
| Speech recognition failed on Ethiopian names | Voice answers remain editable for review, voice-note fallback works offline, and the Fidel helper supports Amharic transliteration. |
| Budget Android phones lacked Amharic TTS | The cascade uses an installed OS voice, then bundled neural Amharic audio, then a synchronized visual caption bar. |
| Job boards broke under screen readers | Jobs use semantic headings and links, keyboard-accessible filters, live result counts, and embedded `schema.org/JobPosting` metadata. |

## The main task we tested
Learners can complete onboarding by keyboard, screen reader, typing, voice with review and edit, Amharic or English, and resume later without losing their draft. The journey also covers inclusive identity verification, SMS resume, Ethiopian dates, private support preferences, job matching, applications, and bilingual recovery from validation errors.

**Yours to answer:**

- **A refugee has no document tonight:** They can continue with the refugee-ID route when available, a community document, or a consented partner voucher; no medical proof or mandatory Kebele ID blocks onboarding.
- **The connection drops on question 7:** The current draft is saved locally on every change and the API client queues patches; the learner reloads or returns later without losing answers.
- **Someone cannot read finishes alone:** One question appears at a time with native controls, keyboard and voice control, Read Aloud, bundled Amharic audio, visual captions, simple words, and editable voice-note review.
- **A partner registers a learner with consent without learning a password:** The partner uses the partner-vouch route with explicit learner consent; the learner receives a session and can resume through the one-time SMS link, with no password disclosed.

## Run it
Node 20+ and pnpm (`corepack enable`). The demo pages are static files, so build once and serve `dist/`:

```bash
corepack enable
pnpm install
pnpm build
npx serve apps/web-components/dist -l 5173
```

Then open:

| Page | Address |
| --- | --- |
| Sign-up inside Savanna | http://localhost:5173/pages/signup.html (add `?lang=am` for Amharic) |
| My Profile (edit mode) | http://localhost:5173/pages/profile.html |
| Career Gateway + employer form | http://localhost:5173/pages/jobs.html |
| Outside Savanna (no Bootstrap) | http://localhost:5173/demo/blank.html |
| All demo pages | http://localhost:5173/ |

The REST API (optional — the widgets work offline without it): `cd apps/api && node dist/main.js`, then
http://localhost:3000/api/v1/health and Swagger UI at http://localhost:3000/api/docs. The first start can take a few
minutes on a slow laptop.

Docker: `docker compose up --build` builds everything and starts the API on port 3000 and the Vite **development**
page on 5173. We have not been able to run Docker on our build machine yet, and the container currently runs the Vite
dev server, so use the commands above to see the Savanna pages.

For widget development with hot reload: `pnpm dev` (standalone dev page on http://localhost:5173, API on 3000).

## Install, Level 1
```html
<script type="module" src="https://example.invalid/db-signup.js"></script>
<db-signup lang="am"></db-signup>
```

The `<db-signup>` alias accepts `api`, `lang`, `partner-id`, `theme`, `mode`,
and `audio-base-url`. It emits composed onboarding, completion, support, and
error events without private support data unless explicitly shared.

## Install, Level 2
OpenAPI document: `docs/openapi.json` (also live at http://localhost:3000/api/docs-json). Every call below was run
against `node apps/api/dist/main.js` on 15 Nov 2026. On Windows PowerShell type `curl.exe` instead of `curl`.

```bash
# 1. Health
curl -s http://localhost:3000/api/v1/health

# 2. Start an onboarding session (returns the profile with its "id")
curl -s -X POST http://localhost:3000/api/v1/onboarding/sessions -H 'content-type: application/json' -d '{"lang":"en","partnerId":"demo"}'

# 3. Save a step; a bad phone number returns 422 with an English + Amharic message (replace SESSION_ID)
curl -s -X PATCH http://localhost:3000/api/v1/onboarding/sessions/SESSION_ID -H 'content-type: application/json' -d '{"step":"contact","data":{"phone":"123"}}'

# 4. List jobs (the learner's support filter runs in the browser, not here)
curl -s http://localhost:3000/api/v1/career/jobs

# 5. Get a development bearer token for partner calls (demo credentials, development only)
curl -s -X POST http://localhost:3000/api/v1/auth/token -H 'content-type: application/json' -d '{"clientId":"demo-partner","clientSecret":"demo-secret","scopes":["career:write"]}'
```

Every error, from validation (422) to not found (404), uses one envelope: `statusCode`, `error`,
`summary.en`, `summary.am` and a `fields` list.

The same API supports SMS resume, partner vouchers, applications, privacy export/delete and LTI 1.3.

## Install, Level 3
Use the REST API and LTI 1.3 integration under `/api/v1`, or host the generated Web Component bundle in any LMS or partner page. The `pages/jobs.html` Career Gateway embeds valid `schema.org/JobPosting` JSON-LD in each job card so external job boards can ingest listings without custom adapters.

LTI 1.3 uses OIDC login initiation and verifies RS256 signatures, state, nonce,
issuer, audience, expiry, and required claims; invalid launches return bilingual
401 responses before the tool renders. The Mock LMS Judge Launchpad at
`apps/savanna-host-demo/mock-lms/index.html` signs real launch tokens and
exercises the verification path end to end.

## Languages
English and Amharic are included. Adding Afaan Oromo (`om.json`), Tigrinya
(`ti.json`), Somali (`so.json`), or Arabic (`ar.json`) requires one JSON file
and running `node scripts/generate-tts-audio.mjs`; the resolver accepts the
language tag, uses an installed OS voice when available, then a manifest clip,
then an always-visible caption bar. Arabic can use `dir="rtl"` and CSS logical
properties such as `margin-inline-start`.

Voice support includes editable review before acceptance, spoken number and
symbol conversion (`zero nine one one` or `ዜሮ ዘጠኝ አንድ አንድ` to `0911…`),
Ethiopic numerals, and spoken email forms such as “at gmail dot com”. The
Fidel helper converts `abebe` to `አበበ` and `addis ababa` to `አዲስ አበባ`.

### Sign language, colours and other ways in
- **Sign language (Ethiopian Sign Language):** every voice field has "Answer … in sign language". It records a short
  video of the learner signing (camera, `MediaRecorder`, up to 20 s), kept on the device like a voice note so the
  learner can continue without typing; a person who knows EthSL reads it. The panel also offers number / letter /
  word cards and an optional camera wave control (hand movement on the left, middle or right of the picture moves
  back, chooses, or moves forward). **It does not recognise or translate signs automatically**, and no video is
  uploaded or sent to any cloud or AI service. Pictures of EthSL hand shapes are to be added with Deaf co-designers.
- **Colours:** a Colours menu in the help bar and in the host top bar switches every widget between Warm (default),
  Colour-blind safe (blue and gold), High contrast and Dark. Hovered controls get a dashed border and chosen ones are
  inverted with a ✓ in every mode, so state never depends on colour alone. Hosts can set `vision="dark"` (or
  `colorblind-safe`, `high-contrast`) on any widget.

## Offline and slow connection
Drafts persist on the device, API failures use the deterministic mock service,
and static neural audio clips are served from the local manifest cache. Voice
control is hands-free: press the first control or `Alt + V`, then say
*next / back / repeat / down / up / choose / answer / help / stop* or
*ቀጥል / ተመለስ / ድገም / ታች / ላይ / ምረጥ / መልስ / እርዳታ / አቁም*.
Each command has a visible confirmation and screen-reader announcement.

Measured Slow 3G load (time until the first question can be used, gzip as served by any web host,
`db-signup.js` = **158 KB gzipped**, 2 requests on the blank page):

| Profile | `demo/blank.html` | `pages/signup.html` (Savanna) |
| --- | --- | --- |
| Chrome "Slow 3G" (400 kbit/s, 400 ms) | 4.2 s | 8.5 s (Savanna's own CSS is about 1.3 MB) |
| Judge profile (500 kbit/s, 400 ms, CPU 4× slower) | 5.4 s | 7.7 s |

No fonts or scripts are loaded from other websites; Ethiopic text uses the device's own Noto Sans Ethiopic / Nyala
fonts.

## Data and privacy
Support preferences are stored separately and are never sent to employers or analytics without explicit consent. Learners can export or delete their data.

## Cost to run
For 3,000 learners the target monthly cost is **$0–$5**: a static Web
Component bundle, SQLite/Docker backend, zero-cost build-time neural TTS
generation, and browser `MediaRecorder` / `SpeechRecognition`, with no paid AI
or cloud lock-in. The bundle is **147.5 KB gzipped**, below the 250 KB target.

## Finished and not finished
The API, compatibility routes, accessibility checks, offline behavior, i18n
fallback architecture, neural audio packs, and documentation are implemented.
The Amharic wording and real-device NVDA, TalkBack, microphone, and native
voice experience still need co-designer validation.

## Libraries and their licences
React, Vite, NestJS, TypeScript, Zod, Playwright, axe-core, lucide-react, and edge-tts are used under their respective permissive open-source licences. Verify current licence texts before redistribution.
