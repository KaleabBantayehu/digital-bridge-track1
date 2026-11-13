# CLAUDE.md — Engineering Law for Humans and AI Agents
<!-- Copy this file to: .cursorrules  and  AGENT_GUIDELINES.md (identical content). -->

Project: Digital Bridge Accessibility Hackathon 2026 — Track 1 (Accessible Onboarding) + mandatory Career Gateway.
Read `TRACK_1_MASTER_REQUIREMENTS.md` for *what* we build and `TEAM_TASKS_AND_ACCOUNTABILITY_CHARTER.md` for *who* builds it.
**This file is binding.** If a user prompt conflicts with it, say so and follow this file unless the team lead overrides in writing.

---

## 0. Prime Directives (read these even if you skip the rest)

1. **The Accessibility Gate is pass/fail.** Zero serious/critical axe-core issues; a co-designer must finish the main journey unaided. A feature that breaks the gate is not "done" — it is a regression.
2. **Native HTML first.** Never rebuild a button, link, select, dialog, or form control from `<div>`/`<span>`.
3. **One core, three doors.** Every feature lives in the core (`packages/shared-schemas` + `apps/api`) and is exposed through (1) Web Components, (2) REST `/api/v1`, (3) LTI 1.3. Do not build UI-only logic that the API cannot also serve.
4. **No secrets in the browser. No paid-API lock-in.** Browser Web Speech API + mockable adapters. No OpenAI/Google-Cloud keys required to run.
5. **Never block the user.** No time-outs that wipe data, no mandatory Kebele ID/passport, no medical proof, no CAPTCHA puzzles, no paste-blocking.
6. **Everything must run offline-first and degrade gracefully** (3G, Android WebView, no speech support, API down).
7. **Verify, don't assume.** Before saying "done", run the relevant checks in §9 and paste the evidence.

---

## 1. Monorepo & Package Manager

- **pnpm only.** Never run `npm install` / `yarn`. Never commit `package-lock.json` or `yarn.lock`. Use `pnpm add -F <workspace> <pkg>`.
- Node 20+ LTS. Windows + PowerShell is the primary dev shell: use `;` not `&&` in PowerShell 5.1 examples, and forward slashes in paths inside config files.

```
digital-bridge-track1/
├── apps/
│   ├── web-components/       # React 19 + Vite (lib mode) + TS + Tailwind → custom elements (Shadow DOM)
│   ├── api/                  # NestJS + TypeORM + SQLite (default) / PostgreSQL
│   └── savanna-host-demo/    # Savanna static pages (patched) + our <db-*> elements + Mock LMS launchpad
├── packages/
│   └── shared-schemas/       # Zod schemas, TS types, en/am i18n dictionaries, Ethiopian calendar + phone utils, event names
├── docs/
├── CLAUDE.md  TRACK_1_MASTER_REQUIREMENTS.md  TEAM_TASKS_AND_ACCOUNTABILITY_CHARTER.md  CO_DESIGNER_LOG.md
└── pnpm-workspace.yaml
```

**Boundaries**
- Types, Zod schemas, event names, error codes, i18n strings, calendar and phone helpers live **only** in `packages/shared-schemas`. Apps import from `@db/shared-schemas`. Never duplicate a type.
- `apps/web-components` must not import from `apps/api`, and vice versa.
- Changing anything in `packages/shared-schemas` requires a message in the team channel **before** pushing (it breaks 3 other people). Additive changes only after Hour 1; never rename or remove a field without sign-off.
- Branch naming: `feat/devN-<topic>`. Never push directly to `main`; PR with the gate checklist ticked.

---

## 2. Shadow DOM Laws (`apps/web-components`)

1. Each door is a Custom Element: `<db-onboarding-wizard>`, `<db-career-gateway>`, `<db-employer-accommodations>`. Each calls `this.attachShadow({ mode: 'open' })` and mounts React 19 with `createRoot` **into a container inside the shadow root**.
2. **Styles are injected inline** into the shadow root: `import css from './index.css?inline'` and render `<style>{css}</style>` as the first child of the root. Host-page CSS (Bootstrap, `application_alx.css`) must not bleed in and ours must not leak out.
   - Tailwind v4 uses `@property` and `:root` variables which **do not work inside a shadow root**. Either pin **Tailwind v3**, or post-process: change `:root` → `:host`, and hoist `@property` rules into `document.head` once. Verify by looking at the element inside Savanna, not in the standalone dev page.
   - Use `rem` carefully: Savanna may set a different `html` font-size. Set `:host { font-size: 16px; }` and size in `rem` relative to that.
