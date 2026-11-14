# HACKATHON_PLAN.md — Live Execution Plan (Sat 14 Nov 10:50 → Sun 15 Nov 16:30)

**Audience: the 4 developers and every AI coding agent working in this repo.**
Companion files: `CLAUDE.md` (coding law) · `TRACK_1_MASTER_REQUIREMENTS.md` (what we build) · `TEAM_TASKS_AND_ACCOUNTABILITY_CHARTER.md` (contracts, cards, fairness).
**This file is the schedule. When it conflicts with the Charter's older Friday timeline, this file wins.** When it conflicts with the organisers' slides, the slides win.

---

## 0. How to use this file (humans and agents)

1. Find your dev role (§4). Work **only** the first unticked box in your current sprint block. Tick it (`[x]`) in your PR when done.
2. Stay inside your **Scope** paths. Need something in another dev's scope? Post `[BLOCKED]` or `[CONTRACT]` in chat; do not edit their files silently.
3. Anything marked **★ MVP** is the bare minimum that survives a Yellow Card (Charter Rule 3). Do ★ items first, polish later.
4. Before saying "done", run the checks in `CLAUDE.md` §9 and paste evidence in the PR.
5. Agents: do not invent endpoints, fields, events or error codes. They are in `packages/shared-schemas` (Charter §0). If missing, add additively and announce.
6. Never push to `main` directly. Branches: `feat/dev1-shadow-host`, `feat/dev2-wizard-a11y`, `feat/dev3-api-v1`, `feat/dev4-lti-qa`. Team lead squash-merges.

---

## 1. What the organisers said (from the opening presentation, 14 Nov)

**The gate (pass/fail — a module that fails is not scored):**
1. A co-designer completes the main task **unaided** with NVDA, TalkBack, keyboard only, **200% zoom**, and **sound off**. *(We test 200% and 400%.)*
2. axe-core: **0 critical, 0 serious**.
3. A **WCAG 2.2 AA conformance report** submitted with the code.

**Score (100):** 30 works for the people it is for (co-designer scores, tasks done unaided, 21 Oct feedback used) · 25 can be adopted by another platform · 15 built for Ethiopia · 15 quality, security & privacy · 15 can be kept running (low cost, no paid-API lock-in, README a stranger can follow).

**Submit by Sun 16:30:** **code, README, Docker Compose, WCAG 2.2 AA conformance report.**

**Adoption test:** a judge installs the module in **one hour from our documentation alone**.
- Level 1: one `<script>` tag. Level 2: REST API with OpenAPI spec. Level 3: open standard (we do **LTI 1.3**; schema.org/JobPosting on seeded jobs is a cheap extra).

**Track 1 must-haves:** clear labels, plain errors, no time-outs, one question per screen · voice input on every field with review & edit · private support request, no medical proof · other ID routes (refugee ID, other documents, "refer me" via partner) · low-literacy path (simple words, icons, read-aloud) · **Career Gateway** (voice-answer job application, private "support I need" filter, employer accommodation form). **Earns extra:** partner registers a learner with consent; save & resume by SMS link.

**Panel:** certified accessibility specialist, two co-designers, senior ALX engineer, platform/institution representative.
**After Sunday:** 100,000 ETB to the winning team of each track; winners do a two-week paid hardening sprint with ALX engineers. Code is released under an open licence; the team is credited by name.
**Co-designer rule:** they are a team member. Ask what they need; never ask for proof or history; speak to the person, not the interpreter; test on **their device, every few hours**.

---

## 2. Master timeline

