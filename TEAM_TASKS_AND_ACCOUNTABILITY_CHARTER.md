# TEAM_TASKS_AND_ACCOUNTABILITY_CHARTER.md — Playbook for 4 Developers

Rules for AI agents: `CLAUDE.md`. What we build: `TRACK_1_MASTER_REQUIREMENTS.md`. This file: **who builds what, how, and what happens when things slip.**

Fixed points: **Friday build night → Saturday co-designer testing → Sunday 16:30 submission (code freeze 15:30).**
Team lead: Kaleab (also fastest-available reassignment authority). Timekeeper: Ermiyas.

---

## 0. Hour 0–1: Shared Contracts FIRST

One person (Dev 3 drafts, Dev 2 reviews) creates `packages/shared-schemas` and pushes by **Hour 1**. Nobody builds against guesses. After Hour 1: **additive changes only**, announce in chat first.

```ts
// packages/shared-schemas/src/types.ts
export type Lang = "en" | "am";
export type CalendarKind = "ethiopian" | "gregorian";
export type Localized = { en: string; am: string };

export interface EthiopianDate {
  year: number;
  month: number /*1-13*/;
  day: number;
}

export interface OnboardingProfile {
  id: string; // session/profile id
  partnerId: string;
  lang: Lang;
  consent: {
    saveAnswers: boolean;
    smsResume: boolean;
    shareWithEmployers: boolean;
    givenAt: string;
  };
  name: { givenName: string; familyName: string };
  contact: {
    phone?: string /* normalised +251… */;
    email?: string;
    viaPartner?: boolean;
  };
  dateOfBirth?: {
    iso: string /* YYYY-MM-DD gregorian */;
    displayCalendar: CalendarKind;
    ethiopian?: EthiopianDate;
  };
  identity?: IdentityVerification;
  support?: SupportPreferences; // PRIVATE – never in events/logs/employer payloads
  progress: {
    currentStep: number;
    totalSteps: 6;
    completedSteps: number[];
    completedAt?: string;
  };
  revision: number; // increments per save (idempotency / sync)
  updatedAt: string;
}

export type SupportNeed =
  | "screen_reader_materials"
  | "sign_language_captions"
  | "step_free_venue"
  | "extra_time"
  | "high_contrast_large_text"
  | "audio_instructions"
  | "written_not_phone"
  | "quiet_workspace"
  | "other";

export interface SupportPreferences {
  needs: SupportNeed[];
  otherText?: string;
  tellLearningProvider: boolean; // explicit choice; default false
  // NO medical fields. Ever.
}

export type IdentityRoute =
  | "national_id_or_passport"
  | "refugee_id"
  | "community_document"
  | "partner_voucher";

export interface IdentityVerification {
  route: IdentityRoute;
  referenceNumber?: string; // ID/UNHCR/RRS number
  documentUploadId?: string;
  documentKind?: "school_certificate" | "birth_record" | "ward_letter";
  partnerVoucher?: {
    partnerId: string; // e.g. 'aaapd' | 'snv' | 'mercy-corps' | 'tomorrow-is-better' | 'other'
    referralCode?: string;
    agentId?: string;
    consent: {
      given: true;
      method: "checkbox" | "voice";
      recordedAt: string;
      evidenceRef?: string;
    };
    status: "requested" | "vouched" | "rejected";
  };
}

export type SupportFilter =
  | SupportNeed
  | "remote"
  | "flexible_hours"
  | "wheelchair_accessible_office"
  | "screen_reader_software";

export interface JobListing {
  id: string;
  title: Localized | string;
  employer: string;
  location: string;
  remote: boolean;
  deadlineIso?: string;
  description: string;
  offeredAccommodations: SupportFilter[]; // declared by employer
  contactEmail?: string;
  createdAt: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  applicantProfileId: string;
  answers: {
    questionId: string;
    text: string;
    inputMode: "typed" | "voice";
    audioRef?: string;
  }[];
  adjustmentRequest?: {
    items: SupportFilter[];
    note?: string;
    shareConsent: true;
  }; // ONLY if candidate opted in
  // NOTE: NO filter selections stored.
  submittedAt: string;
}

export interface BilingualApiError {
  statusCode: number;
  error:
    | "ValidationError"
    | "Unauthorized"
    | "Forbidden"
    | "NotFound"
    | "Conflict"
    | "RateLimited"
    | "InternalError"
    | "LtiLaunchRejected";
  summary: Localized;
  fields: { field: string; code: ErrorCode; message: Localized }[];
}
export type ErrorCode =
  | "REQUIRED"
  | "INVALID_ET_PHONE"
  | "INVALID_EMAIL"
  | "INVALID_ET_DATE"
  | "CONSENT_REQUIRED"
  | "TOKEN_EXPIRED"
  | "TOKEN_USED"
  | "LTI_BAD_SIGNATURE"
  | "LTI_BAD_NONCE"
  | "LTI_BAD_AUDIENCE"
  | "LTI_EXPIRED"
  | "RATE_LIMITED";

// ---- CustomEvents (bubbles:true, composed:true) ----
export const DB_EVENTS = {
  stepSaved: "db:onboarding-step-saved",
  completed: "db:onboarding-completed",
  supportRequested: "db:support-requested",
  jobFilterChanged: "db:job-filter-changed", // detail: { count } only – never the filter values
  jobApplied: "db:job-applied",
  error: "db:error",
} as const;

export interface StepSavedDetail {
  sessionId: string;
  step: number;
  totalSteps: 6;
  savedLocally: boolean;
  syncedToServer: boolean;
}
export interface CompletedDetail {
  sessionId: string;
  completedAt: string;
  lang: Lang;
  ltiContext?: { courseId: string; role: "Learner" | "Instructor" };
} // NO support data
export interface SupportRequestedDetail {
  applicationId?: string;
  employerId?: string;
  itemCount: number;
} // NO item names
export interface JobFilterChangedDetail {
  count: number;
}
export interface JobAppliedDetail {
  jobId: string;
  applicationId: string;
  adjustmentRequested: boolean;
}
export interface ErrorDetail {
  code: ErrorCode | "NETWORK_FALLBACK";
  message: Localized;
}

// ---- Shared utils (also in this package) ----
// normalisePhone(input) → '+2519…' | null      isValidEtPhone
// ethiopianMonths: Meskerem, Tikimt, Hidar, Tahsas, Tir, Yekatit, Megabit, Miazia, Ginbot, Sene, Hamle, Nehase, Pagume
// ethiopianToGregorian / gregorianToEthiopian / daysInEthiopianMonth(year, month)
// i18n: en.json / am.json with namespaced keys (wizard.*, errors.*, voice.*, jobs.*, privacy.*)
```

