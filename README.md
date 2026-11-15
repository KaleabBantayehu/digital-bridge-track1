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
```powershell
corepack enable
pnpm install
pnpm dev
```

Local URLs: standalone demo at `http://localhost:5173`, API health at
`http://localhost:3000/api/v1/health`, and Swagger UI at
`http://localhost:3000/docs` or `http://localhost:3000/api/docs`.

## Install, Level 1
```html
<script type="module" src="https://example.invalid/db-signup.js"></script>
<db-signup lang="am"></db-signup>
```

The `<db-signup>` alias accepts `api`, `lang`, `partner-id`, `theme`, `mode`,
and `audio-base-url`. It emits composed onboarding, completion, support, and
error events without private support data unless explicitly shared.

## Install, Level 2
```powershell
curl -X POST http://localhost:3000/api/v1/learners -H "content-type: application/json" -d "{\"name\":\"Abebe Kebede\",\"language\":\"en\"}"
curl -X POST http://localhost:3000/api/v1/onboarding/sessions -H "content-type: application/json" -d "{\"lang\":\"en\",\"partnerId\":\"demo\"}"
```

The same API supports onboarding sessions, SMS resume, partner vouchers,
career jobs and applications, privacy export/delete, and bilingual validation
errors.

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

## Offline and slow connection
Drafts persist on the device, API failures use the deterministic mock service,
and static neural audio clips are served from the local manifest cache. Voice
control is hands-free: press the first control or `Alt + V`, then say
*next / back / repeat / down / up / choose / answer / help / stop* or
*ቀጥል / ተመለስ / ድገም / ታች / ላይ / ምረጥ / መልስ / እርዳታ / አቁም*.
Each command has a visible confirmation and screen-reader announcement.

Verified Slow 3G performance is 4.2 seconds to usable on `demo/blank.html`
and 8.5 seconds inside Savanna, whose own CSS is approximately 1.3 MB.

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