| Window | Block | Hard deliverable at end of block |
|---|---|---|
| **Sat 10:50–12:00** (70 min) | **Sprint 1 — MVP core** | **CP1 (12:00):** 6-step wizard + Career Gateway UI running on Vercel **HTTPS** using `MockApiService` + IndexedDB; NestJS `/onboarding/sessions` + 422 bilingual errors; LTI `/lti/login` + `/lti/launch` 401 check. |
| Sat 12:00–13:00 | Lunch + first merge | Lead squash-merges `feat/dev1` + `feat/dev2` into `main` at **12:35**; Vercel HTTPS live on the co-designer's phone before 13:00. |
| **Sat 13:00–15:00** (120 min) | **Sprint 2 — Round 1 co-designer test + backend wiring** | Co-designer runs Tasks 1–7 on their own device. Dev 2 facilitates; Dev 3 scribes in `CO_DESIGNER_LOG.md` while wiring SMS/Voucher/Jobs. |
| **Sat 15:00–17:00** (120 min) | **Sprint 3 — Fix sprint + Savanna + LTI Advantage** | **CP2 (16:45):** Round-1 S1/S2 blockers fixed; all 5 Savanna defects patched; LTI Advantage (AGS + Mock LMS UI) done. **17:00 venue closes.** |
| **Sat 19:00–23:00** | Evening hardening | **CP3 (22:30):** `ApiClient` on live `/api/v1`; Amharic `.mp3` clips bundled; `pnpm gate` green (0 serious/critical). |
| **Sun 09:00–12:00** | Morning polish | `docker compose up --build` works in one command; README + `WCAG_2_2_AA_CONFORMANCE_REPORT.md` finished; **12:00 feature freeze** (S1/S2 fixes only). |
| **Sun 13:00–15:30** | Final co-designer gate + pitch rehearsal | Co-designer completes the full journey 100% unaided (NVDA, TalkBack, keyboard, 200–400% zoom, sound off). **15:30 hard code freeze.** |
| **Sun 15:45** | **Submit** (deadline 16:30) | Code, README, Docker Compose, conformance report uploaded. |

*Sleep in shifts tonight. A rested dev at 09:00 Sunday beats a broken one.*

---

## 3. Shared prerequisites (first 10 minutes, 10:50–11:00)

- [ ] **Dev 3 (reviewer Dev 2):** create `packages/shared-schemas` from Charter §0 (types, `DB_EVENTS`, `ErrorCode`, Zod schemas, empty `en.json`/`am.json`, `IApi` interface) and push to `feat/dev3-api-v1`; Lead merges to `main` immediately so everyone rebases. **★ MVP** *(not in the original board — added so nobody builds against guesses).*
- [ ] **Lead:** confirm repo scaffold, `pnpm-workspace.yaml`, root scripts `dev`, `build`, `test`, `gate`; Vercel project linked to `main` with HTTPS.
- [ ] **Everyone:** `pnpm i ; pnpm dev` runs. Post "I agree" to the Charter fairness clause in chat.
- [ ] Meet your co-designer and mentor; ask what device, screen reader and settings they use. Record in `CO_DESIGNER_LOG.md`.

---

## 4. Developer task boards

### 🟦 DEV 1 — `feat/dev1-shadow-host`
**Scope:** `apps/web-components/src/{index.ts,base,elements,state,api,styles}`, `apps/savanna-host-demo/{pages,assets,standalone.html}`, Vercel config.

**Sprint 1 · 10:50–12:00**
- [x] 10:50–11:15 **★** `src/base/ReactShadowElement.ts`; register `<db-onboarding-wizard>`, `<db-career-gateway>`, `<db-employer-accommodations>` in `src/index.ts`. Add **one-line auto-mount**: `<script src=".../db-widgets.v1.0.0.js" data-auto-mount="true">` (Level 1 adoption).
- [x] 11:15–11:40 **★** `src/state/store.ts` with `idb-keyval` (IndexedDB) + `localStorage` fallback, 300 ms debounce, key `db:{partnerId}:{sessionId}`.
- [x] 11:40–12:00 **★** `src/api/MockApiService.ts` (8 seeded Addis Ababa jobs with accommodations, fake SMS resume link, fake partner voucher) and `src/api/ApiClient.ts` (4 s timeout → automatic Mock fallback). **Push + PR at 12:00.**

**Sprint 2 · 13:00–15:00 (during co-designer test)**
- [x] 13:00–14:15 Patch the **5 Savanna defects** in `apps/savanna-host-demo/pages/homepage-v1-self-paced.html` and `homepage-v1-paced.html` (exact fixes: `TRACK_1_MASTER_REQUIREMENTS.md` §5):
  1. `<div class="hamburger">` → `<button type="button" … aria-label="Toggle sidebar" aria-expanded="true" aria-controls="sidebar">`
  2. `aria-label="ALX Savanna Home"` on `a.logo-container`
  3. Add `<h1>`; fix h1 → h2 → h3 order
  4. `scroll-margin-top: 6rem` in `assets/css/static-page.css` (2.4.11)
  5. Remove duplicate `#markdown-guide-modal` ids in `homepage-v1-paced.html`