Also commit by Hour 1: Zod schemas mirroring the above, the error-code → bilingual message map, `DB_EVENTS`, and the empty `en.json`/`am.json` skeletons.

**API contract table (stub it with Mock data in Hour 1–2 so UI can start):**

| Method   | Path                                                                                                                               | Body → Response                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| POST     | `/api/v1/onboarding/sessions`                                                                                                      | `{lang,partnerId}` → `OnboardingProfile`                    |
| PATCH    | `/api/v1/onboarding/sessions/:id`                                                                                                  | `{step, data, revision}` → updated profile                  |
| POST     | `/api/v1/onboarding/sessions/:id/resume-sms`                                                                                       | `{phone}` → `{sent:true}` (dev: link returned in `devLink`) |
| GET      | `/api/v1/onboarding/resume/:token`                                                                                                 | → profile                                                   |
| POST     | `/api/v1/onboarding/partner-vouch`                                                                                                 | `{learner, partnerId, agentId, consent}` → profile          |
| GET      | `/api/v1/career/jobs?accommodations=a,b`                                                                                           | → `{count, jobs}`                                           |
| POST     | `/api/v1/career/jobs`                                                                                                              | `JobListing` (no id) → `JobListing`                         |
| POST     | `/api/v1/career/applications`                                                                                                      | `JobApplication` → `{id}`                                   |
| GET      | `/api/v1/privacy/export` / DELETE `/api/v1/privacy/data`                                                                           | → JSON / `204`                                              |
| GET/POST | `/api/v1/lti/login` · POST `/lti/launch` · POST `/lti/ags/sync` · GET `/lti/nrps/roster` · POST `/lti/deep-link` · GET `/lti/jwks` | LTI 1.3                                                     |

