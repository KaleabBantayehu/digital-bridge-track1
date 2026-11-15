# JUDGE_REPORT — Track 1 Accessible Onboarding + Career Gateway

Audited: a fresh clone of `origin/main` at `518caf7` (15 Nov 2026), built with the repo's own commands.
`HOURS_LEFT` assumed: 5. Scripts and raw outputs: `judge/` and `judge/out/`.
Tags: **VERIFIED** (ran it, output quoted), **INFERRED** (read the code, `file:line`), **CANNOT TEST** (needs a person or device).

> **Status update (15 Nov, branch `feat/dev2-codesigner-fixes`):** D-01, D-02 and D-14 fixed and re-tested —
> `node judge/gate.mjs` now reports **0 critical, 0 serious** in 55 state scans and `node scripts/judge-audit.mjs` passes
> 130/130 (incl. index.html and signup scrolled halfway). README fixes for D-08 (working curls), D-10 (build + serve +
> page links) and D-21 (both Slow-3G profiles) done. Still open: D-03 (co-designer log), D-04/D-05/D-06/D-07/D-15/D-16/D-19
> (API, Dev 3), D-09 now merged on main by Dev 4 (re-test LTI), D-11 (Docker, Dev 4), D-12 (LICENSE).

> **Status update (15 Nov afternoon, branch `feat/dev2-vision-sign`):** four colour modes and a sign-language panel
> added; `node scripts/judge-audit.mjs` now runs **154/154** (all four colour modes and the sign panel axe-clean),
> `node judge/gate.mjs` 0 violations in 55 state scans, `node scripts/test-dev1.mjs` 13/13 (158 KB gz), 0 DEP0190
> warnings. Also fixed on the way: Amharic text in `scripts/judge-audit.mjs` had been saved in the wrong encoding on
> main (the Amharic voice-command checks could not match), and voice control "down" no longer gets stuck on a list.

> **Status update (15 Nov evening, round-2 fixes):** 12 blind / voice-only findings fixed (see CO_DESIGNER_LOG.md);
> `node scripts/judge-audit.mjs` **172/172**, `node judge/gate.mjs` 0 violations in 55 states, unit tests 38/38,
> `node scripts/test-dev1.mjs` 13/13 (166 KB gz), **LTI 8/8** (`scripts/test-lti.mjs`), 0 third-party requests,
> Slow 3G 5.5 s on the plain page. `index.html` rebuilt as the demo hub (0 violations at 1280 and 320 px).

---

## 1. Verdict

| Gate item | Result |
|---|---|
| 1. Co-designer completes the task unaided (NVDA, TalkBack, keyboard, 200 %, sound off) | **UNVERIFIED** — `CO_DESIGNER_LOG.md` is an empty template. Scripted proxies pass (keyboard, a11y tree, zoom, sound off). |
| 2. axe-core: 0 critical, 0 serious | **FAIL** — 0 critical, **5 serious** across 54 scans: four in the widget when the page is scrolled (the sticky top bar covers help buttons), one on `index.html`. Fix ≈ 20 min. |
| 3. WCAG 2.2 AA conformance report | **PASS with credibility risk** — `CONFORMANCE.md` exists in the right format with honest "not yet tested" notes, but it claims "0 axe violations" and Supports for 2.4.11 / 2.5.8, which this audit contradicts, and it does not end with who tested on which device. |

**GATE: FAIL — not scored (as of `518caf7`).** Both blocking items are small CSS fixes (D-01, D-02). After them, the gate depends on a real co-designer session (D-03).

**Proxy score if the gate passed: 68 / 100 (range 56–79). Confidence: low-medium** (no co-designer data; category A is the widest).

**Top 5 point-losers**
1. Gate: sticky top bar + `index.html` axe failures (D-01, D-02) — the whole score is at stake.
2. No co-designer evidence (D-03) — category A (30) cannot be scored well without it.
3. In API mode nothing the learner types reaches the server: every PATCH is rejected with 422 (D-04). SMS resume across devices then says "Your answers are back" while restoring nothing.
4. API privacy hole: no token = full access; any client can mint any scope; export without `sessionId` returns another learner (D-05, D-06, D-07).
5. README promises that fail when pasted: `/api/v1/learners` curl → 404, `/docs` → 404, LTI 1.3 + Mock LMS claimed but not on `main`, no `docker compose`, no way to reach the Savanna pages or `demo/blank.html` from "Run it" (D-08 to D-13).

