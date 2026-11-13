# TRACK_1_MASTER_REQUIREMENTS.md — Project Bible

Digital Bridge Accessibility Hackathon 2026 · Track 1: Accessible Onboarding (+ mandatory Career Gateway)
Timeline: Friday build night → Saturday live co-designer testing → Sunday 16:30 submission.
Read time: ~10 minutes. If anything here conflicts with the organisers' official pages, **the organisers win** — re-check digitalbridge.et.

---

## 1. Executive Summary

**The problem.** Partner platforms (websites, apps, Moodle, Canvas, Blackboard, ALX Savanna, Ehab) each use a different stack, so writing accessible onboarding per partner doesn't scale. Meanwhile 95.9% of top home pages had detectable WCAG failures in 2026 (WebAIM Million). In Ethiopia, people who are blind, Deaf, have motor or cognitive disabilities, have low literacy, or are refugees/displaced without a Kebele ID or passport are locked out at *registration* and *job application*.

**What we build — one core, three doors:**

| Door | What partners get | Effort for partner |
|---|---|---|
| 1. Web Components | `<db-onboarding-wizard>`, `<db-career-gateway>`, `<db-employer-accommodations>` — paste a tag | Minutes |
| 2. REST API `/api/v1` | Same features as JSON, OAuth 2.0, Swagger docs, bilingual errors | Days |
| 3. LTI 1.3 | Launch inside Canvas/Moodle/Blackboard/Savanna with SSO, grade passback, class list | One-time admin setup |

**Two modules:**
- **Module A — Accessible Onboarding & Learner Profile Kit.**
- **Module B — Career Gateway** (mandatory in *every* track; there is no separate Career Gateway track): accessible job application + private "Support I Need" filter + employer accommodation checklist.

**Why we win:** the rubric is 30/25/15/15/15 (§8) behind a pass/fail accessibility gate. We optimise for (1) a real co-designer finishing unaided, (2) a judge installing it in < 1 hour with all three doors, (3) genuinely Ethiopian (Amharic, Ethiopian calendar, 09/07 phones, 3G/offline), (4) privacy by design, (5) zero paid-API lock-in.

> **Honest risk register** (so nobody is surprised Saturday): Amharic speech recognition (`am-ET`) and Amharic TTS voices are patchy across browsers/Android. Our product must be fully usable with typing and text when they're absent — voice is an *enhancement with graceful fallback*, and we must test on the exact devices the co-designer uses.

---

## 2. Personas (design and test against all of them)

| Persona | Setup | What breaks for them today | What we must guarantee |
|---|---|---|---|
| **Selam — blind, NVDA (Windows) / TalkBack (Android)** | Chrome + NVDA; phone with TalkBack in a WebView | Unlabeled fields, silent errors, `div` buttons, focus lost after step change | Every control named; step heading receives focus; errors/saves/job counts announced; landmarks & headings navigable; `lang="am"` switches voice |
| **Dawit — low vision, 400% zoom** | 1280 px at 400% = 320 px | Horizontal scroll, clipped text, tiny targets, low contrast | Single-column reflow, ≥ 4.5:1 contrast, 44 px targets, visible 3 px focus ring, high-contrast theme |
| **Hana — motor impairment, keyboard / voice / switch** | No mouse; speech dictation; limited typing | Drag-only UI, small targets, timeouts, forced retyping | Everything via keyboard, voice on every field with Review & Edit, auto-save, no timeouts, no redundant entry |
| **Abebech — low literacy** | Basic reading in Amharic, prefers audio and icons | Walls of text, jargon, many fields at once | One question per screen, simple words, icon + label, "Read question aloud" on every screen, progress shown |
| **Yonas — refugee/IDP, no Kebele ID/passport** | Shared phone, patchy 3G | Hard ID wall at sign-up | 4 ID routes incl. refugee ID, community document, partner voucher "Refer Me"; offline draft; save/resume by SMS |
| *(Deaf users)* | — | Audio-only cues | No audio-only information; all TTS has on-screen text; captions/sign-language support request offered in preferences |

---

## 3. `<db-onboarding-wizard>` — Screen-by-Screen

Common to every screen: `<h2>` "Step X of 6: …" (focus lands here on arrival), `<progress>` with text "Step 2 of 6", **Previous** / **Save & continue** buttons (44 px), a consistent help cluster (same DOM position — 3.2.6): **Read aloud**, **Switch language (English / አማርኛ)**, **Simple words** toggle, **Need help**. A persistent `role="status"` live region ("Saved on this device"). **No timeout.** Autosave on every change.

