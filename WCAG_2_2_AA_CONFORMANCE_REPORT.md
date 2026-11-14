# WCAG 2.2 Level AA Conformance Report
**Project:** Digital Bridge Accessibility Hackathon 2026 — Track 1: Accessible Onboarding & Career Gateway Plug-In
**Date of report:** 14 November 2026 (to be finalised after the Sunday co-designer sessions)
**Standard:** Web Content Accessibility Guidelines (WCAG) 2.2, Level A and Level AA
**Scope:**
1. Drop-in Web Components: `<db-signup>` / `<db-onboarding-wizard>`, `<db-career-gateway>`, `<db-employer-accommodations>`
2. Host pages inside ALX Savanna (`pages/signup.html`, `pages/profile.html`, `pages/jobs.html`, `pages/homepage-v1-self-paced.html`, `pages/homepage-v1-paced.html`) and outside it (`demo/blank.html`)
3. Level 2 REST API (`/api/v1/...`) and Level 3 LTI 1.3 launch views

The criterion-by-criterion table, with notes and known limits, is in [`CONFORMANCE.md`](CONFORMANCE.md). This page summarises the gate.

## 1. Technologies relied upon
- HTML5 native controls: `<button>`, `<a href>`, `<label>`, `<fieldset>`, `<legend>`, `<select>`, `<dialog>`, `<progress>`, `<audio controls>`, `<kbd>`
- CSS (styles injected into each Shadow Root; rem sizing; reflow to 320 CSS px; ≥ 4.5:1 text contrast; ≥ 44 × 44 px targets)
- WAI-ARIA 1.2 (`role="status"` + `aria-live="polite"`, `role="alert"`, `aria-invalid`, `aria-describedby`, `aria-pressed`, `aria-expanded`, `aria-current`)
- ECMAScript 2022, Custom Elements v1 with open Shadow DOM
- Optional browser features, each with a fallback: Web Speech API (speech recognition and synthesis), MediaRecorder, Web Audio, `Intl.DateTimeFormat` with the Ethiopic calendar

## 2. Accessibility gate — status on 14 November 2026
| Gate check | Tool / assistive technology | Target | Status |
| :--- | :--- | :--- | :--- |
| **1. Co-designer completes the main task unaided** | NVDA, TalkBack, keyboard only, 200–400 % zoom, sound off | Onboarding and job application, unaided | **Pending** — sessions to be logged in `CO_DESIGNER_LOG.md` |
| **2. axe-core** | `@axe-core/playwright` 4.14 on the built pages, English and Amharic, 1280 px and 320 px | 0 critical, 0 serious | **Pass — 0 violations of any impact** (23 scans in `scripts/judge-audit.mjs`, 38 more in the Dev 2 journey suites, 4 in `scripts/test-dev1.mjs`) |
| **3. Keyboard only** | Scripted Tab / Enter / Space / Esc flows; Alt + V shortcut | Visible 3 px focus; no traps; focus never obscured | **Pass (scripted)** — manual unplugged-mouse run pending |
| **4. Sound off** | Read aloud with no installed voice | Words visible without sound | **Pass (scripted)** — caption box with highlighted phrase in every read-aloud mode |
| **5. Hands-free / no typing** | Voice control and voice notes in Amharic (scripted recogniser, Chrome fake microphone) | Complete a step without typing or pointing | **Pass (scripted)** — real microphone and real `am-ET` recognition pending |
| **6. Reflow and overlap** | `getBoundingClientRect` on every page at 1280 × 800 and 320 × 640 | No header over content; no horizontal scroll | **Pass** |
| **7. Desktop screen reader** | NVDA with Chrome and Firefox | Name, role, state; errors, saves and counts announced | **Pending** — not yet run |
| **8. Mobile screen reader** | TalkBack in an Android WebView | Swipe navigation, double-tap activation | **Pending** — not yet run |

An earlier version of this page marked gates 7 and 8 as passed. No NVDA or TalkBack session had been recorded, so they are now marked pending until a co-designer session produces evidence.

## 3. Key success criteria (summary)
| Criterion | Name (level) | How the plug-in meets it |
| :--- | :--- | :--- |
| **1.1.1** | Non-text Content (A) | Decorative inline SVG icons are `aria-hidden`; icon-only buttons have translated `aria-label`s; the logo image has alt text. |
| **1.3.1 & 3.3.2** | Info and Relationships / Labels (A) | Every input has a visible `<label for>` in the same Shadow Root; groups use `<fieldset><legend>`. |
| **1.3.5** | Identify Input Purpose (AA) | `given-name`, `family-name`, `tel`, `email`, `one-time-code`, `bday-*`. |
| **1.4.3 & 1.4.11** | Contrast (AA) | Ink `#1C1917` on parchment `#FAF7F2` 16.4:1; terracotta `#9E3B24` 6.3:1; white on terracotta 6.8:1; focus ring `#7A2B18` 9.0:1. |
| **1.4.10** | Reflow (AA) | Single column at 320 CSS px, no horizontal scroll, on every page in both languages. |
| **2.1.1, 2.1.2, 2.1.4** | Keyboard, No Trap, Shortcuts (A) | Native controls; native `<dialog>` with Esc; voice control is an addition, toggled with Alt + V (modifier shortcut). |
| **2.2.1 & 2.2.2** | Timing / Pause, Stop, Hide (A) | No time-outs; saved on every change; the read-aloud highlight has Pause and Stop. |
| **2.4.3** | Focus Order (A) | Focus moves to the step `<h2>` after the learner acts; never on page load. |
| **2.4.7 & 2.4.11** | Focus Visible / Not Obscured (AA) | 3 px outline, 2 px offset; 6 rem `scroll-margin`; the top bar never covers `<main>`. |
| **2.5.7 & 2.5.8** | Dragging / Target Size (AA) | No dragging (three native `<select>`s for the Ethiopian date); all targets ≥ 44 × 44 px. |
| **3.1.1 & 3.1.2** | Language (A/AA) | `lang="en"` / `lang="am"` on every widget root; mixed-language parts tagged. |
| **3.2.6** | Consistent Help (A) | Voice control and the help cluster keep the same order and place on every step. |
| **3.3.1 & 3.3.3** | Errors (A/AA) | `aria-invalid`, linked inline message, focused `role="alert"` Error Summary, bilingual examples. |
| **3.3.7** | Redundant Entry (A) | Career Gateway pre-fills from onboarding, including kept voice notes. |
| **3.3.8** | Accessible Authentication (AA) | No passwords or puzzles; paste allowed; LTI 1.3 single sign-on. |
| **4.1.2 & 4.1.3** | Name, Role, Value / Status Messages (A/AA) | Native controls with `aria-pressed`; one persistent `role="status"` region per widget for saves, offline state, job counts, voice states and voice-control confirmations. |

## 4. Known limitations
- Read-aloud fallback files are tone cues, not recorded Amharic speech; the words are always on screen. Native-speaker recordings can be dropped in through `assets/audio/am/manifest.json`.
- Amharic speech recognition is unavailable on many devices. Dictation then switches to a voice note; voice control switches to English command words and says so.
- Chrome's speech recognition sends audio to Google's speech service. Voice notes stay on the device.
- The Amharic wording needs a native-speaker review.