---

## 2. Gate table

| ID | Result | Evidence | Command |
|---|---|---|---|
| G1 build & run | **PASS (README path) / CANNOT TEST (Docker)** | Clean clone 10 s; `pnpm install` 12 min 14 s; `pnpm build` 9 min 05 s, exit 0; `pnpm dev` → 5173 and 3000 answer 200 after ~8 s. Docker CLI 29.9.3 present, **daemon not running** (`npipe ... dockerDesktopLinuxEngine: cannot find the file`). README does not mention `docker compose`. Under `pnpm dev`, `/pages/signup.html` and `/demo/blank.html` both return the "Standalone Dev" page (SPA fallback). | see `judge/README.md` |
| G2 axe | **FAIL** | 54 scans, 10 surfaces + 26 states, en + am. critical 0 · **serious 5** · moderate 0 · minor 0. Serious: `target-size` on "My data" (step 6 en, step 3 am) and "Read aloud" (after voice answers): *"partially obscured (smallest space is 114.8px by 16.9px)"*, related nodes = the top-bar links; `index.html`: `color-contrast` + `target-size`. Full table: `judge/out/g2-axe.md`. | `node judge/gate.mjs`, `node judge/probe-target.mjs` |
| G3 keyboard | **PASS (scripted)** | Onboarding 155 keys, job application 105 keys, no mouse. First Tab = skip link. Focus on the step `<h2>` after every step change. Privacy dialog: focus inside, Esc returns focus to "My data". 0 positive tabindex. Focus ring ≥ 2 px everywhere. "Covered" hits were Bootstrap smooth-scroll timing: re-measured after 700 ms, every focus stop is in view. | `node judge/keyboard.mjs`, `node judge/probe-scroll.mjs` |
| G4 screen-reader proxy | **PASS (proxy)** | a11y tree, 10 states × 2 languages: exactly one step `h2` ("Step 3 of 7: How can we contact you?" / "ደረጃ 3 ከ 7፦ እንዴት እናግኝዎ?"), 0 unnamed fields, 0 broken `aria-describedby/labelledby/controls` ids, exactly 1 `role=status` region, every invalid field has a message, 0 Ethiopic text outside `lang="am"`, 0 Latin words inside `lang="am"`. Snapshots: `judge/out/g4-aria-*.yml`. | `node judge/keyboard.mjs` |
| G5 zoom / reflow | **PASS** | 640, 320 and 360 px on signup, profile, jobs, blank, homepage: no horizontal scroll; 0 targets under 24 px. Screens: `judge/screens/320-*.png`. Forced colours: axe 0. Text resize to 200 % scales labels 14 → 32 px, no h-scroll. | `node judge/gate.mjs`, `node judge/personas.mjs` |
| G6 sound off | **PASS** | On load: 0 audio plays, 0 `speechSynthesis.speak`. Read aloud (am, no voice): plays `assets/audio/am/step0.mp3` and shows the caption "ደረጃ 1 ከ 7፦ እንኳን ደህና መጡ…" on screen. Every cue has on-screen text. | `node judge/gate.mjs` |
| G7 conformance report | **PASS / credibility risk** | `CONFORMANCE.md` present, table format, per-criterion notes, honest untested list. Contradictions: "0 violations" (line ~24), 2.4.11 Supports (line 90), 2.5.8 Supports (line 96) vs G2. No closing "tested by / device / screen reader / could not do". | read + G2 |
| G8 seven tasks (proxy) | **6 / 7** | T1 typed ✔ en+am · T2 voice on two fields ✔ (text appears in an editable Review box, field stays empty until "Use this answer", read-back spoke "Abebe" en-US) · T3 partner referral ✔ ("Confirmed. Your voucher code is VOUCH-…", finishes) · **T4 SMS resume ✘** (mock: link only works on the same device; API: "Your answers are back" shown, consent unticked and name empty, see D-04) · T5 Amharic + Ethiopian date ✔ (13 months, last ጳጉሜ; 1 Meskerem 2000 → "ሴፕቴምበር 12, 2007") · T6 private filter + voice apply ✔ (0 requests carry filter selections; "Showing 4 jobs…"; zero-results message) · T7 error + recovery ✔ on 5 steps, both languages. | `gate.mjs`, `task3.mjs`, `resume.mjs` |