- [x] 14:15–15:00 `src/state/syncQueue.ts`: queue offline patches, replay on `online` event.

**Sprint 3 · 15:00–17:00**
- [x] 15:00–16:30 Run axe on both Savanna pages + `standalone.html`; fix host CSS/layout issues the co-designer reports.
- [x] 16:30–17:00 Before/after axe counts → `docs/SAVANNA_FIXES.md`.
- [x] Dev 1 + Dev 2 integration: production build and 12-point judge audit pass; built Savanna, standalone, and external-partner pages mount their widgets and pass axe.

**Evening (19:00–23:00)** — [ ] Wire bundled Amharic `.mp3` fallback clips (recorded by Dev 2) as static assets; [ ] Slow-3G/offline reload test; [x] bundle size < 250 KB gz for onboarding element (130.17 KB).
**Sunday 09:00–12:00** — [ ] `Dockerfile` + `docker-compose.yml` (web side) verified; [ ] README "Install in 1 hour" (script-tag door).
**Done =** tags render standalone **and** in Savanna; draft survives reload and offline; host listener receives `db:onboarding-completed`; axe clean on Savanna.

### 🟩 DEV 2 — `feat/dev2-wizard-a11y`
**Scope:** `apps/web-components/src/{wizard,fields,voice,tts,career,i18n}`.

**Sprint 1 · 10:50–12:00 (critical path for the 13:00 test)**
- [x] 10:50–11:15 **★** `WizardShell`, `StepHeading` (`<h2 tabIndex={-1}>` auto-focused), `ProgressBar` (`<progress>`), `LiveRegion` (`role="status" aria-live="polite" aria-atomic="true"`), `ErrorSummary` (`role="alert" tabIndex={-1}` + jump links), `HelpCluster` (Read aloud, en/am, Simple words — fixed DOM order, 3.2.6).
- [x] 11:15–11:40 **★** `TextField` (label, autocomplete, `aria-invalid`, `aria-describedby`, 44×44), `VoiceField` (en-US/am-ET mic + editable Review box + "Use this answer"), `EthiopianDateSelect` (3 native selects, 13 months incl. Pagume).
- [x] 11:40–12:00 **★** Steps 0–6: `WelcomeConsent`, `NameStep`, `ContactStep` (SMS Save & Resume button), `DateOfBirthStep`, `IdentityStep` (**all 4 routes** incl. "Refer me"), `SupportStep` (no medical proof), `ReviewStep`. **Push + PR at 12:00.**

**Sprint 2 · 13:00–15:00**
- [ ] 13:00–14:00 **Lead facilitator** with the co-designer: they drive, unaided; watch NVDA Speech Viewer / TalkBack captions. Do not help unless asked.
- [x] 14:00–15:00 `CareerGateway` (pre-fill from `useOnboardingStore`, 3.3.7), private "Support I Need" `<fieldset><legend>` filter, `aria-live="polite"` job count (4.1.3), job cards `<h3><a href>` (1.3.1, 2.4.4), `EmployerForm`; voice-answer apply flow.

**Sprint 3 · 15:00–17:00**
- [ ] 15:00–16:30 Implement every UI / label / focus-order / zoom / Amharic fix from the session.
- [x] 16:30–17:00 `PrivacyDrawer` (native `<dialog>` + `.showModal()`, one-click JSON export + delete).

**Evening** — [ ] Record ~20 core Amharic prompt clips with a native speaker (`/audio/am/{promptKey}.mp3`); [ ] full 5-step gate on every merged feature; keep `docs/WCAG_GATE_CHECKLIST.md` ticked.
**Sunday 09:00–12:00** — [ ] **Owner of `WCAG_2_2_AA_CONFORMANCE_REPORT.md`** (Dev 4 supplies axe/Playwright results); [ ] README keyboard/ARIA section.
**Done =** full wizard + career flow with keyboard only; NVDA announcements verified; no English leaking into `am`; mic degrades cleanly.

### 🟧 DEV 3 — `feat/dev3-api-v1`
**Scope:** `apps/api/src/core-api.module.ts`, `apps/api/src/{common,auth,onboarding,vouch,sms,career,privacy,seed}`, `scripts/test-api.ps1`, `Dockerfile`/`docker-compose.yml` (api service).