**Step 0 — Welcome / language & consent (before Step 1).** Language choice (en/am; sets `lang`). Plain-language consent summary with a privacy drawer (native `<dialog>`) covering: what we collect, why, who sees it, how to **export** or **delete** everything in one click, and that support needs are never shared without permission. References Ethiopia's Personal Data Protection Proclamation No. 1321/2024 (confirm the citation before publishing). Separate unchecked consent checkboxes: (a) save my answers, (b) allow SMS to resume, (c) share profile with employers *(optional, later)*.

**Step 1 of 6 — Your name.** `given-name`, `family-name` (autocomplete tokens). Voice button on each; Review & Edit.

**Step 2 of 6 — How can we contact you?** Phone (accept `09XXXXXXXX`, `07XXXXXXXX`, `+2519XXXXXXXX`, `+2517XXXXXXXX`, spaces/hyphens tolerated; normalise to `+251…`) and optional email. Error example: "Enter 10 digits, for example 0911 234 567". Option "I share a phone — contact me through my partner organisation".

**Step 3 of 6 — Date of birth.** Three `<select>`s (Day / Month / Year) with a calendar switch (Ethiopian ⇄ Gregorian). Ethiopian: 13 months Meskerem…Pagume (Pagume 5 days, 6 in leap years); day list adapts to month/year. Stored as ISO Gregorian + the user's displayed calendar value. Never a drag/popup calendar.

**Step 4 of 6 — Proving who you are (no one is blocked).** Radio group (`<fieldset>`) with four equal, non-stigmatising options:
1. National / Kebele ID or Passport (number + optional photo).
2. Refugee / asylum-seeker / returnee ID (UNHCR / RRS number or photo).
3. Community or school document (school certificate, birth record, ward letter).
4. **"Refer me" — a partner organisation vouches for me** (AAAPD, SNV, Mercy Corps, Tomorrow is Better, other): learner chooses the partner and enters a referral code *or* asks an agent to register them; explicit recorded consent (checkbox or voice-recorded yes). "I don't have any of these" leads to option 4, never to a dead end.
Upload has a click alternative to any drag area (2.5.7).

**Step 5 of 6 — What makes learning and work easiest for you?** Multi-select (`<fieldset>`), icon + text each, no diagnosis asked: screen-reader-compatible materials · sign language / captions · step-free venue · extra time / flexible deadlines · high contrast / large text · instructions read aloud · written instead of phone calls · (other, free text with voice). Banner: **"No medical proof required. This stays private and is never shared without your permission."** Optional "Tell my learning provider" vs "Keep private" choice.

**Step 6 of 6 — Review & finish.** Summary list (each row has an "Edit" link to its step), consent recap, **Submit**. On success: focus moves to the success heading, live-region announces completion, dispatches `db:onboarding-completed`, offers "Find jobs that fit" (→ Career Gateway) and "Export / delete my data".