---

## 3. Score table (proxy; organisers publish only the five totals)

| Line | Pts | Range | Evidence | Why |
|---|---|---|---|---|
| A1 Main task unaided (proxy) | 7.5 / 10 | 5–9 | G3, G8 | 6/7 tasks; SMS resume broken; gate CSS issue |
| A2 Screen-reader quality (proxy) | 4.5 / 6 | 3.5–5.5 | G4 | Clean tree; real NVDA/TalkBack unknown |
| A3 Keyboard/focus/zoom/targets/contrast | 4 / 5 | 3–4.5 | G3, G5, D-01 | All good except help buttons covered when scrolled |
| A4 Voice + review + read-back + voice note | 3 / 3 | 2.5–3 | T2, voice code | Review box, read-back, voice notes, Amharic fallback, voice control |
| A5 Low-literacy path | 2 / 3 | 1.5–2.5 | personas | Simple words changes copy on every step; "Listen" on every step; icons only on ID choices (D-18) |
| A6 21 October findings mapped | 1.5 / 3 | 1–2 | static | Features exist (no time-out, no-ID route, captions/ESL option, Amharic help, accessible job list) but README/report never maps them |
| **A total** | **22.5 / 30** | **16–26** | | No co-designer data — widest uncertainty |
| B1 One-hour install from README | 4 / 8 | 3–5.5 | G1, D-08, D-10 | Works, but curl #1 404, `/docs` 404, no Docker line, no way to the Savanna/blank pages |
| B2 Level 1 quality | 5 / 6 | 4.5–5.5 | plugin.json | Blank page works; 149 KB / 2 requests; no new globals; host styles unchanged; `<db-signup lang api>` alias. Minus: Google Fonts link added to host `<head>` (D-14), rem follows host root size (D-23) |
| B3 Level 2 quality | 3 / 6 | 2–4 | api.json | One bilingual error envelope across 9 failure types (good). Minus: auth bypass, token minting, CORS `*`, no `openapi.yaml`, curl 404, widget→API PATCH 422 |
| B4 Level 3 | 2 / 5 | 1–3 | jobs.html, api.json | JobPosting JSON-LD present in page and widget. LTI 1.3 claimed but `LtiModule` is empty on `main` and `/lti/*` → 404 |
| **B total** | **14 / 25** | **11–18** | | |
| C1 Amharic complete | 3.5 / 4 | 3–4 | ethiopia.json | 308/308 keys, 0 untranslated, 0 English in `lang="am"`; native review pending |
| C2 Calendar | 3 / 3 | 3 | ethiopia.json | 412 dates incl. anchors match `Intl` exactly; Pagume 5/6 correct |
| C3 Phones | 2 / 2 | 2 | ethiopia.json | 09/07/+251/251/spaces/dashes/Ethiopic numerals → `+2519…`; invalid rejected with example |
| C4 Slow 3G measured & small | 2.5 / 3 | 2–3 | ethiopia.json | 148 KB gz; judge profile (500 kbit/s, 400 ms, 4× CPU): first question 5.4 s blank / 7.7 s Savanna; README says 4.2 s (lighter profile, D-21) |
| C5 Offline & messaging | 2.5 / 3 | 2–3 | ethiopia.json | "Saved on this phone. It will send when you are online." shown; answers kept; no service worker (page does not reload offline) |
| **C total** | **13.5 / 15** | **12–14.5** | | Strongest category |
| D1 Tests + runnable axe script | 2.5 / 3 | 2–3 | static.json | vitest unit tests + `scripts/judge-audit.mjs` / `test-dev1.mjs`; `pnpm gate` itself does not run axe |
| D2 Minimum data & consent | 2.5 / 3 | 2–3 | code | Consent first; no medical proof (grep: only "No medical proof required"); voice off until pressed |
| D3 Support separated + private filter | 3.5 / 4 | 3–4 | T6, plugin.json | 0 filter requests; support never in `db-signup:done`; separate consented event |
| D4 Nothing leaves host without consent | 1 / 2 | 0.5–1.5 | ethiopia.json | Google Fonts on every load; Chrome speech recognition goes to Google (documented) |
| D5 Export / delete | 1 / 2 | 0.5–1.5 | api checks | UI works; API delete/export open to anyone (D-05, D-07) |
| D6 Security hygiene | 0 / 1 | 0 | api, audit | Auth bypass, token minting, CORS `*`, fallback JWT secret, 3 critical / 17 high advisories |
| **D total** | **10.5 / 15** | **8.5–12.5** | | |
| E1 Docker one command | 1.5 / 4 | 0–3 | G1, static | Compose exists; not in README; `vite` dev without `--host` (INFERRED unreachable from host); untested here |
| E2 No paid lock-in, useful offline | 3.5 / 4 | 3–4 | code | Mock API, browser speech, SQLite; edge-tts is build-time only |
| E3 README a stranger can follow | 2 / 4 | 1.5–3 | §4.1 | Gaps above |
| E4 Cost to run | 1.5 / 2 | 1–2 | README | "$0–$5" stated; real SMS cost not included |
| E5 Licences | 0 / 1 | 0–0.5 | static | No `LICENSE` file; list is partial |
| **E total** | **8.5 / 15** | **6–12** | | |
| **Total** | **68 / 100** | **56–79** | | Gate overlay: FAIL until D-01/D-02 fixed |