**Sprint 1 · 10:50–12:00**
- [x] 10:50–11:15 **★** `TypeOrmModule.forRoot({ type: 'sqljs', location: 'data/digital_bridge.sqlite', autoSave: true, synchronize: true })` in `CoreApiModule`; `common/filters/bilingual-exception.filter.ts` — every 400/422 returns `BilingualApiError` in en + am.
- [x] 11:15–11:45 **★** `OnboardingModule`: `POST /api/v1/onboarding/sessions`, idempotent `PATCH …/sessions/:id` (revision++), `GET …/sessions/:id`. `SupportPreferences` stored separately, never in public/employer payloads.
- [x] 11:45–12:00 `SmsModule` (`POST …/sessions/:id/resume-sms`, `GET …/resume/:token`, 24 h single-use, `devLink`) + `VouchModule` (`POST …/partner-vouch`, agent + learner consent). **Push at 12:00.**

**Sprint 2 · 13:00–15:00**
- [x] 13:00–14:00 **Scribe** during the session in `CO_DESIGNER_LOG.md`: times, unaided Y/N, exact quotes, severity S1–S4.
- [x] 14:00–15:00 `CareerModule`: `GET /career/jobs?accommodations=…` (matcher **never logs filters against identity**), `POST /career/jobs`, `POST /career/applications`; seed 8 Addis jobs with **schema.org/JobPosting** metadata.

**Sprint 3 · 15:00–17:00**
- [x] 15:00–16:00 `PrivacyModule` (`GET /privacy/export`, `DELETE /privacy/data` → 204) + OAuth 2.0 Bearer/Partner guard (`common/guards/scopes.guard.ts`).
- [x] 16:00–17:00 `@ApiProperty` on all DTOs; `scripts/test-api.ps1` (Invoke-RestMethod across all endpoints, non-zero exit on mismatch).

**Evening** — [ ] Dev 1 flips `api-url` to live API; fix contract mismatches; [x] rate-limit resume-sms/vouch.
**Sunday 09:00–12:00** — [ ] `docker compose up --build` one-command check; [x] README API section + OpenAPI at `/api/docs` (and export `openapi.json` to `docs/`).
**Done =** every endpoint matches Charter §0 table; PS script passes; flip from Mock to real needs zero UI change.

### 🟪 DEV 4 — `feat/dev4-lti-qa`
**Scope:** `apps/api/src/lti/**`, `apps/savanna-host-demo/mock-lms/**`, `e2e/**`, `playwright.config.ts`, `.github/workflows/`.

**Sprint 1 · 10:50–12:00**
- [ ] 10:50–11:20 **★** `keys.service.ts` (RS256 via `jose`, serves `/api/v1/lti/jwks`), `platform.registry.ts`, `nonce.store.ts` (single-use, 5-min TTL).
- [ ] 11:20–12:00 **★** `/api/v1/lti/login` (OIDC third-party initiation) + `POST /api/v1/lti/launch` with `jose.jwtVerify`. If signature, `iss`, `aud`, `exp` or `nonce` fails → **401** + `BilingualApiError` (`LtiLaunchRejected`), render nothing. **Push at 12:00.**

**Sprint 2 · 13:00–15:00**
- [ ] 13:00–14:15 LTI Advantage: `POST /lti/ags/sync` (score 1/1 to gradebook), `GET /lti/nrps/roster` (completion status only, **zero support/disability data**), `POST /lti/deep-link` (signed `LtiDeepLinkingResponse`).
- [ ] 14:15–15:00 `mock-lms/index.html` one-click buttons: **Launch as Student (SSO)**, **Launch as Teacher (NRPS roster)**, **Sync Grade (AGS)**, **Launch with Tampered Token (proves 401)**. Mock LMS has its own RS256 key + JWKS and is registered as a platform.

**Sprint 3 · 15:00–17:00**
- [ ] 15:00–16:30 `e2e/axe.spec.ts` (0 critical/serious on `standalone.html` + Savanna pages), `e2e/keyboard.spec.ts` (tab order, focus on step `<h2>`, Esc closes `<dialog>`), `e2e/lti.spec.ts` (valid 200 vs tampered 401).
- [ ] 16:30–17:00 Root `pnpm gate` runs everything; GitHub Action on every PR.

