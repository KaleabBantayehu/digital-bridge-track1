# Conformance report — Track 1 onboarding wizard, Career Gateway and host pages

**Standard:** WCAG 2.2, Level A and AA (Team Technical Guide v2, §11 format)
**Scope:**
- the drop-in widgets `<db-signup>` / `<db-onboarding-wizard>` (Steps 1–7 and `mode="edit"` My Profile), `<db-career-gateway>` and `<db-employer-accommodations>`, including voice input, voice notes, voice control and read-aloud;
- the host pages that carry them: `pages/signup.html`, `pages/profile.html`, `pages/jobs.html`, `pages/homepage-v1-self-paced.html`, `pages/homepage-v1-paced.html`, and `demo/blank.html` (outside Savanna).

**Date:** 14 November 2026 · **Status:** draft. All evidence below is automated or scripted; it is not yet a conformance claim, because the co-designer sessions with assistive technology have not happened yet.

## How to read this report

- **Supports**: no known failure. Native HTML and ARIA patterns are used, and scripted checks plus axe-core found nothing.
  - Some criteria also need people with assistive technology to confirm them. The Notes column says when that has not happened yet.
- **Partly**: part of the criterion depends on something outside this scope, or we know of a gap.
- **Does not**: a known failure. None are recorded today.
- For "not applicable" criteria (there is no such content), we write **Supports** and give the reason in the notes, as is usual practice.

## Evidence

