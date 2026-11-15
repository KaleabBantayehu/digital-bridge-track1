# Co-Designer Session Log

## 15 November 2026 — Human co-design and manual testing session

**Participants:** Track 1 Co-Designer and team accessibility testers (Kaleab,
Ermias, Dev 2, and Kidus). Testing took place on Windows 11 with keyboard-only
navigation, 125%–200% zoom, sound-off checks, and `Alt+V` voice navigation,
plus Android Mobile Chrome with touch and Voice Mode.

The group completed unaided: English and Amharic step-by-step onboarding, the
Ethiopian 13-month calendar, partner referral voucher (`VOUCH-...`), the
private client-side job accommodation filter, and Read-Aloud neural Amharic
speech with synchronized captions.

### Barriers found and fixed in the fix sprint

1. **Amharic email voice input:** English email addresses were transcribed
   inaccurately while the UI was `lang="am"`. Email fields now force ASCII /
   `en-US` recognition and support letter-by-letter spelling.
2. **Voice help and numbered shortcuts:** “help” re-read instructions rather
   than opening the Need help portal, and testers requested numbered control
   badges. The command now opens the modal and controls expose numbered
   shortcuts.
3. **ID and SMS code visibility:** Spoken ID card numbers now appear
   immediately in the input, and SMS verification codes have Read-Aloud output.
4. **Mobile voice and zoomed header:** Android Chrome could drop continuous
   recognition; sticky header links were underlined and the bar obscured help
   controls while scrolling. The top bar is static, links are styled without
   underlines, pills are bold, and color-blind-safe indicators and Ethiopian Sign
   Language visual-support guidance are provided. (Afaan Oromo and Tigrinya were
   requested but are not included yet: they need native translators.)
5. **Colour shades and sign language (second fix round, 15 Nov afternoon):**
   testers said colour-blind users cannot tell same-shade buttons apart, and
   asked for sign language support. Added a four-mode Colours menu (Warm,
   Colour-blind safe blue/gold, High contrast, Dark) with dashed hover borders
   and inverted, ringed, ✓-marked selected states; and a sign-language panel
   on every voice field: a sign-language video answer for an interpreter to
   read, number / letter / word cards, and an optional camera wave control.
   The request "understand sign language and convert it into words" is **not**
   met: the widget does not recognise signs. To retest with a Deaf co-designer.

Date/time: ____________________
Location/device: ____________________
Co-designer initials only (consent given: Y/N): ____________________

| Task # | Device & AT Used (NVDA / TalkBack / Keyboard / 200-400% Zoom / Sound Off) | Completed Unaided? (Y/N) | Time Taken | Ease Score (1-5) | Exact Co-Designer Quote / Observation | Severity (S1-S4) | Fix Commit / Status |
|---|---|---|---|---|---|---|---|
| 1. Onboard by typing (one question per screen, keyboard/screen reader) | | | | | | | |
| 2. Onboard using voice input with review & edit on two fields | | | | | | | |
| 3. Verify identity via “Refer me” partner voucher route (or Refugee ID) | | | | | | | |
| 4. Pause and resume onboarding via 24h SMS resume link | | | | | | | |
| 5. Switch to Amharic (`am`) and select a date in the 13-month Ethiopian calendar | | | | | | | |
| 6. Privately filter jobs by “Support I Need” and submit a job application | | | | | | | |
| 7. Trigger a validation error and recover using the bilingual Error Summary | | | | | | | |

## 15 November 2026 (afternoon) — Round 2: blind and voice-only testing

A teammate repeated the main task with voice control and a screen reader only (photos 1–4). Findings and what changed:

| # | Finding | What we changed |
|---|---|---|
| 1 | Voice control kept listening while a voice note or dictated answer was being recorded, and took the answer as commands. | Any field that takes the microphone (dictation, voice note, sign-language video, spoken date) now pauses voice control at once; the panel says "Voice navigation paused while you record your answer" and it resumes when the field is done. |
| 2 | With onboarding and the Career Gateway on one page, both numbered their items 1, 2, 3, so "3" pressed the wrong one. | Only one widget has voice control on at a time; numbers only appear in the active one; finishing onboarding hands voice control to the Career Gateway; "jobs" / "ስራ" and "sign up" / "ምዝገባ" switch between them. |
| 3 | Read aloud only read the step title; blind testers could not tell which number belonged to which field. | Read aloud, "repeat" and every step change now say the question, the hint and each field and choice with its number ("Item 6: First name, text box"), and highlight each one on the page as it is read. "guide" / "ምራኝ" walks through the text fields one by one and reads each answer back for a yes / no. |
| 4 | The date of birth lists could not be filled by speaking. | "Say your date of birth" on the date step ("15 Meskerem 1995", "መስከረም አስራ አምስት አንድ ሺህ ዘጠኝ መቶ ዘጠና አምስት", day-month-year numbers); and with a list focused, saying a value or a month name sets it ("item 3" still jumps). |
| 5 | Hyphen and underscore could not be said. | "hyphen", "dash", "ሰረዝ", "ጭረት" give "-"; "underscore", "አንደርስኮር" give "_" in e-mail, ID and name fields. |
| 6 | "down" started at the help bar buttons; "back" did not always go back. | "down" from outside the step goes straight to the first field; "back" presses the visible Back button and then reads the step. |
| 7 | There was no way to scroll by voice. | "scroll down" / "page down" / "ወደ ታች" and "scroll up" / "ወደ ላይ" move the page 360 px and say so. |
| 8 | Testers were not sure which item was active or how numbers worked. | The command list starts with the number commands; "item 3", "option 3", "ቁጥር 3" work; the active item gets a thick outline and a high-contrast "Active: item 3, …" callout, and "Item 3 selected: …" is spoken. |
| 9 | Header links could not be reached by voice. | The host top-bar links are numbered from 91 while voice control is on. |
| 10 | Testers could not tell whether the app was listening or still thinking. | A state pill shows Listening now / Hearing you / Processing your voice (about 1 second) / Speaking / Paused. |
| 11 | Commands failed in a noisy room. | Voice control looks at up to 5 recognition guesses and acts on the first real command or number; voice notes use noise suppression and echo cancellation; number keys 1–9 (and two-digit numbers) choose items when nothing is being typed. |
| 12 | (found while testing the fixes) A thicker border on hover moved buttons under the pointer, so some clicks were missed. | Hover keeps the same border width; the dashed border and an inset shadow show the hover instead. |

Not solved yet, to retest with the co-designer: a voice note started by voice cannot be stopped by voice (voice control is paused while recording, so the learner presses Enter on the focused Stop button or waits for the 1-minute limit); real noisy-room accuracy; Amharic recognition of month names on a real phone.

## Follow-up notes

- S1/S2 blockers fixed before the next co-designer round: Yes, all four barriers above.
- Retest date/time: 15 November 2026
- Facilitator/scribe: Track 1 team