---

## 4. Defect register (sorted by points per hour)

| ID | Sev | Cat | Tag | What is wrong | Evidence | Fix (smallest viable) | Pts | Min | Owner |
|---|---|---|---|---|---|---|---|---|---|
| D-01 | S1 | A | VERIFIED | Sticky `.db-savanna-topbar` covers the widget's help buttons once the page scrolls → axe `target-size` **serious** in 4 states; 2.4.11 risk | `judge/out/g2-axe.md`; probe: button y −6..38 under top bar y 0..62, `position: sticky` | In `assets/css/host-a11y-fixes.css` set `.db-savanna-topbar { position: static !important; }` (drop the sticky rule); re-run `gate.mjs` | Gate | 5 | Dev 1 |
| D-02 | S1 | A | VERIFIED | `index.html` (landing page in `dist/`): `color-contrast` serious on card heading links; `target-size` serious on `standalone.html` / `external-partner-demo.html` links | `judge/out/g2-axe.md` | Link colour `#7a2b18` (or include `host-a11y-fixes.css`), `display:inline-block; min-height:44px; padding` on those links | Gate | 15 | Dev 1 |
| D-07 | S2 | D | VERIFIED | `GET /privacy/export` without `sessionId` returns another learner's record (TypeORM `where: { id: undefined }` matches the first row); same pattern in `remove` | `privacy.service.ts:20,30`; output: `{"session":{"id":"6a3fa192…","partnerId":"demo"…` | `if (!sessionId) throw 400` in controller + service | 2 | 5 | Dev 3 |
| D-15 | S3 | D | VERIFIED | CORS allows every origin | `main.ts` `app.enableCors()`; response `access-control-allow-origin: *` | `app.enableCors({ origin: process.env.CORS_ORIGINS.split(',') })` (already in `.env.example`) | 1 | 5 | Dev 3 |
| D-19 | S3 | B | VERIFIED | README says Swagger at `/docs`; `/docs` → 404 | api.json `"/docs": 404` | `SwaggerModule.setup('docs', …)` as well, or fix README | 1 | 5 | Dev 3 |
| D-08 | S2 | B | VERIFIED | README Level 2 first curl → **404** (`/api/v1/learners` does not exist) | api.json readmeCurls[0] `HTTP 404` | Replace with: create session, PATCH a bad phone (shows bilingual 422), GET jobs, get a token | 2 | 10 | Lead |
| D-12 | S2 | E | VERIFIED | No `LICENSE` file; README licence line lists 9 names only | static.json `licenceFile: []` | Add MIT `LICENSE`; paste `pnpm licenses list --prod` summary (all MIT/ISC/Apache/BSD, 0 copyleft) | 1.5 | 10 | Lead |
| D-04 | S2 | A/B | VERIFIED | Widget→API sync: every `PATCH /onboarding/sessions/:id` → 422 *"property revision should not exist… clientUpdatedAt should not exist"*; the ordered queue retries the first item forever, so no answer ever reaches the server. Cross-device SMS resume then announces "Your answers are back" with nothing restored | `judge/out/probe-sync.txt`; resume.json `freshConsentTicked:false, freshGivenNameAfterContinue:""` | Add `@IsOptional() @IsInt() revision` and `@IsOptional() @IsISO8601() clientUpdatedAt` to the PATCH DTO; in `syncQueue` drop (and report) items that get a 4xx instead of retrying; announce "restored" only when fields changed | 4 | 30 | Dev 3 + Dev 1 |
| D-06 | S2 | D | VERIFIED | `POST /auth/token` issues any scope to any `clientId` / `clientSecret` | made-up client got a `privacy:delete` token | Check a `PARTNER_CLIENTS` env map (id → secret → allowed scopes); 401 otherwise | 1.5 | 20 | Dev 3 |
| D-10 | S2 | E | VERIFIED | "Run it" has no `docker compose`; `pnpm dev` only shows the Standalone Dev page — `/pages/signup.html` and `/demo/blank.html` fall back to it | dev-server titles both "Digital Bridge Track 1 — Standalone Dev" | README: `pnpm build` then `npx serve apps/web-components/dist` (or `python -m http.server -d apps/web-components/dist 8080`) and list the page URLs; add the `docker compose up --build` line once D-11 works | 2.5 | 15 | Lead |
| D-09 | S2 | B | VERIFIED | README Level 3 claims LTI 1.3 + Mock LMS; `apps/api/src/lti/lti.module.ts` is an empty `@Module({})`; `/api/v1/lti/jwks`, `/login`, `/launch` → 404. The work sits on unmerged `feat/dev4-lti-qa` | api.json; `lti.module.ts:3` | Merge Dev 4's branch only if its checks pass today; otherwise rewrite Level 3 honestly: JobPosting JSON-LD done, "how LTI would connect" paragraph | 2 | 15 (honest) / 90 (merge + test) | Dev 4 |
| D-05 | S2 | D | VERIFIED | `ScopesGuard` lets any request without an `Authorization` header through (`scopes.guard.ts:19`): unauthenticated `DELETE /privacy/data?sessionId=…` → 204 and the learner is gone | curl: `DELETE … 204`, then `GET session … 404` | Reject when the header is missing; give the widget a per-session token at session creation and send it with export/delete | 2 | 45 | Dev 3 + Dev 1 |
| D-03 | S1 | A | UNVERIFIED | No co-designer session recorded; `CONFORMANCE.md` does not end with tester / device / screen reader / "could not do" | `CO_DESIGNER_LOG.md` empty template | Run the 7 tasks with one co-designer today (NVDA + keyboard + 200 % + sound off minimum); fill the log; add the closing section | Gate + up to 10 | 90 | Lead |
| D-13 | S2 | B/E | VERIFIED | README lacks team members + co-designer, the organisers' one-sentence task, every attribute and every event, 21-October mapping | static.json headings | Add those sections (the events table exists in the dev2 branch README — reuse) | 2 | 30 | Lead |
| D-31 | S3 | A | VERIFIED | `CONFORMANCE.md` contradicts this audit (0 violations; 2.4.11 / 2.5.8 Supports) | G2 vs `CONFORMANCE.md:24,90,96` | After D-01/D-02, re-run `gate.mjs` and paste its numbers; mark 2.4.11 "Partly" until fixed | 1.5 | 15 | Dev 2 |
| D-14 | S3 | D | VERIFIED | Widget appends a Google Fonts `<link>` to the host `<head>` on every load: third-party call the host did not configure; extra 3G cost; fails offline | plugin.json `headAdditions`; ethiopia.json `thirdPartyHosts` | Remove `loadDocumentFonts` (Nyala/Noto/system fallback already in the stack) or make it opt-in via a `fonts` attribute; or self-host the woff2 in `dist/` | 1 | 15 | Dev 2 |
| D-24 | S3 | B | VERIFIED | API SMS link is `http://localhost:5173/?resumeToken=…` but the widget reads `?resume=` | resume-sms response `devLink` | `PUBLIC_RESUME_URL` env + param name `resume` | 1 | 10 | Dev 3 |
| D-25 | S3 | A | VERIFIED | "property X should not exist" is reported as code `REQUIRED`, "This field is required." — wrong advice | probe-sync fields | Map `whitelistValidation` errors to `UNKNOWN_FIELD` with a bilingual message | 0.5 | 10 | Dev 3 |
| D-16 | S3 | D | INFERRED | Hard-coded fallback JWT secret when `JWT_SECRET` is unset | `auth.controller.ts:35`, `scopes.guard.ts:8` (value not reproduced) | Fail fast at boot if `JWT_SECRET` is missing outside dev | 0.5 | 5 | Dev 3 |
| D-11 | S2 | E | INFERRED | Docker: `CMD pnpm dev` runs Vite without `--host`, so port 5173 is likely unreachable from the host; no healthcheck; `--frozen-lockfile=false`; never run here (daemon off) | `Dockerfile:10,13`, `apps/web-components/package.json` dev script | Container builds once, then serves `dist/` (static) + `node apps/api/dist/main.js`; add `HEALTHCHECK` on `/api/v1/health`; test on any machine with Docker running | 2.5 | 45 | Dev 4 |
| D-20 | S3 | B | VERIFIED | No `openapi.yaml` at repo root (only `docs/openapi.json`) | static.json | Commit `openapi.yaml` (convert the JSON) and link it from README | 0.5 | 10 | Dev 3 |
| D-21 | S3 | C | VERIFIED | README Slow-3G figure (4.2 s) uses a lighter profile than judges will (500 kbit/s + 4× CPU → 5.4 s) | ethiopia.json | State both numbers and the method | 0.5 | 5 | Lead |
| D-18 | S3 | A | VERIFIED | Simple words: icons only on the 4 ID-route choices; consent, calendar and support choices have none | personas.json `withIcon: 0` | Add a lucide icon per support need / consent item when `simple` is on (`aria-hidden`) | 1 | 30 | Dev 2 |
| D-17 | S3 | D | VERIFIED | `pnpm audit`: 3 critical (vitest/tinypool, dev only), 17 high (multer, body-parser via `@nestjs/platform-express` 10.4.22; js-yaml/lodash via swagger; zod) | static run | Bump `@nestjs/*` to latest 10.x, `vitest` to 3.x; re-run tests | 0.5 | 45 | Dev 3 |
| D-26 | S4 | A | INFERRED | Neural clips: unused keys (`name`, `contact`, `dob`, `identity`, `support`, `review`) are identical 11 232-byte files — likely the TTS of the bare key word; step clips read only the title while the caption shows title + hint | `generate-tts-audio.mjs` `textFor` falls back to `key`; file sizes | Generate clips from the same text the caption shows; delete unused clips | 0.5 | 20 | Dev 2 |
| D-23 | S4 | B | VERIFIED | Widget text sizes follow the host's root font size (Tailwind rem): hostile CSS made labels 40 px | plugin.json `hostileCss.labelFontSize` | Acceptable (respects user font size); document it, or set Tailwind to px for layout-critical parts | 0.2 | — | Dev 2 |
| D-22 | S3 | C | VERIFIED | No service worker: draft survives offline, the page itself does not reload offline | ethiopia.json | Optional: tiny SW precaching `db-signup.js` + page shell | 1 | 60 | Dev 1 |
| D-27 | S4 | E | INFERRED | `edge-tts` calls Microsoft's online read-aloud service at build time; README calls it "zero-cost neural TTS" without terms | `generate-tts-audio.mjs:38` | One line in README: build-time only, clips are static; check the service terms | 0.3 | 10 | Lead |
| D-29 | S4 | A | VERIFIED | 5 English strings > 15 words; jargon "Consent", "preferences" | personas.json | Shorten `voice.amFallback`, `privacy.body`, `readAloud.visualNote`, `help.dialogBody4`, `vc.noField` | 0.3 | 20 | Dev 2 |
| D-30 | S4 | B | VERIFIED | No CHANGELOG (semver file name exists) | static.json | `CHANGELOG.md` with 1.0.0 entry | 0.2 | 5 | Lead |
| D-28 | S4 | E | VERIFIED | 25 pre-signed S3 URLs with AWS access-key IDs in `pages/homepage-v1-paced.html` | git grep (values not reproduced) | Came from the organisers' starter (identical in the zip), expired 4 Nov (`X-Amz-Expires=14400`). No action; know the answer if asked | 0 | 0 | — |

