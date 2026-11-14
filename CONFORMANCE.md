# Conformance report — Track 1 onboarding wizard and Career Gateway

**Standard:** WCAG 2.2, Level A and AA (Team Technical Guide v2, §11 format)
**Scope:** the Dev 2 UI layer in `apps/web-components/src/{wizard,fields,voice,tts,career,i18n}`:
- the onboarding wizard (`WizardShell`, Steps 1–7, plus `mode="edit"` My Profile);
- the Career Gateway (job list, private support filter, apply dialog, employer form);
- the Privacy drawer.

**Date:** 14 November 2026 · **Status:** draft, automated evidence only, not yet a conformance claim.

## How to read this report

- **Supports**: no known failure. Native HTML and ARIA patterns are used, and scripted checks plus axe-core found nothing.
  - Some criteria also need people with assistive technology to confirm them. The Notes column says when that has not happened yet.
- **Partly**: part of the criterion depends on something outside this scope (usually the host page), or we know of a gap.
- **Does not**: a known failure. None are recorded today.
- For "not applicable" criteria (there is no such content), we write **Supports** and give the reason in the notes, as is usual practice.

## Evidence so far

| What | Tool | Result |
| :--- | :--- | :--- |
| Full English journey: Steps 1–7, finish, Privacy drawer, Career Gateway, apply dialog, employer form, edit mode | Playwright 1.65 driving installed Google Chrome (headless) + axe-core 4.14 (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`) | **103 / 103 checks pass**, including **23 axe scans with 0 violations of any impact** |
| Full Amharic journey (`lang="am"`): every step, voice-note preview, Prefer not to say, review, finished, edit mode, Privacy drawer, Career Gateway | Same | **20 / 20 checks pass**, including **15 axe scans with 0 violations** |
| The 57 checks from the first release | Same | All still pass (they are part of the 103 above) |
| Reflow at 320 CSS px (= 1280 px at 400 %) | Same | No horizontal scroll in English or Amharic; every button, link, select and text input is at least 44 × 44 px |
| Voice-note recording | Chrome fake-microphone flags | Record, stop, preview, keep, store and remove all work. A kept note lets the learner continue without typing. |
| Speech recognition and read-back | Injected fake `SpeechRecognition` | The transcript always goes to an editable review box. Nothing reaches the field until "Use this answer". Read-back either speaks or shows a visible note. |

**Not yet tested (awaiting live co-designer sessions):**
- NVDA with Chrome and Firefox;
- TalkBack in an Android WebView;
- a physical microphone, including Amharic `am-ET` recognition on a real phone;
- real Amharic text-to-speech voices;
- keyboard-only testing by a person with the mouse unplugged (it has only been scripted);
- text-spacing override testing.

Also note that all of the above ran in the Dev 2 harness (`apps/web-components/dev2-preview.html`). That harness mounts the components in open shadow roots, just as the production custom elements will. They have **not** yet been checked inside Dev 1's production custom elements or the Savanna host pages.

## WCAG 2.2 A and AA

| WCAG 2.2 AA criterion | Supports / Partly / Does not | Notes |
| :--- | :--- | :--- |
| 1.1.1 Non-text Content (A) | Supports | Inline SVG icons are `aria-hidden="true" focusable="false"`. The icon-only Close button has a translated `aria-label`. Voice-note `<audio>` players are labelled by visible text through `aria-labelledby`. |
| 1.2.1 Audio-only and Video-only (A) | Supports | We publish no media. Voice notes are the learner's own recordings, played back to them. A text box always sits next to each note, so a transcript is possible. |
| 1.2.2 Captions (Prerecorded) (A) | Supports | Not applicable: no video. |
| 1.2.3 Audio Description or Media Alternative (A) | Supports | Not applicable: no video. |
| 1.2.4 Captions (Live) (AA) | Supports | Not applicable: no live media. |
| 1.2.5 Audio Description (Prerecorded) (AA) | Supports | Not applicable: no video. |
| 1.3.1 Info and Relationships (A) | Supports | Every field has a `<label for>`. Radio and checkbox groups use `<fieldset><legend>`. Each step has one `<h2>`, sections use `<h3>`, the summary uses `<dl>` and lists use `<ul>`. All ids resolve inside the same shadow root. |
| 1.3.2 Meaningful Sequence (A) | Supports | DOM order matches visual order. The Error Summary sits directly after the step heading. |
| 1.3.3 Sensory Characteristics (A) | Supports | No instruction depends on shape, colour or position. |
| 1.3.4 Orientation (AA) | Supports | No orientation lock. One-column layout. |
| 1.3.5 Identify Input Purpose (AA) | Supports | Fields use `given-name`, `family-name`, `tel`, `email`, `one-time-code`, and `bday-*` for the Gregorian date. The Ethiopian calendar selects have no token, because no Ethiopian-calendar autocomplete token exists. |
| 1.4.1 Use of Color (A) | Supports | Errors use text, an icon, `aria-invalid` and the Error Summary. Pressed toggles also expose `aria-pressed`. |
| 1.4.2 Audio Control (A) | Supports | Nothing plays automatically. Read aloud and read-back have Stop. Voice notes use native `<audio controls>`. |
| 1.4.3 Contrast (Minimum) (AA) | Supports | axe found 0 contrast failures in English and Amharic, including pressed toggles. Terracotta `#9E3B24` on parchment `#FAF6F0` is ≥ 4.5:1. |
| 1.4.4 Resize Text (AA) | Supports | Sizes are in rem (`:host` is 16 px) and the layout is fluid. Verified at 320 CSS px; browser text-only zoom has not been tested separately. |
| 1.4.5 Images of Text (AA) | Supports | No images of text. |
| 1.4.10 Reflow (AA) | Supports | At 320 CSS px there is no horizontal scroll in either language (scripted check). |
| 1.4.11 Non-text Contrast (AA) | Supports | Input borders are `stone-600` on white. The focus ring is a 3 px terracotta outline. Checked against the colour tokens; axe covers this only partly. |
| 1.4.12 Text Spacing (AA) | Supports | No fixed heights on text containers. Amharic uses line-height 1.7 (Guide v2 §9). Not yet tested with a text-spacing bookmarklet. |
| 1.4.13 Content on Hover or Focus (AA) | Supports | No tooltips or hover pop-ups. |
| 2.1.1 Keyboard (A) | Supports | Only native buttons, links, inputs, selects, `<dialog>` and `<audio controls>`. Scripted keyboard flows pass; a manual unplugged-mouse run with a co-designer is still pending. |
| 2.1.2 No Keyboard Trap (A) | Supports | The native `<dialog>` closes on Esc and focus returns to the opener (scripted check). |
| 2.1.4 Character Key Shortcuts (A) | Supports | No single-key shortcuts. |
| 2.2.1 Timing Adjustable (A) | Supports | No session expiry, and the draft saves on every change. A single voice note stops itself after 1 minute (to keep it small). The recording is kept, the learner can record again, and typing is always available. |
| 2.2.2 Pause, Stop, Hide (A) | Supports | No moving, blinking or auto-updating content; the UI has no animations or transitions at all. |
| 2.3.1 Three Flashes or Below (A) | Supports | Nothing flashes. |
| 2.4.1 Bypass Blocks (A) | Partly | The widget is one labelled `<section>` with headings for screen-reader navigation. A skip link belongs to the host page (Dev 1 / Savanna) and is outside this scope. |
| 2.4.2 Page Titled (A) | Partly | A component cannot set the page `<title>`. `standalone.html` and `profile.html` belong to Dev 1. |
| 2.4.3 Focus Order (A) | Supports | On each step change, focus moves to the step `<h2>`. A failed submit focuses the Error Summary, and each summary link focuses its field. After Keep or Remove on a voice note, focus goes to the record button. |
| 2.4.4 Link Purpose (In Context) (A) | Supports | Job titles are `<h3><a>`. Apply buttons name the job, employer and city. |
| 2.4.5 Multiple Ways (AA) | Supports | Not applicable at component level: the widget is a single process. |
| 2.4.6 Headings and Labels (AA) | Supports | Headings read "Step N of 7: …". In edit mode the heading is "Edit my profile" / "የእኔን መገለጫ አስተካክል". |
| 2.4.7 Focus Visible (AA) | Supports | 3 px `:focus-visible` outline with a 2 px offset; `outline: none` is never used without a replacement. |
| 2.4.11 Focus Not Obscured (Minimum) (AA) | Supports | Every focusable has `scroll-margin` of 6 rem and we have no sticky bars. The Savanna host's sticky header still needs checking (Dev 1). |
| 2.5.1 Pointer Gestures (A) | Supports | Single taps only. |
| 2.5.2 Pointer Cancellation (A) | Supports | Native click activation, which fires on release. |
| 2.5.3 Label in Name (A) | Supports | Accessible names start with the visible text, e.g. "Edit" + hidden section name. |
| 2.5.4 Motion Actuation (A) | Supports | No motion input. |
| 2.5.7 Dragging Movements (AA) | Supports | No dragging. The date uses three native `<select>`s. |
| 2.5.8 Target Size (Minimum) (AA) | Supports | Every target is at least 44 × 44 CSS px at 320 px width (scripted check), above the 24 px AA minimum. |
| 3.1.1 Language of Page (A) | Partly | The widget root carries `lang="en"` or `lang="am"`. The host page's `<html lang>` belongs to Dev 1 / Savanna. |
| 3.1.2 Language of Parts (AA) | Supports | English names inside Amharic UI (partner organisations, free-text job titles) get `lang="en"`. A scripted check finds no untagged English text in Amharic mode. The Amharic wording still needs a native-speaker review. |
| 3.2.1 On Focus (A) | Supports | Focus never triggers a change of context. |
| 3.2.2 On Input (A) | Supports | Ticking "Prefer not to say" clears the specific needs on the same screen and announces it politely. That change is not a change of context. |
| 3.2.3 Consistent Navigation (AA) | Supports | Back / Continue are always in the same place. |
| 3.2.4 Consistent Identification (AA) | Supports | The same functions keep the same labels on every step. |
| 3.2.6 Consistent Help (A) | Supports | The help cluster (Read aloud · Language · Simple words · Need help · My data) has the same DOM order and position on every step. |
| 3.3.1 Error Identification (A) | Supports | `aria-invalid`, an inline message linked through `aria-describedby` (the hint is kept) and a focused `role="alert"` Error Summary with jump links. |
| 3.3.2 Labels or Instructions (A) | Supports | Visible labels, hint text, and "(required)" / "(optional)" written out in text. |
| 3.3.3 Error Suggestion (AA) | Supports | Messages give an example, e.g. "Enter 10 digits, for example 0911 234 567", in English and Amharic. |
| 3.3.4 Error Prevention (Legal, Financial, Data) (AA) | Supports | A full summary with an Edit button per section comes before Finish. Voice answers always go through review and are never submitted automatically. |
| 3.3.7 Redundant Entry (A) | Supports | Career filters and the apply form pre-fill from onboarding. Edit mode reuses the saved answers. |
| 3.3.8 Accessible Authentication (Minimum) (AA) | Supports | No passwords, CAPTCHA or puzzles. Pasting is allowed everywhere. Sign-in is through LTI SSO or partner referral. |
| 4.1.2 Name, Role, Value (A) | Supports | Native controls, with `aria-pressed` on mic, recording and toggle buttons. axe is clean; NVDA and TalkBack are still pending. |
| 4.1.3 Status Messages (AA) | Supports | One always-mounted `role="status"` region announces saves, job counts, listening, recording and kept states, read-back, and "Prefer not to say". Scripted checks confirm the text; real speech output under NVDA and TalkBack is still pending. |

## Privacy notes relevant to Track 1 (not WCAG, but part of the gate)

- Support choices are never inside `db-signup:done` or `db-onboarding-completed` unless the learner shared them.
  - `db-signup:support` is a separate event, sent only when the learner ticks "Share these choices with my learning provider".
  - Scripted checks cover both the "not shared" and "shared" cases.
- No diagnosis and no medical document is requested anywhere (scripted check on the support step).
- "Prefer not to say" is one tap. It is in the same group and is the same size as every other choice.
- Voice notes stay on the device, under `db:{partnerId}:{profileId}:voiceNotes`.
  - "My data" exports them.
  - "Delete my data" removes them.
  - Job applications carry only a reference (`audioRef`), not the audio itself.
