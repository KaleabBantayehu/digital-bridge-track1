# ZERO-CONFLICT & ZERO-WAITING ENGINEERING PROTOCOL
---

## ??? ZERO-CONFLICT & ZERO-WAITING MODULE BRIDGES (MANDATORY)

To guarantee zero Git merge conflicts, zero duplicate work, and zero waiting between team members, the repository has been pre-wired with **Module Bridges**. Every human developer and AI coding agent MUST obey these strict file-ownership and interface boundaries:

### 1. Strict Folder & File Locks (Never Edit Outside Your Scope)
| Role & Branch | ALLOWED Paths (ONLY Edit These) | FORBIDDEN Paths (NEVER Edit These) |
| :--- | :--- | :--- |
| **Dev 1**<br>(`feat/dev1-shadow-host`) | ? `apps/web-components/src/index.ts`<br>? `apps/web-components/src/{base,elements,state,api,styles}/**`<br>? `apps/savanna-host-demo/{index.html,standalone.html,pages/**,assets/**}` | ? `apps/web-components/src/{wizard,fields,voice,tts,career,i18n}/**`<br>? `apps/savanna-host-demo/mock-lms/**`<br>? `apps/api/**` |
| **Dev 2**<br>(`feat/dev2-wizard-a11y`) | ? `apps/web-components/src/{wizard,fields,voice,tts,career,i18n}/**`<br>? `apps/web-components/dev2-preview.html` *(optional local harness)* | ? `apps/web-components/src/{index.ts,base/**,elements/**,state/**,api/**}`<br>? `apps/savanna-host-demo/**`<br>? `apps/api/**` |
| **Dev 3**<br>(`feat/dev3-api-v1`) | ? `apps/api/src/core-api.module.ts`<br>? `apps/api/src/{common,auth,onboarding,vouch,sms,career,privacy,seed}/**`<br>? `scripts/test-api.ps1` | ? `apps/api/src/main.ts` *(already imports CoreApiModule & LtiModule)*<br>? `apps/api/src/lti/**`<br>? `apps/web-components/**` & `e2e/**` |
| **Dev 4**<br>(`feat/dev4-lti-qa`) | ? `apps/api/src/lti/**` *(register all LTI controllers/services in `lti.module.ts`)*<br>? `apps/savanna-host-demo/mock-lms/**`<br>? `e2e/**`, `playwright.config.ts`, `.github/workflows/**` | ? `apps/api/src/main.ts` & `apps/api/src/core-api.module.ts`<br>? `apps/api/src/{onboarding,career,privacy}/**`<br>? `apps/web-components/**` |

### 2. Lockfile & Shared-Schema Freeze Rule
- **No Unannounced `pnpm add`:** All required packages (`react`, `zustand`, `idb-keyval`, `react-hook-form`, `zod`, `lucide-react`, `jose`, `sql.js`, `class-validator`, `@axe-core/playwright`) are already installed. Do NOT run `pnpm add` or modify `package.json` / `pnpm-lock.yaml` without Team Lead approval.
- **Additive-Only Shared Contracts:** Never rename or delete existing exports in `packages/shared-schemas/src/index.ts`, `WizardShellProps`, `CareerGatewayProps`, or `OnboardingState`.

### 3. Pre-Wired Decoupling Bridges (Zero Waiting)
1. **Dev 1 ? Dev 2 Bridge:**
   - Dev 1 mounts `<WizardShell />` (from `src/wizard/WizardShell.tsx`) and `<CareerGateway />` (from `src/career/CareerGateway.tsx`) inside the Shadow DOM custom elements without editing Dev 2's files.
   - Dev 2 imports `useOnboardingStore` from `../state/store` without editing Dev 1's store or custom element files. If Dev 2 needs a new store action, post `[CONTRACT]` in team chat and Dev 1 adds it in 2 minutes.
2. **Frontend (Dev 1 & 2) ? Backend (Dev 3) Bridge:**
   - The frontend uses `ApiClient` which automatically falls back to `MockApiService` (`localStorage`) whenever `api-url` is omitted, times out (> 4s), or returns a network error. Frontend never waits on Backend.
3. **Dev 3 ? Dev 4 NestJS Bridge:**
   - `apps/api/src/main.ts` is locked and already imports both `CoreApiModule` (`./core-api.module`) and `LtiModule` (`./lti/lti.module`). Dev 3 registers all REST modules inside `CoreApiModule`; Dev 4 registers all LTI 1.3 providers/controllers inside `LtiModule`.

### 4. Checkpoint PR & Squash-Merge Protocol
1. Every **45 minutes**, push your branch: `git push origin feat/devN-...`.
2. Before opening a Pull Request at each 2-hour checkpoint:
   - Run `pnpm build:schemas && pnpm typecheck && pnpm build` locally and ensure zero errors.
   - Run `git fetch origin main && git merge origin/main` on your branch and resolve any local issues before requesting review.
3. **Team Lead Squash-Merges PRs into `main`** (which triggers the automatic Vercel HTTPS production build), and all 4 developers immediately run `git pull origin main` into their working branches.