Host files: `application_alx.css`, `app.css`, `static-page.js` are byte-identical to `Savanna-static-pages-main.zip` (VERIFIED, md5 after CRLF normalisation).

---

## 5. Do-this-first plan (5 hours)

**If only 1 hour:** 1–7.
1. D-01 top bar static (5 min) → D-02 index links (15 min) → re-run `node judge/gate.mjs`, expect serious 0.
2. D-07 + D-15 + D-19 + D-16 (20 min, one Dev 3 PR).
3. D-08 README curls, D-12 LICENSE (20 min).

**Hour 2:** 4. D-04 PATCH DTO + queue drop-on-4xx (30 min), re-run `node judge/resume.mjs` and `probe-sync.mjs`. 5. D-06 token check (20 min).

**Hour 3:** 6. **D-03 co-designer session** — highest value left; nothing else replaces it. Log every task honestly.

**Hour 4:** 7. D-10 + D-13 + D-21 README (45 min). 8. D-09: decide — merge Dev 4 LTI only if its tests pass, else honest section (15 min).

**Hour 5 (cut here if late):** 9. D-05 per-session token (45 min). 10. D-31 update CONFORMANCE with the re-run numbers and the session results.
**Skip unless everything above is green:** D-11 Docker rework, D-17 dependency bumps, D-18 icons, D-22 service worker, D-26 clips.