---

## 1. Roles, Files, How-To

### Timeline overview (Friday 15:10 now → Sunday 16:30)

| Window                              | Goal                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Fri to 17:00 (H0–1)                 | Contracts pushed; monorepo scaffold; everyone runs `pnpm i ; pnpm dev` |
| Fri 17:00–23:00                     | Each dev's MVP slice running against Mock/contract                     |
| Fri 23:00–01:00                     | First integration; deploy HTTPS preview; Savanna host patched          |
| Sat morning                         | Gate self-check (all 5 steps); fix S1s; rehearse test script           |
| Sat midday/afternoon                | **Co-designer testing**; log everything                                |
| Sat evening/night                   | Fix log findings (S1/S2); LTI polish; README                           |
| Sun to 12:00                        | Final regression, axe runs, demo rehearsal, recording                  |
| **Sun 15:30 freeze → 16:30 submit** | No features; only submission packaging                                 |

(Sleep in shifts. A rested dev at 08:00 Saturday beats a broken one.)

### Dev 1 — Web Component Shell, Shadow DOM, Offline Sync, Savanna Host

**Files**

```
apps/web-components/
  vite.config.ts            # lib mode, formats ['es'], entry src/index.ts, fileName db-widgets.v1.0.0
  src/index.ts              # customElements.define(...)
  src/elements/DbOnboardingWizardElement.tsx  DbCareerGatewayElement.tsx  DbEmployerAccommodationsElement.tsx
  src/base/ReactShadowElement.ts   # shared base class
  src/styles/index.css      # tailwind entry
  src/state/store.ts  src/state/persistence.ts  src/state/syncQueue.ts
  src/api/ApiClient.ts  src/api/MockApiService.ts  (with Dev 3's contract)
apps/savanna-host-demo/      # copy of Savanna pages + host-a11y-fixes.{js,css}
```

**How**

1. **Base class:** `class ReactShadowElement extends HTMLElement` → `connectedCallback` creates `this.attachShadow({mode:'open'})`, appends `<style>` (from `index.css?inline`) + a mount `<div lang=…>`; `createRoot(mount).render(<App host={this}/>)`. `static get observedAttributes()` → `api-url, partner-id, lang, theme, mode, lti-token, session-id`; `attributeChangedCallback` re-renders. `disconnectedCallback` unmounts. Expose `dispatch(name, detail)` that always uses `bubbles:true, composed:true`.
2. **Tailwind in shadow DOM:** pin Tailwind v3 (`tailwindcss@3`) or fix v4 `:root`/`@property` as in CLAUDE.md §2. Test **inside Savanna**, not just standalone.
3. **Offline engine:** Zustand `persist` with an IndexedDB storage adapter (`idb-keyval`) falling back to `localStorage`; debounce 300 ms; key `db:{partnerId}:{sessionId}`. `syncQueue`: array of unsent patches; flush on load, on `window 'online'`, after each save; exponential backoff; reflect state in live region (`status` string from store).
4. **ApiClient/Mock:** `ApiClient` tries real API with 4 s timeout; on network error/timeout/5xx/empty `api-url` → `MockApiService` (localStorage; deterministic job list, fake SMS token, fake vouch). Emits `db:error` with `NETWORK_FALLBACK` (no PII).
5. **Standalone demo page** `apps/web-components/index.html` with all three tags + language/theme toggles (this is also the fallback demo).
6. **Savanna patches:** follow `TRACK_1_MASTER_REQUIREMENTS.md` §5 (5 defects + extras); embed the elements; before/after axe counts into `docs/SAVANNA_FIXES.md`.
   **Done =** tags render in standalone **and** in Savanna; draft survives reload and offline; events seen by a host listener (`document.addEventListener('db:onboarding-completed', …)`); axe 0 serious/critical on the Savanna page.
   **Test:** DevTools → Slow 3G → Offline → reload mid-wizard; verify resume. Screenshot Savanna axe report.

