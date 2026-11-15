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

## Follow-up notes

- S1/S2 blockers fixed before the next co-designer round: Yes, all four barriers above.
- Retest date/time: 15 November 2026
- Facilitator/scribe: Track 1 team