**12:00 freeze rule:** after noon only S1/S2 fixes, each followed by `node judge/gate.mjs`.

---

## 6. Questions the panel will ask (best honest answer today; weak spots marked)

1. *Did a blind co-designer finish unaided?* — Not yet recorded. **Weak.** Have the log by Sunday.
2. *Show me axe on the Savanna page.* — 0 on load; 5 serious when scrolled until D-01/D-02. **Weak until fixed.**
3. *A refugee has no document tonight — what does the host receive, what does the learner see?* — Learner picks "Refer me through a partner organisation", chooses AAAPD/SNV/Mercy Corps/Tomorrow is Better, names the staff member, ticks consent → "Confirmed. Your voucher code is VOUCH-…" → finishes. Host receives `db-signup:done` with `idRoute: "partner_voucher"`, no support data. Strong (verified offline; API vouch needs a partner token).
4. *The connection drops on question seven — what happens?* — Answer saved on the device, "Saved on this phone. It will send when you are online." shown, nothing lost on reconnect (verified). **Weak:** in API mode the sync currently fails (D-04).
5. *How does someone who cannot read finish alone?* — Read aloud on every step (neural Amharic clip + caption), Simple words, voice answers with read-back, voice notes, hands-free voice control (Alt+V, Amharic/English commands). Icons only on some choices (D-18).
6. *How does a partner register a learner with consent, without their password?* — There are no passwords; partner-assisted mode banner + voucher with recorded consent. API side needs a partner token — and today any client can mint one (D-06). **Weak.**
7. *Where do support choices go?* — Device only; never in `db-signup:done`; separate `db-signup:support` only after the learner ticks share; employers see them only if ticked per application. Strong.
8. *Does the job filter send anything?* — No: 0 requests carry selections (verified). The API also offers `?accommodations=` for partners; it is unused by the widget — say so.
9. *Install it on my blank page in 10 minutes.* — `demo/blank.html` works (149 KB, 2 requests, no globals). README must show how to serve `dist/` (D-10).
10. *Paste your README curl.* — First one 404s today (D-08).
11. *LTI?* — Not on `main` (D-09). Answer honestly.
12. *What if the phone has no Amharic voice?* — Bundled neural clips play; caption box always shows the words; dictation falls back to a voice note automatically.
13. *Ethiopian calendar correctness?* — 412 dates incl. Pagume leap years identical to `Intl` (verified).
14. *What does it cost for 3,000 learners?* — Static bundle + SQLite: near zero; real SMS cost per message not included — give a number per SMS.
15. *Who can delete a learner's data?* — The learner from "My data". **Weak:** the API also lets anyone with a session id (D-05).