### Voice Input + Review/Edit (every text/number/textarea field)
1. Mic `<button aria-pressed>` → request permission → live region: "Listening… speak now".
2. Transcript appears in an **editable** field labelled "Review what we heard"; live region reads "Heard: …".
3. Buttons: **Use this answer** / **Try again** / **Type instead**. Never auto-advance.
4. Languages: `en-US`, `am-ET` (feature-detect; if unsupported show "Voice isn't available in this language on this device — please type"). Optional fallback: record audio (`MediaRecorder`) → upload as an attachment for a human/partner to transcribe (flag "answer pending review").
5. Requires HTTPS in production (and for Saturday's device testing).

### Low-Literacy mode + Read Aloud
"Simple words" toggle swaps copy for a plain-language variant, enlarges text, shows icons beside every option (inline SVG + text). "Read question aloud" uses `speechSynthesis` for en/am; if no Amharic voice is installed, play bundled audio clips for the core prompts and say so. Controls: Play / Pause / Stop.

### Save & Resume via SMS / magic link (bonus)
User enters a phone number → `POST …/resume-sms` → one-time, expiring (e.g., 24 h), single-use token link `…?resume=<token>`; in dev the SMS is **simulated** (visible in a dev inbox page + API log) behind a `SmsProvider` interface. Opening the link restores the draft on another device. Token field allows paste; no puzzles (3.3.8).

### Partner-assisted registration (bonus)
`mode="partner-assisted"`: an authorised partner agent signs in (partner API key / OAuth), records the learner's consent (checkbox or voice clip), fills steps on their behalf, and submits via `POST /onboarding/partner-vouch`. Audit trail: agent id, timestamp, consent evidence reference.

---

## 4. `<db-career-gateway>` & `<db-employer-accommodations>` — Screen-by-Screen

**Career Gateway home.** Heading `<h2>Find work that fits you</h2>`. Profile pre-loaded from Module A (name, contact, language) — shown read-only with "Edit" (**3.3.7 Redundant Entry**: never retype).

**Private "Support I Need" filter.** `<fieldset><legend>Support I need at work</legend>` with checkboxes: screen-reader-friendly software · wheelchair-accessible office · remote / work from home · flexible hours · written or visual instructions instead of phone calls · sign-language / captions at meetings · quiet workspace. Copy: "Employers will **not** see what you choose here."
- Filtering is **server- or client-side without logging the selection against identity**; selections are not sent with applications.
- **Announcement (4.1.3):** after each change the always-mounted live region says "Showing 4 jobs matching your support preferences" (and "No jobs match — try removing one support" when 0).

**Job list.** Each job is an `<article>`; title is `<h3><a href>` with descriptive text ("Customer Support Agent — Acme Telecom, Addis Ababa") (**1.3.1, 2.4.4, 2.4.6**). Shows employer-declared accommodations as text+icon, location/remote, deadline in the user's calendar.

**Apply (same one-question-per-screen engine).** Steps: confirm details (pre-filled) → why are you interested? (text **or voice** with Review & Edit) → experience/skills → "Do you want to ask for a workplace adjustment?" (optional; **only if the candidate explicitly chooses** does a request go to the employer, and only the items they tick) → review → submit. Success event `db:job-applied`; if adjustment requested, `db:support-requested` (no medical data).

**Employer accommodation form (`<db-employer-accommodations>`).** Guided checklist: role details + which supports the workplace/role offers (the same vocabulary as the candidate filter), contact person, and how to request adjustments. Posted via `POST /career/jobs`.

---

## 5. Embedding into `alx-africa/Savanna-static-pages` — and Fixing Its Defects

The starter repo contains 3 frozen pages (`pages/homepage-v1-paced.html`, `homepage-v1-self-paced.html`, `concept-with-navigation.html`) using `application_alx.css`, `app.css`, `static-page.css`, `static-page.js`. `static-page.js` states it **deliberately adds no ARIA** so defects remain visible. Our demo must show a *conforming full page* (WCAG conformance requires full pages and non-interference), so we **patch the host** (in `apps/savanna-host-demo`, a copy — keep `static-page.js` behaviour intact and add `host-a11y-fixes.js` for behaviour changes).

**Embedding.** At the end of `<main id="content">` (or in a dedicated `<section aria-labelledby="onboarding-h">`):
```html
<section aria-labelledby="onboarding-h" class="mt-4">
  <h2 id="onboarding-h" class="fs-4">Complete your learner profile</h2>
  <db-onboarding-wizard api-url="http://localhost:3000/api/v1" partner-id="alx-demo" lang="en" theme="terracotta" mode="standalone"></db-onboarding-wizard>
</section>
<script type="module" src="../assets/js/db-widgets.v1.0.0.js"></script>
```
Verify Bootstrap/`app.css` do not restyle it (shadow isolation) and that `document.body.classList 'sidebar-collapsed'` toggling doesn't hide it.

### The 5 required fixes

**Defect 1 — Hamburger is a `<div>` with a click handler** (all pages).
```html
<!-- before -->
<div class="hamburger mb-0 p-2 color-primary" style="cursor:pointer;font-size:24px"><i class="fa-solid fa-fas fa-bars"></i></div>
<!-- after -->
<button type="button" class="hamburger mb-0 p-2 color-primary border-0 bg-transparent"
        aria-label="Toggle sidebar" aria-expanded="true" aria-controls="sidebar"
        style="cursor:pointer;font-size:24px;min-width:44px;min-height:44px">
  <i class="fa-solid fa-fas fa-bars" aria-hidden="true"></i>
</button>
```
`static-page.js` finds `.hamburger` and toggles `body.sidebar-collapsed`, so behaviour keeps working. In `host-a11y-fixes.js`, sync state: `new MutationObserver(() => btn.setAttribute('aria-expanded', String(!document.body.classList.contains('sidebar-collapsed')))).observe(document.body,{attributes:true,attributeFilter:['class']})` (and set it once on load).

**Defect 2 — Logo link has no accessible name** (`<a class="logo-container p-1" href="#"><div class="logo" style="background-image:…"></div></a>`).
```html
<a class="logo-container p-1" href="#" aria-label="ALX Savanna Home" rel="noreferrer"><div class="logo mx-auto" aria-hidden="true" style="…"></div></a>
```

**Defect 3 — Missing/incorrect headings.**
- `homepage-v1-self-paced.html`: first heading is `<h3>Course Progression</h3>`. Add `<h1 class="visually-hidden">Learner dashboard</h1>` (or visible) as the first child of `<main id="content">`, change section headings to `<h2>`, keep card titles `<h3>` (preserve classes like `fs-*`/`card-title` so visuals don't change).
- `homepage-v1-paced.html`: only `<h1>`s are inside modals. Add `<h1>` "Learner dashboard — WR 100" in `<main>`; card headers ("Continue where you left off", etc.) → `<h2>`, inner `h5` item titles → `h3`. Modal titles stay `h1` inside `<dialog>`/modal only if the modal is a separate context; prefer `h2`.
- Verify with NVDA `H` and axe `heading-order`, `page-has-heading-one`.

**Defect 4 — Sticky `#student-current-curriculum` bar can obscure focus (2.4.11).**
```css
/* host-a11y-fixes.css */
a, button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]) { scroll-margin-top: 6rem; scroll-margin-bottom: 6rem; }
@media (prefers-reduced-motion: reduce) { #student-current-curriculum { transition: none !important; } }
```
Plus in JS: on `focusin`, if the target's `getBoundingClientRect().top` is under the bar's height, `bar.classList.add('current-curriculum-hidden')` (the existing hidden class) or `target.scrollIntoView({block:'center'})`. Test with Tab from top to bottom.

**Defect 5 — Duplicate `#markdown-guide-modal` IDs (`homepage-v1-paced.html`).** Each `<template data-track-modals>` repeats the modal, and the live `#static-track-modals` copy duplicates it again when a week is swapped. Fix: remove `markdown-guide-modal` from every template, keep a single instance in `#static-track-modals` (or delete it; nothing links to it). Same for repeated `aria-labelledby="markdown-guide-modal-label"` ids. Validate no duplicate ids after swapping weeks (`document.querySelectorAll('[id]')` check in a test).

### Additional host defects we noticed (fix if time; each is an axe/NVDA finding)
- `.curriculum-switcher` trigger is a `div type="button" data-bs-toggle="dropdown"` → use a `<button>`.
- `.scroll-region__previous/next` are `div role="button"` with no `tabindex`/key handling → real `<button>`s.
- Invalid `<h>` element in callouts → `<p><strong>`/`<h3>`.
- Sidebar `<hr title="…">` carries meaning only in a tooltip → `<li role="separator">` + visible/visually-hidden group label; sidebar should be `<nav aria-label="Main">`; header `role="banner"`.
- Tooltip trigger `<span data-bs-toggle="tooltip">` isn't focusable → `<button>` with `aria-describedby`.
- Progress rings (SVG) lack text alternatives; `role="progressbar"` values exist but need `aria-label`.
- `lang` + `translate="no"` on Amharic content (`notranslate` body is fine, but don't block our `lang="am"`).
- Many links are `href="#"` with duplicate names ("Resume", "View") → add `aria-label`/visually-hidden context (2.4.4).

Re-run axe on all three pages after patching; record before/after counts in the README (judges like evidence).

---

## 6. Hard Requirements Checklist (traceable)

**Track 1:** 1.3.1, 1.3.5, 2.2.1, 3.3.1, 3.3.2, 3.3.7, 3.3.8 (+ 3.3.3 suggestions).
**Career Gateway:** 1.3.1, 2.4.4, 2.4.6, 4.1.3.
**Universal:** 1.1.1, 1.4.3, 1.4.10, 2.1.1, 2.4.3, 2.4.7, 2.4.11, 2.5.7, 2.5.8 (we enforce 44 px), 3.1.1, 3.1.2, 3.2.6, 4.1.2.
**Note on the supplied WCAG PDF:** the file in the project is **WCAG 2.0**; it lacks the 2.2 additions (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8) and still lists 4.1.1 Parsing (removed in 2.2). Use the WCAG 2.2 spec / the training deck as the authority.

**Bonus ("earns extra"):** partner-assisted registration with consent; Save & Resume via SMS link; "Refer me" partner voucher route.

---

## 7. Pass/Fail Accessibility Gate (self-check before every demo)

- [ ] A co-designer completes the **main user journey unaided** with NVDA, TalkBack, keyboard-only, 200–400% zoom, **and sound off**.
- [ ] axe DevTools: **0 serious, 0 critical** (standalone + Savanna host).
- [ ] Keyboard only; focus always visible and not obscured.
- [ ] Every control has name/role/value in the Chrome accessibility tree.
- [ ] NVDA pass of main journey; TalkBack pass inside a mobile WebView.
- [ ] Page and parts declare language (`en`, `am`).
- [ ] No time limits that lose data; no login puzzles; paste allowed.
- [ ] Reflow at 400%, no horizontal scroll.
- [ ] README + API docs describe keyboard and ARIA support.
- [ ] Videos (if any) have captions + transcript.
(Confirm against the organisers' official gate criteria.)

---

## 8. 100-Point Judging Rubric → What We Do

| Pts | Criterion | Our evidence |
|---|---|---|
| **30** | Works for the people it's for — co-designer score, unaided task completion, incorporating Saturday feedback | `CO_DESIGNER_LOG.md` with timestamps, issues found, fixes shipped Saturday night; before/after notes |
| **25** | Can be adopted — judge installs in < 1 h; all 3 doors | README quick-start (pnpm), one `<script>` + tag snippet, Swagger at `/api/docs`, Mock LMS launchpad for LTI in 10 s; all three doors working |
| **15** | Built for Ethiopia — Amharic, Ethiopic script, Ethiopian calendar (13 months/Pagume), phones 09/07/+251, cheap Android on 3G, offline-first | Bilingual UI, 3-select Ethiopian date, validators, Slow-3G/offline demo, small bundle |
| **15** | Quality, security & privacy — tests, minimal data, nothing leaves host without consent, no secret keys in browser | axe CI tests, DTO validation, scoped OAuth, consent gates, export/delete endpoints |
| **15** | Can be kept running — low cost, no paid-API lock-in, clear README | Browser Web Speech + mock/open adapters, SQLite default, simple deploy, maintainers' doc |

---

## 9. Saturday Co-Designer Testing Protocol

**Before (Friday night):** deploy over **HTTPS** (Web Speech and mic need a secure context) — e.g., Vercel/Netlify/Render for web + a tunnel (Cloudflare Tunnel/ngrok) or hosted API; smoke test on the real phone. Have the **mock/offline mode** ready in case venue Wi-Fi fails.

**Setup**
- *NVDA:* nvaccess.org; NVDA key = Insert (or Caps Lock on laptops); **Tools › Speech Viewer** on so observers can read what NVDA says on Zoom/projector. Test Chrome **and** Firefox.
- *TalkBack:* Settings › Accessibility › TalkBack on; Settings › "Display speech output" on; Hold both volume keys to toggle (once set up). Test in the **real host WebView**; debug via `chrome://inspect`.
- Have a no-mouse laptop, a 400%-zoom profile, a sound-off run.

**Session rules:** the co-designer drives; we **do not help** unless they ask (that's the "unaided" metric). One facilitator talks, one scribes, one watches Speech Viewer. Think-aloud encouraged. Record time-to-complete and each blocker (screenshot + NVDA output). Ask for a score (e.g., 1–5 ease) per task. Thank and compensate per organiser guidance; obtain consent for notes.

**Tasks to run:** (1) onboard with typed answers; (2) onboard using voice on two fields; (3) pick the "Refer me" route; (4) pause and resume via SMS link on another device; (5) switch to Amharic and Ethiopian calendar; (6) filter jobs and apply; (7) trigger a validation error and recover.

**`CO_DESIGNER_LOG.md` template**
```markdown
# Co-Designer Session Log
Date/time: ____  Location/device: ____  Co-designer (initials only, consent given: Y/N): ____
AT used: NVDA ver ___ / TalkBack ver ___ / keyboard / zoom ___% / sound off Y/N
| # | Task | Completed unaided? (Y/N) | Time | Blocker / quote | Severity (S1 blocker–S4) | Screenshot/clip | Owner | Fix commit | Retested |
|---|------|------|------|------|------|------|------|------|------|
Score (1–5 ease): ____   What worked best: ____   What to change first: ____
Follow-up fixes shipped before Sunday 16:30: ____
```
Fix all S1/S2 before Sunday; show the log in the demo.

---

## 10. Definition of Success (Sunday 16:30)

1. Standalone demo page + Savanna host page both pass the gate.
2. Three doors demonstrable in < 2 minutes each (tag, Swagger/PowerShell call, Mock LMS launch incl. a **tampered-token 401**).
3. Co-designer log with fixes applied.
4. README: install in < 1 hour, ARIA/keyboard support notes, privacy statement, known limitations (be honest about Amharic voice support).
5. Submission uploaded before the deadline — **freeze code 60 minutes earlier**.