**Evening** — [ ] `pnpm gate` green on the live build; [ ] axe on every wizard step and Career Gateway view.
**Sunday 09:00–12:00** — [ ] Feed axe/Playwright results to Dev 2 for the conformance report; [ ] README LTI section (platform registration steps for Canvas/Moodle/Savanna in ≤ 10 lines).
**Done =** Student launch lands pre-authenticated; tampered token → 401; grade visible in Mock LMS; `pnpm gate` green.

---

## 5. Co-designer testing (Sat 13:00 · Sat after fixes · Sun 13:00 final gate)

**Seven tasks:** (1) onboard typing · (2) onboard with voice on two fields · (3) "Refer me" route · (4) pause and resume by SMS link · (5) switch to Amharic + Ethiopian calendar · (6) filter jobs and apply · (7) trigger a validation error and recover.

**Rules:** co-designer drives; no help unless asked (that is the *unaided* metric). One facilitator talks, one scribe, one watches Speech Viewer. Test on **their own device and settings**, over **HTTPS** (Web Speech and mic need a secure context). Log every blocker with severity S1–S4. **Fix all S1/S2 before the next round.** Ask for a 1–5 ease score per task.
**Setup:** NVDA with Tools › Speech Viewer on (Chrome + Firefox); TalkBack with "Display speech output" on, inside a real WebView (`chrome://inspect`). Template: `TRACK_1_MASTER_REQUIREMENTS.md` §9.

---

## 6. Fallback triggers (time-boxed — decide, don't debate)

| If this is not working by… | Do this |
|---|---|
| **12:00 Sat**, Shadow DOM build breaks | Ship `standalone/` build (no Shadow DOM, `.db-root` scoping) for the 13:00 test. Fix element build in background. |
| **12:00 Sat**, API not ready | UI runs on `MockApiService` (`?mock=1`). Co-designer test is **not** delayed. |
| **15:30 Sat**, LTI JWKS verification stuck | Enable `DEMO_MODE` simulated route `/api/v1/lti-demo/*` with visible "SIMULATED" banner; keep the real 401 path as the headline. |
| **22:30 Sat**, live API integration failing | Ship with Mock fallback enabled by default; list limitation in README. |
| **Amharic voice unsupported on co-designer's device** | Typing + bundled `.mp3` prompts; state this honestly in README and report. |
| **Sun 12:00** | Feature freeze. Only S1/S2 fixes, docs, Docker, report. |
| **Sun 15:30** | Hard code freeze. Packaging only. |

Yellow/Red card rules: Charter §3 (Rules 3–6). Gate-break rule: any commit adding axe serious/critical, breaking keyboard flow, or removing a `<label>` is reverted if not fixed in **15 minutes**.

---

## 7. Merge & branch workflow

- Push your branch at least every **45 minutes**. PR with the checklist (Charter §3).
- Lead squash-merges `feat/dev1` + `feat/dev2` at **12:35**, then `dev3`, `dev4` as they are ready. After every merge: everyone `git pull --rebase origin main`.
- Vercel deploys `main` over HTTPS; the co-designer always tests `main`.
- `packages/shared-schemas` changes: additive only; announce `[CONTRACT]` first.

---

## 8. Submission checklist (Sunday, due 16:30 — target 15:45)

- [ ] **Code** on `main`, open licence file present, contributors credited by name and role in README
- [ ] **README** a stranger can follow in 1 hour: three doors (script tag · REST/OpenAPI · LTI 1.3), PowerShell examples, keyboard/ARIA notes, privacy statement, limitations (Amharic voice)
- [ ] **Docker Compose:** `docker compose up --build` works from a clean clone with one command
- [ ] **`WCAG_2_2_AA_CONFORMANCE_REPORT.md`** completed from real test results (no unverified "Pass")
- [ ] `pnpm gate` green; axe 0 critical / 0 serious on standalone + Savanna pages
- [ ] `CO_DESIGNER_LOG.md` complete with fixes shipped
- [ ] Final unaided co-designer run completed and logged
- [ ] HTTPS demo URL live; tested on the real phone
- [ ] Demo rehearsed (≈2 min per door)

---
