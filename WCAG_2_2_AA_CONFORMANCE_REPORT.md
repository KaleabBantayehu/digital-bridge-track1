# WCAG 2.2 Level AA Conformance Report
**Project:** Digital Bridge Accessibility Hackathon 2026 ? Track 1: Accessible Onboarding & Career Gateway Plug-In
**Date of Claim:** 15 November 2026
**Standard:** Web Content Accessibility Guidelines (WCAG) 2.2 (ISO/IEC 40500:2025), Level A and Level AA
**Target URI / Scope:**
1. Drop-in Web Component Plug-Ins (`<db-onboarding-wizard>`, `<db-career-gateway>`, `<db-employer-accommodations>`)
2. ALX Savanna Host Integration Pages (`pages/homepage-v1-self-paced.html`, `pages/homepage-v1-paced.html`, `standalone.html`)
3. Level 2 REST API (`/api/v1/...`) & Level 3 LTI 1.3 Launch Views

## 1. Technologies Relied Upon
- HTML5 (Native Semantic Controls: `<button>`, `<label>`, `<fieldset>`, `<legend>`, `<select>`, `<dialog>`, `<progress>`)
- CSS3 (Shadow DOM encapsulated styles, fluid 400% zoom reflow, >= 4.5:1 contrast, 44x44px minimum touch targets)
- WAI-ARIA 1.2 (`aria-live="polite"`, `role="status"`, `role="alert"`, `aria-invalid`, `aria-describedby`, `lang="en"`, `lang="am"`)
- ECMAScript 2022 / Custom Elements v1 (Web Components with Shadow DOM)

## 2. Accessibility Gate Verification Summary
| Gate Check | Tool / Assistive Tech Used | Target | Status / Result |
| :--- | :--- | :--- | :--- |
| **1. Co-Designer Unaided Completion** | NVDA, TalkBack, Keyboard-Only, 200%-400% Zoom, Sound Off | Complete main onboarding & career flow unaided | Tracked in `CO_DESIGNER_LOG.md` |
| **2. Automated axe-core Scan** | `@axe-core/playwright` & axe DevTools Chrome Extension | **0 Critical, 0 Serious issues** | Verified on Standalone & Savanna Host |
| **3. Keyboard-Only Navigation** | Unplugged mouse (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Esc`) | Visible 3px focus ring; zero traps; focus never obscured | PASS (WCAG 2.1.1, 2.1.2, 2.4.7, 2.4.11) |
| **4. Desktop Screen Reader** | NVDA (Windows) with Speech Viewer on Chrome & Firefox | Every control exposes Name, Role, State; errors & counts announced | PASS (WCAG 1.3.1, 3.3.1, 4.1.2, 4.1.3) |
| **5. Mobile Screen Reader** | Android TalkBack inside mobile WebView (`chrome://inspect`) | Swipe navigation, double-tap activation, 44x44px targets | PASS (WCAG 2.5.8, 4.1.2) |

## 3. Track 1 & Career Gateway Success Criteria Mapping (WCAG 2.2 Level A & AA)
| Criterion | Name (Level) | How Our Plug-In Meets It |
| :--- | :--- | :--- |
| **1.1.1** | Non-text Content (A) | All inline SVG icons have `aria-hidden="true"`; functional icon buttons have explicit bilingual `aria-label`s. |
| **1.3.1 & 3.3.2** | Info & Relationships / Labels (A) | Every input has an explicit `<label for>` inside the same Shadow Root; radio/checkbox sets use `<fieldset><legend>`. |
| **1.3.5** | Identify Input Purpose (AA) | Standard `autocomplete` tokens (`given-name`, `family-name`, `tel`, `email`, `one-time-code`) on all user fields. |
| **1.4.3 & 1.4.11** | Contrast Minimum & Non-text (AA) | Earthy terracotta (`#9E3B24`) on parchment (`#FAF6F0`) and ink (`#1C1917`) exceed 4.5:1; high-contrast theme exceeds 7:1. |
| **1.4.10** | Reflow (AA) | At 400% zoom (320 CSS px width), all steps and job cards reflow into a single vertical column with zero horizontal scroll. |
| **2.1.1 & 2.1.2** | Keyboard & No Trap (A) | 100% keyboard operable; modals use native `<dialog>.showModal()` with `Esc` close and focus restoration. |
| **2.2.1** | Timing Adjustable (A) | Zero session time-outs; every input auto-saves to `IndexedDB`/`localStorage` within 300ms and supports SMS link resume. |
| **2.4.3 & 2.4.6** | Focus Order & Headings (A/AA) | Step changes move focus to `<h2 tabindex="-1">`; job titles use semantic `<h3>` headings. |
| **2.4.4** | Link Purpose in Context (A) | Job links include role title, employer, and location; Savanna host logo and action links have explicit `aria-label`s. |
| **2.4.7 & 2.4.11** | Focus Visible & Not Obscured (AA) | `3px solid` focus ring with `scroll-margin-top: 6rem` so sticky Savanna headers never obscure focused controls. |
| **2.5.7 & 2.5.8** | Dragging & Target Size (AA) | Zero drag-only controls (3 native `<select>`s for Ethiopian dates); all touch targets are `>= 44x44 CSS px`. |
| **3.1.1 & 3.1.2** | Language of Page & Parts (A/AA) | Root container sets `lang="en"` or `lang="am"`; mixed Amharic phrases are wrapped in `<span lang="am">`. |
| **3.2.6** | Consistent Help (A) | The Help Cluster (Read Aloud, Language Toggle, Simple Words, Need Help) stays in the exact same DOM order on every step. |
| **3.3.1 & 3.3.3** | Error Identification & Suggestion (A/AA) | Invalid fields set `aria-invalid="true"`, link concrete bilingual examples via `aria-describedby`, and focus the top `role="alert"` Error Summary. |
| **3.3.7** | Redundant Entry (A) | Learner profile data from Onboarding automatically pre-fills the Career Gateway application flow. |
| **3.3.8** | Accessible Authentication (AA) | No cognitive/memory puzzles; paste is allowed on all phone/OTP/voucher inputs; LTI 1.3 provides zero-password SSO. |
| **4.1.2 & 4.1.3** | Name, Role, Value & Status Messages (A/AA) | Native HTML controls + persistent `role="status" aria-live="polite"` region announcing saves, voice capture, and filtered job counts. |
