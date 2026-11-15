# judge/ — re-runnable audit scripts

Read-only checks used for `JUDGE_REPORT.md`. Nothing here edits product code. Outputs land in `judge/out/`, screenshots in `judge/screens/`.

Set `JUDGE_REPO` to the checkout you want to judge (default: the parent folder). Build it first.

```powershell
pnpm install; pnpm build                      # in the checkout being judged
$env:JUDGE_REPO = "C:\path\to\checkout"        # optional
node judge/gate.mjs        # G2 axe on every surface/state (en + am), G5 reflow + 320 px screenshots, G6 sound off, G8 tasks 1,2,5,6,7
node judge/keyboard.mjs    # G3 keyboard-only onboarding + job application; G4 accessibility-tree proxy (en + am)
node judge/task3.mjs       # task 3: no document -> refer me through a partner -> finish
node judge/ethiopia.mjs    # i18n parity, calendar vs Intl (412 dates), phones, Slow 3G + 4x CPU, offline, 3 h clock, RTL, Amharic typography
node judge/personas.mjs    # forced colours, text resize, simple words + icons, reading level, Deaf options
node judge/static.mjs      # licences, audit, secrets (file:line only), README headings, Docker, tests

# These need the API running:  cd apps/api; node dist/main.js   (cold start can take ~3 min)
node judge/api.mjs         # README curls verbatim, docs, error envelope, auth/scopes, CORS, LTI routes
node judge/plugin.mjs      # globals, host-style changes, hostile CSS, first-load KB, what leaves the browser (API mode)
node judge/resume.mjs      # task 4: SMS resume in a fresh browser context with the real API
node judge/probe-sync.mjs  # why answers typed in the widget never reach the API (PATCH 422)

# Probes used to confirm root causes
node judge/probe-target.mjs    # axe target-size: which element covers the help buttons
node judge/probe-scroll.mjs    # does keyboard focus scroll into view (wait for Bootstrap smooth scroll)
node judge/probe-obscured.mjs  # elementFromPoint at the focused control's centre
```

Every script serves `apps/web-components/dist` with a tiny gzip static server (like any real host), drives headless
Chromium (falls back to installed Chrome), and scans with `@axe-core/playwright` tags `wcag2a, wcag2aa, wcag21a,
wcag21aa, wcag22aa`.

Proxy, not people: the accessibility tree stands in for NVDA/TalkBack, scripted keys stand in for a keyboard user, and a
stubbed `SpeechRecognition` stands in for a microphone. None of it replaces a co-designer.