All browser runs use Playwright 1.65 driving installed Google Chrome (headless) with axe-core 4.14, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`. "0 violations" means 0 of **any** impact, not only serious/critical.

| What | How to re-run | Result |
| :--- | :--- | :--- |
| Judge audit of the **built** pages (`apps/web-components/dist`): signup, profile, jobs, blank host, both Savanna homepages; English and Amharic; 1280 × 800 and 320 × 640 | `pnpm -F @db/web-components build; node scripts/judge-audit.mjs` | **103 / 103 checks pass**, including **23 axe scans with 0 violations** |
| Header / sidebar overlap (`getBoundingClientRect`) against `<main>`, its `<h1>`, `<db-signup>`, `<db-career-gateway>`, `<db-employer-accommodations>` | same script | 0 px overlap on every page at both sizes; `.db-savanna-topbar` bottom ≤ `<main>` top |
| Reflow at 320 CSS px (= 1280 px at 400 %) | same script | No horizontal scroll on any page, in either language |
| Amharic voice fallback: speech-to-text missing, and speech-to-text failing with `language-not-supported` | same script (scripted recogniser + Chrome fake microphone) | Both automatically switch to recording a voice note with a plain explanation; focus moves to Stop recording; preview, keep, "Voice note saved" badge; the name step is completed with **nothing typed** |
| Hands-free voice control in Amharic (Alt + V; ታች, ምረጥ, ቀጥል, ተመለስ, መልስ, አቁም; English words also accepted) | same script | Moves focus, ticks the consent box, goes next and back, dictates into a field, uses the reviewed answer, stops; each command confirmed visibly and in the live region |
| Spoken numbers | same script + unit tests | "ዜሮ ዘጠኝ አንድ አንድ ሁለት ሶስት አራት አምስት ስድስት ሰባት" → `0911234567`; Ethiopic numerals ፩–፱; "abebe at gmail dot com" / "አት … ዶት" → `abebe@gmail.com` |
| Read aloud with no Amharic voice installed | same script | The caption box shows the words with the current phrase highlighted; a bundled cue plays; no 404s |
| Fidel helper | same script + unit tests | "abebe" → አበበ; vowel pills change the last letter |
| One `db-signup:step` per step change | same script | No duplicates (the element and the shell used to both send it) |
| Dev 2 harness: full English journey (all steps, privacy drawer, Career Gateway, apply dialog, employer form, edit mode) | `dev2-preview.html` suites | **103 / 103** (23 axe scans, 0 violations) |
| Dev 2 harness: full Amharic journey | same | **20 / 20** (15 axe scans, 0 violations) |
| Dev 1 13-point audit (build, bundle budget, built-page axe) | `node scripts/test-dev1.mjs` | **13 / 13** |
| Dev 3 API judge checks (unchanged backend; shared phone normaliser now also accepts Ethiopic numerals) | `scripts/test-api.ps1` against `node apps/api/dist/main` | **13 / 13** |
| Unit tests (persistence, API client, audio manifest, Fidel, spoken input, voice commands) | `pnpm -F @db/web-components test` | **27 / 27** |
| Bundle size | Vite build + `zlib.gzipSync` | `db-widgets.v1.0.0.js` 597 KB raw, **148.5 KB gzipped** (budget < 250 KB) |
| Load on Chrome's "Slow 3G" profile (400 ms RTT, 400 kbit/s), served gzipped as in production | CDP network emulation | Widget usable in **4.2 s** on `demo/blank.html`; **8.5 s** on `pages/signup.html`, most of it Savanna's own 1.3 MB stylesheet |

**Not yet tested (needs people and real devices):**
- NVDA with Chrome and Firefox, and TalkBack in an Android WebView;
- a physical microphone, including Amharic `am-ET` speech recognition on a real phone, and voice control in a noisy room;
- real Amharic text-to-speech voices;
- keyboard-only use by a person with the mouse unplugged (it has only been scripted);
- text-spacing override testing.

**Known limits, stated honestly:**
- The bundled read-aloud files are **tone cues** (a chime and one soft pip per step number), not recorded speech. The words are always shown in the caption box. Native-speaker recordings can replace the cues by editing `assets/audio/am/manifest.json`.
- Amharic voice commands need `am-ET` speech recognition. Where the device does not have it, voice control says so and listens for the English command words instead.
- The Amharic wording needs a native-speaker review.

## WCAG 2.2 A and AA

| WCAG 2.2 AA criterion | Supports / Partly / Does not | Notes |
| :--- | :--- | :--- |
| 1.1.1 Non-text Content (A) | Supports | Inline SVG icons are `aria-hidden="true" focusable="false"`. Icon-only buttons have translated `aria-label`s. Audio players are labelled by visible text. The Savanna logo image has `alt="ALX Savanna home"`. Visual step pills are `aria-hidden`; the same information is in the labelled `<progress>`. |
| 1.2.1 Audio-only and Video-only (A) | Supports | Voice notes are the learner's own recordings. Read-aloud cues are non-speech tones; the words they accompany are on screen. |
| 1.2.2 Captions (Prerecorded) (A) | Supports | Not applicable: no video. |
| 1.2.3 Audio Description or Media Alternative (A) | Supports | Not applicable: no video. |
| 1.2.4 Captions (Live) (AA) | Supports | Not applicable: no live media. |
| 1.2.5 Audio Description (Prerecorded) (AA) | Supports | Not applicable: no video. |
| 1.3.1 Info and Relationships (A) | Supports | Every field has a `<label for>` in the same shadow root. Groups use `<fieldset><legend>`. One `<h2>` per step. The host pages have one `<h1>` inside `<main>`, a `<header>` banner and a labelled `<nav>`. |
| 1.3.2 Meaningful Sequence (A) | Supports | DOM order matches visual order. The read-aloud caption box is rendered after all help buttons, so it never sits between them. |
| 1.3.3 Sensory Characteristics (A) | Supports | No instruction depends on shape, colour or position. |
| 1.3.4 Orientation (AA) | Supports | No orientation lock. One-column layout. |
| 1.3.5 Identify Input Purpose (AA) | Supports | `given-name`, `family-name`, `tel`, `email`, `one-time-code`, `bday-*` for the Gregorian date. |
| 1.4.1 Use of Color (A) | Supports | Errors use text, an icon, `aria-invalid` and the Error Summary. Toggles expose `aria-pressed`. The current read-aloud phrase is highlighted with a background **and** an outline. |
| 1.4.2 Audio Control (A) | Supports | Nothing plays automatically. Read aloud has Pause and Stop; cues are under 2 seconds; voice notes use native `<audio controls>`. |
| 1.4.3 Contrast (Minimum) (AA) | Supports | axe: 0 contrast failures in both languages. Computed: ink on parchment 16.4:1, terracotta `#9E3B24` on parchment 6.3:1, white on terracotta 6.8:1, lagoon badges 9.5:1. |
| 1.4.4 Resize Text (AA) | Supports | Sizes in rem (`:host` is 16 px); fluid layout. Browser text-only zoom not tested separately. |
| 1.4.5 Images of Text (AA) | Supports | No images of text (the Savanna logo is a logo). |
| 1.4.10 Reflow (AA) | Supports | 320 CSS px: no horizontal scroll on any page in either language (scripted). The top bar wraps and stops being sticky below 40 rem. |
| 1.4.11 Non-text Contrast (AA) | Supports | Input borders `stone-600` on white 7.6:1; focus ring 3 px `#7A2B18` (9.0:1 on parchment). |
| 1.4.12 Text Spacing (AA) | Supports | No fixed heights on text containers. Amharic uses line-height 1.7. Not yet tested with a text-spacing bookmarklet. |
| 1.4.13 Content on Hover or Focus (AA) | Supports | No tooltips or hover pop-ups. |
| 2.1.1 Keyboard (A) | Supports | Only native controls. Voice control is an extra way in, not a replacement. A manual unplugged-mouse run is still pending. |
| 2.1.2 No Keyboard Trap (A) | Supports | Native `<dialog>`, Esc closes and focus returns to the opener. |
| 2.1.4 Character Key Shortcuts (A) | Supports | The only shortcut is Alt + V (voice control on/off), which uses a modifier key. |
| 2.2.1 Timing Adjustable (A) | Supports | No session expiry; the draft saves on every change. A single voice note stops itself after 1 minute; it is kept and can be re-recorded. |
| 2.2.2 Pause, Stop, Hide (A) | Supports | The only moving content is the read-aloud highlight, which the learner starts and can Pause or Stop. No animations or transitions. |
| 2.3.1 Three Flashes or Below (A) | Supports | Nothing flashes. |
| 2.4.1 Bypass Blocks (A) | Supports | Every host page has a "Skip to main content" link to `<main id="main-content">`. |
| 2.4.2 Page Titled (A) | Supports | Each host page has a descriptive `<title>` (e.g. "My profile \| ALX Savanna"). A partner's own page title is the partner's responsibility. |
| 2.4.3 Focus Order (A) | Supports | Step changes focus the step `<h2>`, **but only after the learner acts**: restoring a saved draft on page load no longer moves focus or scrolls the host page (fixed in this release). |
| 2.4.4 Link Purpose (In Context) (A) | Supports | Job titles are `<h3><a>`. Apply buttons name the job, employer and city. Top-bar links have plain names; the current page has `aria-current="page"`. |
| 2.4.5 Multiple Ways (AA) | Supports | Top bar links every Track 1 page; Savanna's sidebar links My Profile. |
| 2.4.6 Headings and Labels (AA) | Supports | "Step N of 7: …"; edit mode "Edit my profile" / "የእኔን መገለጫ አስተካክል". |
| 2.4.7 Focus Visible (AA) | Supports | 3 px solid outline, 2 px offset, inside the widgets and on the host pages. |
| 2.4.11 Focus Not Obscured (Minimum) (AA) | Supports | The top bar is in normal flow (sticky only above 40 rem, 4 rem tall), and every focusable has 6 rem `scroll-margin`. On the Savanna homepages the fixed header no longer overlaps `<main>` on small screens (sidecar CSS fix). |
| 2.5.1 Pointer Gestures (A) | Supports | Single taps only. |
| 2.5.2 Pointer Cancellation (A) | Supports | Native click activation. |
| 2.5.3 Label in Name (A) | Supports | Accessible names contain the visible text (e.g. Fidel vowel pills: "Change the last letter to ቡ"). Voice-control commands act on the visible names. |
| 2.5.4 Motion Actuation (A) | Supports | No motion input. |
| 2.5.7 Dragging Movements (AA) | Supports | No dragging. Dates use three native `<select>`s. |
| 2.5.8 Target Size (Minimum) (AA) | Supports | Every target ≥ 44 × 44 CSS px, including top-bar links and the language switch. |
| 3.1.1 Language of Page (A) | Supports | Host pages are `<html lang="en">`; each widget root carries `lang="en"` or `lang="am"` and switches with the top-bar language buttons. |
| 3.1.2 Language of Parts (AA) | Supports | `<span lang="am">አማርኛ</span>` in the English top bar; `<kbd lang="en">Alt + V</kbd>` and the Latin input of the Fidel helper inside Amharic UI. Scripted check: no untagged English in Amharic mode. Native-speaker review still pending. |
| 3.2.1 On Focus (A) | Supports | Focus never changes context. |
| 3.2.2 On Input (A) | Supports | Changing language or ticking "Prefer not to say" updates the same screen and is announced. |
| 3.2.3 Consistent Navigation (AA) | Supports | The same top bar on signup, profile and jobs; Back / Continue always in the same place. |
| 3.2.4 Consistent Identification (AA) | Supports | Same functions, same labels on every step. |
| 3.2.6 Consistent Help (A) | Supports | Voice control, then the help cluster (Read aloud · Language · Simple words · Need help · My data), in the same order and place on every step. |
| 3.3.1 Error Identification (A) | Supports | `aria-invalid`, inline message via `aria-describedby`, focused `role="alert"` Error Summary. Voice control reads the Error Summary aloud when "next" fails. |
| 3.3.2 Labels or Instructions (A) | Supports | Visible labels, hints, "(required)" / "(optional)" in text. |
| 3.3.3 Error Suggestion (AA) | Supports | Examples in both languages, e.g. "Enter 10 digits, for example 0911 234 567". |
| 3.3.4 Error Prevention (Legal, Financial, Data) (AA) | Supports | Full summary before Finish. Voice answers, spoken numbers and Fidel suggestions always go through an editable review first. |
| 3.3.7 Redundant Entry (A) | Supports | The apply form pre-fills from onboarding, and a name voice note kept in onboarding also answers the apply form. |
| 3.3.8 Accessible Authentication (Minimum) (AA) | Supports | No passwords, CAPTCHA or puzzles; paste allowed everywhere. |
| 4.1.2 Name, Role, Value (A) | Supports | Native controls; `aria-pressed` on toggles (voice control, mic, recording, read aloud, Simple words, language). axe clean; NVDA and TalkBack pending. |
| 4.1.3 Status Messages (AA) | Supports | One always-mounted `role="status"` region per widget announces saves, offline state ("Saved on this phone. It will send when you are online."), job counts, voice states and voice-control confirmations. |

## Privacy notes relevant to Track 1 (not WCAG, but part of the gate)

- `db-signup:done` never carries support choices; `db-signup:support` is sent separately and only when the learner ticks "Share these choices with my learning provider". The element layer double-checks this before an event leaves the shadow root.
- No diagnosis and no medical document is requested anywhere. "Prefer not to say" is one tap, in the same group and the same size as every other choice.
- Voice notes stay on the device under `db:{partnerId}:{profileId}:voiceNotes`; "My data" exports them, "Delete my data" removes them and their length metadata. Job applications carry only a reference (`audioRef`).
- Voice control and dictation use the browser's Web Speech API. In Chrome that means audio goes to the browser vendor's speech service (Google), not to our API; we log no transcripts. This must be stated to learners before they turn the microphone on, and voice notes (MediaRecorder) are the on-device alternative.
- A kept voice note answers a field without writing placeholder text into it, so no invented "name" or "phone" ever reaches the profile, the events or the API.