### Dev 2 — WCAG Form Engine, Voice/TTS, Localization, Career Gateway UI

**Files**

```
apps/web-components/src/
  wizard/WizardShell.tsx  StepHeading.tsx  ProgressBar.tsx  ErrorSummary.tsx  HelpCluster.tsx  LiveRegion.tsx
  wizard/steps/{Name,Contact,DateOfBirth,Identity,Support,Review}Step.tsx  WelcomeConsent.tsx  PrivacyDrawer.tsx
  fields/TextField.tsx  VoiceField.tsx  EthiopianDateSelect.tsx  RadioCardGroup.tsx
  voice/useSpeechRecognition.ts  tts/useSpeechSynthesis.ts  tts/audioFallback.ts
  career/{CareerGateway,SupportFilter,JobList,JobCard,ApplyWizard,EmployerForm}.tsx
  i18n/useT.ts  (reads @db/shared-schemas dictionaries)
```

**How**

1. **Wizard engine:** one step component at a time from a config array; React Hook Form + `zodResolver(schemas[step])`; `mode:'onSubmit'`, `reValidateMode:'onChange'`. On "Save & continue": validate → if invalid, build error list, render `ErrorSummary` (`role="alert" tabindex="-1"`), `summaryRef.current?.focus()`; links `<a href="#fieldId">` call `shadowRoot.getElementById(id)?.focus()`. If valid: persist, `dispatch(stepSaved)`, advance, set live region "Step 3 of 6", focus new `<h2 tabindex="-1">`.
2. **Fields:** `TextField` wires `label htmlFor`, `aria-describedby=[hintId, errorId]`, `aria-invalid`, autocomplete. All sizes ≥ 44 px, 3 px focus ring.
3. **VoiceField:** hook returns `{supported, listening, transcript, start, stop, error}`; language by current `lang` (`am-ET`/`en-US`). Flow: Mic → live region "Listening" → transcript into **editable review textarea** → "Use this answer". If `!supported` → show note; keep input. Test on **real phone over HTTPS**.
4. **TTS:** `speechSynthesis.getVoices()` (listen for `voiceschanged`); choose by `lang`; if none for `am`, play `/audio/am/{promptKey}.mp3` (record the ~20 prompts with a native speaker on Friday night) else disable with an explanation. Play/Pause/Stop buttons.
5. **EthiopianDateSelect:** three `<select>`s; calendar toggle (radio); month names from shared package; day list from `daysInEthiopianMonth`; emits ISO + Ethiopian triple. Unit-test conversions on known dates (e.g., 2018-09-11 Gregorian ≈ 1 Meskerem 2019 E.C.; verify with an independent converter).
6. **Career UI:** `SupportFilter` fieldset + always-mounted live region updating count; `JobCard` = `<article><h3><a>…`; `ApplyWizard` reuses the wizard engine and **pre-fills** from store (no duplicate asks); explicit opt-in step for adjustment request; `EmployerForm`.
7. **Own the gate:** you run the 5-step check on every merged feature (Keyboard → NVDA → TalkBack → 400% zoom → axe) and keep `docs/WCAG_GATE_CHECKLIST.md` ticked.
   **Done =** full wizard + career flow works with keyboard only, NVDA announcements verified, Amharic strings complete (no English leaking), mic works where supported and degrades cleanly.
   **Test commands:** `pnpm -F @db/web-components test` (Vitest + Testing Library + `jest-axe`), plus Playwright axe on built page.

### Dev 3 — NestJS API, Database, Voucher/SMS, Job Matcher, Privacy

**Files**

```
apps/api/src/
  main.ts (prefix api, versioning, ValidationPipe, Swagger /api/docs, CORS allow-list)
  common/filters/bilingual-exception.filter.ts  common/errors/error-messages.ts  common/guards/scopes.guard.ts
  auth/{auth.module,token.service,partner.guard}.ts
  onboarding/{onboarding.module,controller,service}.ts  dto/*.ts  entities/{session,profile,upload}.entity.ts
  vouch/{vouch.controller,vouch.service}.ts  sms/{sms.provider.ts,console-sms.provider.ts}
  career/{career.module,jobs.controller,applications.controller,matcher.service}.ts  entities/{job,application}.entity.ts
  privacy/{privacy.controller,privacy.service}.ts
  seed/seed.ts  (6–10 realistic Addis jobs with accommodations)
scripts/test-api.ps1
```