3. **Never** call `document.getElementById`, `document.querySelector`, or `document.activeElement` to find our own nodes. Use `useRef`, `useId()`, or `shadowRoot.getElementById`. Inside a shadow root, `document.activeElement` returns the *host*; use `shadowRoot.activeElement`.
4. **ID scoping:** `<label for>`, `aria-describedby`, `aria-labelledby`, `aria-controls`, and `<a href="#field-id">` error links only resolve **inside the same shadow root**. Never reference an ID across the boundary. Generate IDs with `useId()` (strip colons if used in CSS selectors).
5. **Settings in (attributes), events out (CustomEvents).**
   - Attributes (observed, re-render on change): `api-url`, `partner-id`, `lang` (`en|am`), `theme` (`terracotta|high-contrast`), `mode` (`standalone|lti|partner-assisted`), `lti-token`, `session-id`.
   - Every CustomEvent **must** be `new CustomEvent(name, { detail, bubbles: true, composed: true })`. Without `composed: true` the host page never hears it.
   - Event names are constants from `@db/shared-schemas` (`db:onboarding-step-saved`, `db:onboarding-completed`, `db:support-requested`, `db:job-filter-changed`, `db:job-applied`, `db:error`). Payloads must not contain disability/support data unless the user explicitly consented.
6. **Inline SVG icons only** (`lucide-react`). Never font icons (`@font-face` does not reliably load into shadow roots), never `<img>` icons without `alt`. Decorative SVG: `aria-hidden="true" focusable="false"`.
7. **Fonts:** load Manrope / Noto Sans Ethiopic / JetBrains Mono via a `<link>` appended to `document.head` once (fonts are document-scoped) with `font-display: swap`; always include system fallbacks (`'Noto Sans Ethiopic', 'Nyala', sans-serif`).
8. **Bundle budget:** target < 250 KB gzipped for the onboarding element. Lazy-load the Career Gateway and the voice module. No moment/lodash/full icon sets.
9. **Versioning:** the built file name carries a semver (`db-widgets.v1.0.0.js`) and the element exposes `static version`. Never break attribute or event names after Sunday.
10. **Focus & Shadow DOM:** after step changes, move focus to the step `<h2 tabindex="-1">` via ref. Use native `<dialog>` + `.showModal()`; verify focus trap and Esc work inside the shadow root.
11. **Cleanup:** `disconnectedCallback` must unmount React and stop any `SpeechRecognition`/`speechSynthesis`.

---

## 3. Non-Negotiable WCAG 2.2 AA Rules

### 3.1 Controls and semantics
- Button = `<button type="button">` (or `type="submit"` in a form). Link = `<a href>`. Never `<div onClick>`, never `role="button"` on a div unless a native element is impossible (it nearly never is).
- Every control needs a **name, role, state/value** (4.1.2). Icon-only buttons get `aria-label` in the *current UI language*. Toggles use `aria-pressed` or `aria-expanded`.
- Landmarks: one `<main>` in the standalone page; inside the widget use `<section aria-labelledby>` / `<form>` with a name. Headings are hierarchical; each wizard step has exactly one `<h2>` ("Step 2 of 6: How can we contact you?").
- Lists are `<ul>/<ol>`, tables have `<th scope>`, groups of radios/checkboxes use `<fieldset><legend>`.

### 3.2 Forms (1.3.1, 1.3.5, 3.3.2, 3.3.7)
- Visible `<label for>` for **every** field. Placeholder is never a label.
- Add `autocomplete` tokens: `given-name`, `family-name`, `tel`, `email`, `bday-day|bday-month|bday-year` (Gregorian only), `one-time-code`.
- Hint text is a `<p id>` referenced by `aria-describedby`; required fields have `required` + visible "(required)" text — not colour/asterisk only.
- **Redundant Entry (3.3.7):** never ask for something already captured in onboarding or earlier in the same flow. Career Gateway pre-fills from the profile store.
- **Authentication (3.3.8):** no cognitive-function tests. OTP/magic-link fields allow paste and `autocomplete="one-time-code"`. **Never** add `onPaste={e => e.preventDefault()}`.