---

## 7. Extra-advantage opportunities

| Idea | Benefit to disabled users | Points | Effort | Risk |
|---|---|---|---|---|
| Publish `judge/` as the team's "anyone can run" accessibility check (one `pnpm judge` script) | Trust; repeatable evidence | D1 +0.5, credibility | 15 min | Low |
| One-page "21 October findings → what we built" table in README | Shows listening | A6 +1.5 | 20 min | Low |
| Record a 60-second screen-reader + voice-control demo video with captions | Judges see it working | A +1 | 30 min | Low |
| Self-host Noto Sans Ethiopic subset in `dist/` | Ethiopic renders on cheap phones without Google | C/D +1 | 20 min | Low |
| Tiny service worker for `db-signup.js` + pages | Opens offline on second visit | C5 +0.5 | 60 min | Medium |
| Icons per support need in Simple words | Low-literacy learners | A5 +1 | 30 min | Low |
| Co-designer quotes in CONFORMANCE (with consent) | Honest evidence beats "Supports" | G7, A +2 | with session | Low |
| `PUBLIC_RESUME_URL` + real SMS adapter stub (Africa's Talking/console) | Resume works on another phone | Extra credit | 30 min | Low |
| Afaan Oromo proof: add `om.json` with 10 keys + fallback to English, show it works | Built-for-Ethiopia | C +0.5 | 30 min | Medium (partial translation) |
| `theme="high-contrast"` demo toggle on the host pages | Low vision | A3 +0.5 | 10 min | Low |
| Show the measured Slow-3G number and 148 KB in the widget footer of the demo page | Concrete | C4 +0.5 | 10 min | Low |
| Per-session export/delete token (D-05) as a privacy story | Learner owns their data | D5 +1 | 45 min | Medium |

---

## 8. Honesty: not tested / proxy only / needs a human

- **CANNOT TEST:** NVDA and TalkBack speech output; a real microphone and real `am-ET` recognition on Ethiopian names; Amharic TTS voices on a co-designer's phone; a physical low-cost Android phone on real 3G; real co-designer completion and scores; Ethiopian Sign Language usability; native reading of the Amharic copy; `docker compose up` (daemon off on this machine; needs any machine with Docker running); HTTPS/hosted URL on a phone (microphone needs HTTPS).
- **Proxy only:** G3 keyboard (scripted keys), G4 (accessibility tree), G8 tasks (scripted user, stubbed `SpeechRecognition`, fake microphone).
- **Machine notes:** this laptop is slow (install 12 min, build 9 min, API cold start ~2 min 40 s). A judge's machine will likely be faster.

## 9. Reproduction

All scripts, commands and outputs: `judge/README.md`, `judge/out/*.json|md|yml|txt`, `judge/screens/*.png`.
Tested commit: `518caf7`. The clean clone used for the audit lived outside the repo; nothing in product code was modified by this audit.