**How**

1. **Bilingual error filter:** catches `BadRequestException`/`ValidationError`, maps `class-validator` constraints → `ErrorCode` → `Localized` messages; produces the envelope in CLAUDE.md §5. Unit-test: invalid phone yields exactly `INVALID_ET_PHONE` with the example text in en and am.
2. **Onboarding:** `PATCH` merges `step` data, increments `revision`, ignores stale revisions safely (idempotent). Store support data in its own table/column group; exclude from list/log queries.
3. **Resume-SMS:** random 32-byte token (hash stored), TTL 24 h, single use; `ConsoleSmsProvider` logs and returns `devLink` in dev. Throttle 3/hour per phone.
4. **Partner voucher:** validates partner exists, consent present (`given:true`, method, timestamp), stores agent id + evidence ref; status `vouched` immediately in demo mode; partner scopes `onboarding:write` + `partner:vouch`.
5. **Job matcher:** `GET /career/jobs?accommodations=a,b` returns jobs whose `offeredAccommodations` ⊇ requested set; **do not log the query values or tie them to a user**; response includes `count`.
6. **Privacy:** `GET /privacy/export` returns all data for the authed profile as JSON (and a human-readable summary); `DELETE /privacy/data` hard-deletes profile, uploads, vouch records, tokens; returns `204`; double-confirm in UI.
7. **Swagger:** decorate everything; tag by door; examples in both languages.
8. **PowerShell script `scripts/test-api.ps1`:** health → create session → bad phone (expect 422 + bilingual) → valid patch → resume-sms → job filter → apply → export → delete → assert statuses; exit non-zero on any mismatch.
   **Done =** every endpoint returns documented shape; script passes; Dev 1 can flip `api-url` from Mock to real with no UI changes.

### Dev 4 — LTI 1.3, OAuth Security, Mock LMS, QA Automation

**Files**

```
apps/api/src/lti/
  lti.module.ts  lti.controller.ts  lti.service.ts  platform.registry.ts  nonce.store.ts  keys.service.ts
  ags.service.ts  nrps.service.ts  deeplink.service.ts
apps/savanna-host-demo/mock-lms/{index.html,mock-lms.ts}      # Teacher/Student launchpad
e2e/axe.spec.ts  e2e/keyboard.spec.ts  e2e/lti.spec.ts  playwright.config.ts   # + GitHub Actions workflow
```

**How**

1. **Login (`/lti/login`):** accept GET/POST; validate `iss`+`client_id` are registered; generate `state`,`nonce` (crypto random), store with 5-min TTL + bind to a cookie; 302 to platform auth URL (`scope=openid&response_type=id_token&response_mode=form_post&prompt=none&login_hint&lti_message_hint&redirect_uri=<our /lti/launch>`).
2. **Launch (`/lti/launch`)** — use `jose`: `const JWKS = createRemoteJWKSet(new URL(platform.jwksUrl)); await jwtVerify(id_token, JWKS, { issuer: platform.issuer, audience: platform.clientId, algorithms:['RS256'], clockTolerance: 60 })`. Then check `state` (single-use), `nonce` (single-use), `https://purl.imsglobal.org/spec/lti/claim/message_type`, `version === '1.3.0'`, `deployment_id`. **Any exception → `401` bilingual body (`LtiLaunchRejected`, code e.g. `LTI_BAD_SIGNATURE`); render nothing.** Map roles → Learner/Instructor, name, context. Issue short-lived session token with `lti:launch` scope and 302/serve the page with `<db-onboarding-wizard mode="lti" lti-token="…">`.
3. **Own keys + JWKS:** `/lti/jwks` serves the tool public key (generate RS256 at startup in dev).
4. **AGS:** OAuth2 client-credentials with a signed JWT assertion to the platform token URL; post score `{userId, scoreGiven:1, scoreMaximum:1, activityProgress:'Completed', gradingProgress:'FullyGraded', timestamp}` to the line item. `POST /lti/ags/sync` triggers it when onboarding completes (idempotent).
5. **NRPS:** `GET /lti/nrps/roster` (instructor scope) returns names + onboarding completion status **only** — no support, ID, or contact data.
6. **Deep Linking:** on `LtiDeepLinkingRequest`, render a picker (Onboarding / Career Gateway) → sign `LtiDeepLinkingResponse` JWT with `content_items:[{type:'ltiResourceLink', title, url}]` and auto-POST to `deep_link_return_url`.
7. **Mock LMS launchpad (judge-friendly, 10 seconds):** a page with buttons **Launch as Student**, **Launch as Teacher**, **Deep-link picker**, **Send grade**, and **Launch with TAMPERED token (expect 401)**. Mock LMS holds its **own** RS256 keypair, exposes its own JWKS endpoint, and is _registered as a platform_ in `platform.registry.ts` — so the real verification path is exercised.
8. **QA automation:** Playwright + `@axe-core/playwright`: run axe on standalone page, Savanna pages, wizard steps (assert 0 serious/critical); keyboard test (tab order, Esc closes dialog, focus lands on step heading); LTI e2e (valid launch 200, tampered 401); wire into a GitHub Action on every PR; add a `pnpm gate` script that runs all.
   **Done =** Student launch lands pre-authenticated; tampered token yields 401; grade shows in Mock LMS gradebook panel; `pnpm gate` is green.

