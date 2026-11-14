# Digital Bridge Accessible Onboarding & Career Gateway (`<db-signup>` & `<db-career-gateway>`)

## What it does
Digital Bridge provides offline-first accessible onboarding and a privacy-preserving Career Gateway through Web Components, REST, and LTI.

## The main task we tested
Learners can complete onboarding by keyboard, screen reader, typing, voice with review and edit, Amharic or English, and resume later without losing their draft.

## Run it
```powershell
corepack enable
pnpm install
pnpm dev
```

## Install, Level 1
```html
<script type="module" src="https://example.invalid/db-signup.js"></script>
<db-signup lang="am"></db-signup>
```

## Install, Level 2
```powershell
curl -X POST http://localhost:3000/api/v1/learners -H "content-type: application/json" -d "{\"name\":\"Abebe Kebede\",\"language\":\"en\"}"
curl -X POST http://localhost:3000/api/v1/onboarding/sessions -H "content-type: application/json" -d "{\"lang\":\"en\",\"partnerId\":\"demo\"}"
```

## Install, Level 3
Use the REST API and LTI 1.3 integration under `/api/v1`, or host the generated Web Component bundle in any LMS or partner page.

## Languages
English and Amharic are included. Adding Afaan Oromo (`om.json`), Tigrinya (`ti.json`), Somali (`so.json`), or Arabic (`ar.json`) requires one JSON file and running `node scripts/generate-tts-audio.mjs`; the resolver accepts the language tag, uses an installed OS voice when available, then a manifest clip, then an always-visible caption bar. Arabic can use `dir="rtl"` and CSS logical properties such as `margin-inline-start`.

## Offline and slow connection
Drafts persist on the device, API failures use the deterministic mock service, and static audio clips are served from the local manifest cache.

## Data and privacy
Support preferences are stored separately and are never sent to employers or analytics without explicit consent. Learners can export or delete their data.

## Cost to run
For 3,000 learners the target monthly cost is **$0–$5**: a static Web Component bundle, SQLite/Docker backend, zero-cost build-time neural TTS generation, and browser `MediaRecorder` / `SpeechRecognition`, with no paid AI or cloud lock-in.

## Finished and not finished
The API, compatibility routes, accessibility checks, offline behavior, i18n fallback architecture, and documentation are implemented. Neural audio generation requires network access to the free Edge TTS service; when unavailable, the script fails rather than claiming synthesized placeholders are real speech.

## Libraries and their licences
React, Vite, NestJS, TypeScript, Zod, Playwright, axe-core, lucide-react, and edge-tts are used under their respective permissive open-source licences. Verify current licence texts before redistribution.