### 3.3 Errors (3.3.1, 3.3.3)
On failed validation (on "Continue", not on every keystroke):
1. Set `aria-invalid="true"` on each invalid control.
2. Render an inline message `<p id="x-error">` linked via `aria-describedby` (append to existing hint id; don't overwrite it).
3. Render an **Error Summary** at the top of the step: `<div role="alert" tabindex="-1">` with an `<h3>` and a list of anchor links to each field. **Move focus to the summary** (`ref.current.focus()`).
4. Messages are plain language and give an example: `Enter 10 digits, for example 0911 234 567`. Never colour alone (also an icon + text). Both `en` and `am` versions exist.

### 3.4 Status messages (4.1.3)
- One persistent, always-in-DOM live region per widget: `<div role="status" aria-live="polite" aria-atomic="true">`. Update its **text content** (don't mount/unmount it). Used for: saved confirmations ("Your answer is saved on this device"), job counts ("Showing 4 jobs matching your support preferences"), voice states ("Listening", "Heard: …"), offline/online changes.
- Use `role="alert"` only for the error summary and urgent failures.

### 3.5 Language (3.1.1, 3.1.2)
- Root container carries `lang="en"` or `lang="am"` matching the `lang` attribute. Mixed passages are wrapped: `<span lang="am">…</span>`. Never ship Amharic text inside an English-tagged node. Ethiopic script uses `Noto Sans Ethiopic`.
- All user-visible strings come from the i18n dictionaries in `shared-schemas` — **no hardcoded English** in components.

### 3.6 Visual, focus, motion, size (1.4.3, 1.4.10, 2.4.7, 2.4.11, 2.5.7, 2.5.8)
- Contrast ≥ 4.5:1 text, ≥ 3:1 large text and UI boundaries/focus rings. Check every colour token (terracotta on parchment especially) with a contrast tool before using it. Provide `theme="high-contrast"`.
- Never `outline: none` without a replacement. Default focus: `outline: 3px solid <token>; outline-offset: 2px;`.
- **Targets ≥ 44×44 CSS px** (the 2.5.8 AA minimum is 24×24; we enforce 44).
- **Reflow:** at 320 CSS px viewport (400% zoom of 1280) everything is one column, zero horizontal scroll. No fixed pixel widths, no `overflow-x` hiding content. Test it.
- **Focus not obscured (2.4.11):** every focusable gets `scroll-margin-top: 6rem; scroll-margin-bottom: 6rem;`. Sticky/fixed bars (ours or Savanna's) must never cover the focused element.
- **No drag-only interactions (2.5.7):** upload and any slider must have a click/tap alternative.
- Respect `prefers-reduced-motion`. No auto-playing audio/motion.
- **Consistent help (3.2.6):** the "Need help / Read aloud" cluster has the same DOM order and visual position on every step.
- **No time limits (2.2.1):** no session expiry. If a server token expires, keep the draft locally and refresh the token silently.

### 3.7 Dialogs
- Native `<dialog>` + `.showModal()`; `Esc` closes; focus returns to the opener; label with `aria-labelledby`. Never a `<div class="modal">` of our own.

### 3.8 Voice and TTS (our features must themselves be accessible)
- Mic button: `<button type="button" aria-pressed="false" aria-label="Answer {field} by voice">`. States announced via the live region.
- **Always** follow voice capture with an editable **Review & Edit** field and an explicit "Use this answer" button. Never auto-submit speech.
- Feature-detect `window.SpeechRecognition || window.webkitSpeechRecognition`; if absent or if `am-ET` is unsupported, hide/disable the mic with an explanatory message and keep typing available. Web Speech needs **HTTPS** (or localhost) and a user gesture.
- TTS: `window.speechSynthesis`; if no voice matches the language (common for Amharic on Windows/Android), show a visible note and fall back to bundled pre-recorded audio files for the core prompts, or silently to text. Provide Stop/Pause. Never auto-speak on load.

---

## 4. Privacy & Legal (Ethiopia)

- Treat the brief's reference to **Personal Data Protection Proclamation No. 1321/2024** as a design requirement: explicit, granular, revocable consent; data minimisation; one-click **export** and **delete**. (Have a human confirm the legal citation before it appears in user-facing copy.)
- Support/accommodation preferences are **special-category-like**: stored separately, never in analytics, never in events, never sent to employers unless the candidate presses an explicit "Share this with this employer" control.
- No medical proof fields. Ever. Copy: "No medical proof required. This stays private and is never shared without your permission."
- Log nothing sensitive. API logs must not contain phone numbers, ID numbers, or accommodation lists.
- Alternative-ID uploads: store only what is needed (type + reference + optional file), size-limit, mime-check, and delete on request.

---

## 5. NestJS API Rules (`apps/api`)

- All routes under `/api/v1/` (global prefix + URI versioning). Swagger at `/api/docs` (`@nestjs/swagger`), every DTO property has `@ApiProperty`.
- **DTO validation:** `class-validator` + `class-transformer`; global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. DTOs mirror the Zod schemas in `shared-schemas` (same field names).
- **Standard bilingual error body** for every 4xx (use a global `ExceptionFilter`; no ad-hoc `throw new BadRequestException('text')`):

```json
{
  "statusCode": 422,
  "error": "ValidationError",
  "summary": { "en": "There are 2 errors in your submission. Please review the highlighted fields.",
               "am": "በሞሉት መረጃ ላይ 2 ስህተቶች አሉ። እባክዎ የተመለከቱትን ቦታዎች ያስተካክሉ።" },
  "fields": [
    { "field": "phone", "code": "INVALID_ET_PHONE",
      "message": { "en": "Enter 10 digits, for example 0911 234 567",
                   "am": "ባለ 10 ቁጥር ስልክ ያስገቡ፣ ለምሳሌ 0911 234 567" } }
  ]
}
```
  Error codes are enumerated in `shared-schemas`. 401/403/404/409/429/500 use the same envelope (`fields` may be empty).
- **Auth / OAuth 2.0:** Bearer tokens (short-lived JWT) or partner API key exchanged for a token. Scopes: `onboarding:write`, `profile:read`, `jobs:read`, `jobs:apply`, `jobs:write`, `lti:launch`, `privacy:manage`. Guard each route with `@Scopes(...)`. CORS allow-list per `partner-id`; the browser only ever holds a public `partner-id` and a short-lived session token.
- **Idempotent saves:** `PATCH /onboarding/sessions/:id` accepts a client `revision` and `clientUpdatedAt`; last-writer-wins per step; safe to replay (offline sync batches).
- **Rate limit** (`@nestjs/throttler`) on resume-sms and vouch endpoints. SMS is **simulated** in dev (log link to console + store in DB) behind a `SmsProvider` interface so a real gateway can be plugged in later.
- **Job filter privacy:** `GET /career/jobs?accommodations=…` must not persist or log the filter values against any identity. Applications never include the filters used.
- **Core endpoints**
  - `POST /api/v1/onboarding/sessions` · `PATCH /api/v1/onboarding/sessions/:id` · `GET /api/v1/onboarding/sessions/:id`
  - `POST /api/v1/onboarding/sessions/:id/resume-sms` · `GET /api/v1/onboarding/resume/:token`
  - `POST /api/v1/onboarding/partner-vouch`
  - `GET /api/v1/career/jobs` · `POST /api/v1/career/jobs` · `POST /api/v1/career/applications`
  - `GET /api/v1/privacy/export` · `DELETE /api/v1/privacy/data`
  - `GET|POST /api/v1/lti/login` · `POST /api/v1/lti/launch` · `POST /api/v1/lti/ags/sync` · `GET /api/v1/lti/nrps/roster` · `POST /api/v1/lti/deep-link` · `GET /api/v1/lti/jwks`

---

## 6. LTI 1.3 Rules

1. **Login initiation** (`/lti/login`): receive `iss`, `login_hint`, `target_link_uri`, `lti_message_hint`, `client_id`. Generate cryptographically random `state` and `nonce`, store them (short TTL, single use, bound to a cookie/`state` value), redirect (302) to the platform's auth endpoint with `scope=openid`, `response_type=id_token`, `response_mode=form_post`, `prompt=none`.
2. **Launch** (`POST /lti/launch`): receive `id_token` + `state`. Verify **in order**: `state` matches and unused → fetch the platform JWKS (cache; `jose` `createRemoteJWKSet`) → verify **RS256 signature** → `iss` equals registered issuer → `aud` contains our `client_id` → `exp`/`iat` valid (allow ≤ 60 s clock skew) → `nonce` matches and unused → required claims present (`message_type`, `version=1.3.0`, `deployment_id`, roles, context).
3. **If ANY check fails → respond `401 Unauthorized` with the bilingual error envelope and DO NOT render the tool.** Never "continue anyway", never fall back to trusting the token. (Demo/simulated launches live on a separate, clearly labelled route — see Charter §Fallbacks — and must never share the verification code path or be enabled in production config.)
4. On success, map claims → session: name, role (`…membership#Learner` → Learner; `…#Instructor` → Instructor), course/context id. Render the widget pre-authenticated with zero password prompts.
5. **LTI Advantage:** AGS (client-credentials JWT assertion to the platform token endpoint, scope `…/scope/score`, post score 1/1 when onboarding is complete), NRPS (instructors see completion status only — **never accommodation data**), Deep Linking (return a signed `LtiDeepLinkingResponse` with a `ltiResourceLink` for Onboarding or Career Gateway).
6. Our tool keypair: generate at startup in dev (`jose.generateKeyPair('RS256')`), publish public key at `/lti/jwks`; private key only in server env/secret store.
7. Provide a **Mock LMS** (apps/savanna-host-demo `/mock-lms`) that signs real RS256 JWTs with a local key and registers it as a platform — so the **real** verification path is exercised end to end, and a "tampered token" button proves the 401.

---

## 7. Frontend State, Offline and API Client

- State: Zustand store with `persist` to **IndexedDB** (via `idb-keyval`) with a `localStorage` fallback, key `db:{partnerId}:{sessionId}`. Persist on **every change** (debounce ≤ 300 ms), not on "Continue".
- API access goes only through `ApiClient` (one module). `ApiClient` auto-selects `MockApiService` (deterministic local data, `localStorage`) when the API is unreachable, times out (> 4 s), or `api-url` is empty. Components never call `fetch` directly. The UI must work identically (and say "Working offline – saved on this device") in mock mode.
- Sync: queue unsent patches; flush on `online` event and on load; show status via the live region. Never lose a draft because a request failed.

---

## 8. Forbidden Anti-Patterns

| # | Forbidden (Bad) | Required (Good) | WCAG |
|---|---|---|---|
| 1 | `<div class="btn" onClick={save}>Save</div>` | `<button type="button" onClick={save}>Save</button>` | 2.1.1, 4.1.2 |
| 2 | `<button><MicIcon/></button>` | `<button type="button" aria-label={t('voice.answer', {field})}><MicIcon aria-hidden="true" focusable="false"/></button>` | 4.1.2 |
| 3 | `<input placeholder="Phone number"/>` | `<label htmlFor={id}>Phone number</label><input id={id} autoComplete="tel" inputMode="tel"/>` | 1.3.1, 3.3.2 |
| 4 | Red border only on error | `aria-invalid="true"` + `aria-describedby` + text + icon + Error Summary focus | 1.4.1, 3.3.1 |
| 5 | `onPaste={e => e.preventDefault()}` on OTP/phone | Allow paste; `autoComplete="one-time-code"` | 3.3.8 |
| 6 | `document.getElementById('phone-error')` | `useRef` / `useId` / `shadowRoot.getElementById` | Shadow DOM |
| 7 | `new CustomEvent('db:done', {detail})` | `new CustomEvent('db:onboarding-completed', {detail, bubbles:true, composed:true})` | Contract |
| 8 | `*:focus { outline: none }` | `:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px }` | 2.4.7 |
| 9 | `<div class="modal">` | `<dialog>` + `showModal()` | 2.4.3 |
| 10 | Count updates in plain text silently | `<div role="status" aria-live="polite">Showing 4 jobs…</div>` (always mounted) | 4.1.3 |
| 11 | Amharic text in `lang="en"` | `<span lang="am">…</span>` | 3.1.2 |
| 12 | `<select>` swapped for drag calendar | Three `<select>`s (Day/Month/Year) with Ethiopian month names, 13 months incl. Pagume | 2.5.7 |
| 13 | Hardcoded `'Next'` / `'ቀጣይ'` strings | `t('wizard.next')` from shared i18n | 3.1.1 |
| 14 | `fetch()` straight in a component | `apiClient.saveStep()` (auto Mock fallback) | Resilience |
| 15 | Icon font / `<i class="fa …">` in shadow DOM | Inline SVG (lucide-react) | Robustness |
| 16 | Job title as `<span class="title">` | `<h3><a href=… >Customer Support Agent at Acme (Addis Ababa)</a></h3>` | 1.3.1, 2.4.4 |
| 17 | Auto-submit voice transcript | Editable Review field + "Use this answer" | 3.3.4/UX |
| 18 | Session timeout that clears form | Local persistence, no expiry, silent token refresh | 2.2.1 |
| 19 | "Upload your medical certificate" | "What makes learning easiest for you?" (no proof) | Privacy |
| 20 | `console.log(profile)` / logging phone numbers | Log ids/codes only | Privacy |
| 21 | Accepting an LTI token on signature failure | `401` + bilingual error, render nothing | LTI 1.3 |
| 22 | `npm install foo` | `pnpm add -F @db/web-components foo` | Tooling |
| 23 | Fixed `width: 480px` panels | `width: 100%; max-width: 40rem;` fluid single column | 1.4.10 |
| 24 | 24 px icon button | `min-width: 44px; min-height: 44px` | 2.5.8 |
| 25 | Hiding the focused field under sticky bar | `scroll-margin-top: 6rem` | 2.4.11 |

---

## 9. Definition of Done (run before every PR; paste results in the PR)

1. `pnpm -r lint ; pnpm -r typecheck ; pnpm -r test` pass.
2. **API check (PowerShell):**
```powershell
# create session
$s = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/onboarding/sessions -ContentType 'application/json' -Body '{"lang":"en","partnerId":"demo"}'
# bad phone → expect 422 + bilingual body
try { Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/api/v1/onboarding/sessions/$($s.id)" -ContentType 'application/json' -Body '{"step":"contact","data":{"phone":"123"}}' }
catch { $_.ErrorDetails.Message }
# tampered LTI token → expect 401
try { Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/lti/launch -Body @{ id_token='x.y.z'; state='bad' } } catch { $_.Exception.Response.StatusCode.value__ }
```
3. **Keyboard:** unplug the mouse; Tab/Shift+Tab/Enter/Space/Esc from the Savanna host page into the widget and back; focus ring always visible and never obscured.
4. **NVDA** (Chrome + Firefox, Speech Viewer on): `H`, `D`, `F`, `B`, `K`, `NVDA+F7`, `NVDA+↓` over the full journey; errors, saves and job counts are spoken; Amharic switches voice where installed.
5. **TalkBack** inside a real Android WebView (`chrome://inspect`), "Display speech output" on.
6. **400% zoom** (1280 px wide at 400%): single column, no horizontal scroll, targets ≥ 44 px.
7. **Slow 3G + Offline** in DevTools: draft survives reload; Mock fallback engages.
8. **axe DevTools / `@axe-core/playwright`:** 0 serious, 0 critical, on the standalone page **and** the Savanna host page.
9. Screenshots/notes appended to `CO_DESIGNER_LOG.md` if a co-designer session happened.

**You break the Gate, you fix it:** a commit that adds a serious/critical axe issue, breaks keyboard flow, or removes a `<label>` is reverted if not fixed within 15 minutes.

---

## 10. How AI Agents Must Behave in This Repo

- Before editing, read the relevant section of this file and `shared-schemas`. Prefer small PRs.
- Do not invent endpoints, fields, event names, or error codes — add them to `shared-schemas` first (with team notice).
- If a requirement here is impossible (e.g., Amharic speech recognition unsupported on a device), implement the **documented fallback**, tell the user, and never fake success.
- Never delete tests or relax an axe rule to make a build pass.
- Never use dummy "lorem" content in user-facing flows; use realistic Ethiopian examples (names, Addis Ababa locations, `0911 234 567`).
- When unsure, ask the human which Dev role/file owns the change; do not edit files owned by another dev without telling them.