---

## 2. Failure-Proofing — Zero Single Points of Failure

**A. Mock Service Adapter (API down or unfinished).** `ApiClient` (Dev 1) implements the interface `IApi` from shared-schemas. `MockApiService` implements it with deterministic local data (`localStorage`): sessions, patches, a fake SMS token that resolves locally, a vouch response, 8 seeded jobs, application ids, export/delete of local data. Selection logic: `api-url` empty → Mock; request > 4 s or network error → Mock for the rest of the session and live-region note "Working offline"; `?mock=1` forces Mock for demos. Dev 2 builds _only_ against `IApi`, so Dev 3's absence never blocks UI.

**B. Standalone demo page (Shadow DOM build breaks).** Keep `apps/web-components/standalone/` — the same React apps rendered **without** Shadow DOM, with styles scoped by a `.db-root` class (CSS file built in parallel). Judges can still use the product; we explain that the element build is the supported door and show the fix in progress. Build both targets from the start (`pnpm build:wc` + `pnpm build:standalone`).

**C. Simulated LTI launch (JWKS crypto stuck).** Routes under `/api/v1/lti-demo/*` (guarded by `DEMO_MODE=true`, off by default, banner "SIMULATED — not a verified launch"). The simulated flow skips remote JWKS and uses a locally trusted key — it **never** shares the production `/lti/launch` code path and never accepts unsigned tokens. Real verification remains the headline; simulation is only a visible fallback so grading/roster/deep-link UX can still be demoed.

**D. Docs/PowerShell fallback for judges:** `docs/QUICKSTART.md` with `pnpm i ; pnpm dev` and a one-command `pnpm demo` that seeds data and opens the standalone page + Mock LMS.

---

## 3. Team Accountability Rules

**Rule 1 — 45-minute push rule.** Every dev pushes `feat/devN-…` at least every 45 minutes (WIP is fine). Unpushed code does not exist. Timekeeper pings at :45 of each hour block.

**Rule 2 — 2-hour checkpoint sync.** Every 2 hours, 10 minutes total: each dev shows their feature **running** for 2 minutes. "90% done" isn't a status. Output: milestone table below updated.

| Checkpoint       | Dev 1                        | Dev 2                       | Dev 3                     | Dev 4                                     |
| ---------------- | ---------------------------- | --------------------------- | ------------------------- | ----------------------------------------- |
| CP1 (Fri ~19:00) | Elements render, Mock client | Wizard shell + 2 steps      | Sessions + error filter   | LTI login+launch skeleton, Mock LMS shell |
| CP2 (Fri ~21:00) | Persistence + offline        | All 6 steps + errors + i18n | Vouch, SMS, jobs, privacy | JWT verify + 401 path                     |
| CP3 (Fri ~23:00) | Savanna host patched         | Voice/TTS/Ethiopian date    | Swagger + PS script       | AGS + NRPS, axe CI                        |
| CP4 (Sat ~08:00) | Standalone + element stable  | Career UI + gate pass       | API stable                | Deep-link + Mock LMS polished             |

