# Savanna accessibility fixes

The frozen Savanna pages are patched in place under `apps/savanna-host-demo`; the upstream
`static-page.js` remains unchanged. The real source page for the concept demo is
`pages/concept-with-navigation.html`.

## Required host defects

1. **Hamburger control:** Replaced the concept page's clickable `div` with a native button,
   named it “Toggle navigation sidebar,” and connected `aria-expanded` and `aria-controls` to
   `#sidebar`. The host accessibility script synchronizes the expanded state when Savanna toggles
   `body.sidebar-collapsed`. Enter and Space work through native button behavior.
2. **Logo link:** Added the accessible name “ALX Savanna Home” and hid its decorative logo artwork
   from assistive technology.
3. **Headings and landmarks:** Added a skip link to the main landmark on each learner page,
   placed one page-level `h1` inside `<main id="main-content">`, and corrected the concept page's
   heading levels without changing its visual heading sizes.
4. **Sticky header and focus:** Added six-rem scroll margins and a visible three-pixel focus outline
   for interactive controls. The host script hides the sticky curriculum bar when it would obscure
   a focused element. Reduced-motion preferences are respected.
5. **Duplicate IDs and ARIA references:** Kept one Markdown guide modal in the paced page,
   assigned unique IDs to repeated assessment controls/anchors, and supplied the missing
   curriculum-congratulations heading reference.

## Widget embedding

The standalone page and both learner homepages include `<db-onboarding-wizard>` and
`<db-career-gateway>` tags. The standalone page also includes `<db-employer-accommodations>`.
For one-line onboarding integration, load `db-widgets.v1.0.0.js` with
`data-auto-mount="true"` or `data-auto-mount="onboarding"`; optional `data-partner-id`,
`data-lang`, `data-theme`, and `data-api-url` values are copied to the generated widget.
All components mount into open Shadow DOM roots so host styles do not leak into the widgets.

## Verification status

| Page | Before host patches | After host patches |
|---|---:|---:|
| Paced homepage | 0 | 0 |
| Self-paced homepage | 1 serious link-distinction finding | 0 |
| Concept with navigation | 6 findings, including critical ARIA and serious focus, progress-name, contrast, and list findings | 0 |

The production build now includes the real widgets on all inspected pages. Headless Chromium with
axe-core reported zero violations on the paced homepage, self-paced homepage, concept page,
standalone demo, and external-partner demo. Each page was also checked for widget Shadow Roots; all
custom-element instances mounted without page errors.

The generated `db-widgets.v1.0.0.js` is 531.80 KB raw and 130.17 KB gzipped using `zlib.gzipSync`,
under the 250 KB gzip budget. The browser build copies it to `dist/assets/js/` for the Savanna
pages and demo pages.

## Integration verification

The onboarding and career elements mount Dev 2's `WizardShell` and `CareerGateway`, respectively;
the employer-accommodations element mounts `EmployerForm`. All receive the Dev 1 `ApiClient`-backed
service adapter. Remote job lists support the API's array response as well as an enveloped response,
and resume links use the `resume` query parameter consumed by the wizard.

The browser harness reported a 356 CSS-pixel viewport when asked for 320 pixels, so the exact
320-pixel reflow requirement still needs verification in a browser that honors that viewport.
The host controls are native buttons; keyboard-only testing with a physical keyboard remains
part of the manual gate.

The Amharic audio manifest and resolver are in place, but no recorded `.mp3` clips were present
in the repository when audited. The resolver returns `null` for missing clips so the caller can
retain the text-only prompt rather than claiming audio playback succeeded.