**Rule 3 — Yellow Card** (60 min late on a milestone, or silent for 45 min): scope **auto-reduces to the bare MVP contract** (items marked ★ in the role lists: wizard shell, ErrorSummary, persistence, sessions endpoint, 401 launch path), plus a **mandatory 20-minute pair rescue**: another dev + Claude/Cursor writes the blocked code with the owner present. Owner explains what blocked them; no blame, just unblock.

**Rule 4 — Red Card** (2.5 h late, or blocking integration before Saturday testing/Sunday freeze): immediate, no-argument **reassignment + fallback activation**. Team lead pulls the member's latest branch, switches the Mock adapter/simulated flow on for the missing pieces, and reassigns the critical path to the fastest available dev. The original owner moves to QA/docs/test-script duties (still counts as contribution if completed). Decision is the lead's; discussion after.

**Rule 5 — You break the Gate, you fix it.** Any commit introducing an axe serious/critical issue, breaking keyboard flow, or removing a `<label>` is **reverted if not fixed in 15 minutes** (CI will flag it; lead reverts).

**Rule 6 — Silence is an incident.** If someone hasn't posted or pushed in 45 minutes, the timekeeper pings them; 15 more minutes with no reply = Yellow Card. Illness/emergency: tell the lead and you're excused from cards immediately — cards are about _unannounced_ gaps, not life.

**Rule 7 — Communication.** Shared chat; a pinned "Blocked/Needs" thread; prefix messages `[CONTRACT]`, `[BLOCKED]`, `[DEMO]`. Contract changes need a thumbs-up from every affected dev.

**Rule 8 — PR hygiene.** Small PRs; one reviewer (any other dev) within 20 minutes; checklist (below) pasted. Lead merges. Don't edit someone else's files without telling them.

**PR checklist**

```
- [ ] lint / typecheck / tests pass   - [ ] axe: 0 serious/critical   - [ ] keyboard pass
- [ ] NVDA or TalkBack note (what I heard)   - [ ] 400% zoom checked   - [ ] en + am strings added
- [ ] no PII in logs/events   - [ ] contract unchanged or announced
```

---

## 4. Contribution & Prize Fairness Clause

Agreed up-front (all four sign by posting "I agree" in the team chat before Hour 1):

**A role is "completed" when ALL are true:** (1) its Done criteria above are met and demonstrably running on `main`; (2) its PRs passed the checklist; (3) it hasn't triggered the Gate rule more than once unresolved; (4) the owner wrote or reviewed the matching README section and a short "how to test" note.

**Partial credit:** work reassigned after a Red Card counts proportionally to what is merged and running (e.g., a working feature + tests) — measured by merged PRs, not time spent. The person who finishes a reassigned task shares credit for it; the original owner keeps credit for merged parts.

**Recognition & prize:** if the team wins, the prize/ sprint place is **split as agreed by the team in writing before Saturday 09:00** (default: equal four-way split; change only by unanimous agreement). Credits in README list all contributors with roles. Any dispute is resolved by the lead using the merged-PR record and the checkpoint table; if the lead is involved, the other three vote.

**Conduct:** respect the co-designer, the judges, and each other. No blame in public; fix the process.

---

## 5. Pre-Submission Day (Sunday) Checklist

- [ ] 12:00 feature freeze except S1/S2 bug fixes; 15:30 hard code freeze
- [ ] `pnpm gate` green; axe 0 serious/critical on standalone + Savanna pages
- [ ] HTTPS demo URL live; tested on the real phone
- [ ] README: quick-start under 1 hour, three doors snippets, PowerShell examples, ARIA/keyboard notes, privacy statement, limitations (Amharic voice)
- [ ] `CO_DESIGNER_LOG.md` complete with fixes
- [ ] Demo video/script rehearsed (2 min per door)
- [ ] Submit by **16:30**, with margin — aim for 15:45
