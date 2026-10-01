# Development and Testing

This runbook owns local setup, environment variables, commands, and verification. Contribution conventions are in the [agent guide](./agent-guide.md); cloud rollout is in [operations](./operations.md).

## Local setup

Use Node.js 22.12 or newer on the Node 22 line, or Node 24. Android CI uses Node 24 and JDK 21; the Capacitor CLI requires Node 22 or newer. See the [Android runbook](./android.md) for SDK setup and native builds.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Use the URL printed by Vite; the default is `http://localhost:5173`. Start visual review around 390px wide, then check tablet and desktop layouts. Vite reads browser configuration at startup/build time: restart the dev server after changing `.env.local`, and rebuild deployed assets after changing Vercel environment values.

The app can render without a configured backend, but authenticated AI events and cloud persistence require the connections below. Missing or failed AI configuration produces a visible error event.

## Environment variables

[.env.example](../.env.example) is the browser configuration template. Values beginning with `VITE_` are embedded in client code. Public Firebase web configuration and a Supabase publishable key belong there; private provider keys, service-account JSON, and service-role keys do not.

| Browser variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL used to construct the event endpoint |
| `VITE_SUPABASE_PUBLISHABLE` | Public gateway key sent as `apikey` |
| `VITE_SUPABASE_ANON_KEY` | Legacy fallback when the publishable variable is absent |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain, including popup sign-in support |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project containing Auth users and saves |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket from the registered web-app configuration |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID from the registered web-app configuration |
| `VITE_FIREBASE_APP_ID` | Registered Firebase web-app ID |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | Optional reCAPTCHA v3 site key; enables client App Check initialization |
| `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` | Optional local App Check debug token; `true` requests an SDK-generated token |
| `VITE_ENABLE_DEV_TOOLS` | Enables the debug sheet only when equal to `true` |

Copy all six Firebase web-app values from the same registered app. The actual initialization gate in [firebase.js](../src/config/firebase.js) checks a nonempty API key and project ID, and rejects an API key beginning with `PLACEHOLDER`. It does not validate all six fields; passing that gate alone does not establish a working Auth or App Check configuration.

Supabase server secrets, exact allowed origins, and provider setup are documented once in [operations](./operations.md#supabase-event-service).

## Required checks

Follow [_agents/workflows/test-app.md](../_agents/workflows/test-app.md) for substantive changes. With dependencies installed, run these gates in order:

```bash
npm run lint
npm test
npm run build
npm run check:docs
```

For browser-flow changes, also run:

```bash
npx playwright install chromium
CI=1 npm run test:e2e
```

The browser install is needed only when Playwright's matching Chromium version is missing. [playwright.config.js](../playwright.config.js) runs desktop Chrome and a Pixel 7 viewport in Chromium. It starts a separate Vite server on port 4173 with explicit test configuration and does not reuse an existing server. Set `PLAYWRIGHT_PORT` if that port is occupied. Each first-run test writes gameplay and assets screenshots under its `test-results/` directory.

| Command | Purpose |
|---|---|
| `npm run dev` | Vite development server |
| `npm run lint` | ESLint source checks |
| `npm run check:docs` | Local documentation links/headings, package commands, and architecture source paths |
| `npm test` | Vitest suite, including the edge contract tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run build` | Production compilation into `dist/` |
| `npm run preview` | Serve the built `dist/` app locally |
| `npm run test:e2e` | Playwright browser suite |

Check [package.json](../package.json) for the executable command definitions. Additional refactor-specific results are recorded in [refactor-plan.md](./refactor-plan.md).

## Test boundaries

| Area | Location | What it establishes |
|---|---|---|
| Mechanics | `src/tests/mechanics/` | Domain calculations, primarily against real exported implementations |
| Annual integration and simulated lives | `src/tests/`, `src/tests/playtest/` | Composition, sequential life behavior, and invariants |
| Components | `src/tests/*.test.jsx` | Rendering and handler wiring with mocked services |
| LLM client | `src/tests/llmService.test.js` | Projection, headers, deadlines, failure handling, and normalized responses |
| Edge contract | `supabase/functions/generate-event/*.test.ts` | Request, prompt, response, and quota migration invariants |
| Static content and markets | `src/tests/config.data.test.js`, `src/tests/market.test.js` | Catalog shapes, references, and market behavior |
| Saves and diagnostics | `src/tests/stateValidation.test.js`, `src/tests/diagnostics.test.js`, `src/tests/firestoreRules.test.js` | Warning/redaction behavior and save-field allowlist drift |
| Cloud lifecycle | `src/tests/gameState.cloud.test.jsx` | Real hook with mocked Firebase: delayed boot, replace/merge, linking, account switches, sign-out, and async action locking |
| Annual composition | `src/tests/annualSimulation.test.js` | Ordered random draws, immutable inputs, cash/principal accounting, and history order |
| Manual probe | `src/tests/llmProbe.test.js` | Actual script against a local HTTP fixture; required Origin and separate auth headers |
| Browser | `tests/e2e/` | Player flows with intercepted Firebase and event-proxy responses |

The default test setup mocks Firebase and the LLM client. Playwright verifies browser wiring and header separation with controlled responses. These checks do not verify a deployed Firebase provider, Firestore rules release, Supabase migration, or real OpenAI response; those need the [live verification flow](./operations.md#verify-a-deployment).

The [mechanics test inventory](../src/tests/mechanics/README.md) distinguishes adapters around production helpers from the remaining copied formulas. A passing copied formula test does not prove that its corresponding hook action or UI is wired correctly.

## Manual tools

### Authenticated event probe

[scripts/test-llm.js](../scripts/test-llm.js) calls the deployed proxy. Export `FIREBASE_ID_TOKEN`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE` in the local environment, then run:

```bash
FRONTEND_ORIGIN=http://localhost:5173 node scripts/test-llm.js
```

Use a fresh Firebase ID token from an authorized test session and an exact origin allowed by the server. A successful call consumes quota and can incur provider usage. The script also accepts `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the legacy `VITE_SUPABASE_ANON_KEY` aliases. `ACTION_CONTEXT` optionally supplies an activity description.

### Catalog seeding

[scripts/migrateData.js](../scripts/migrateData.js) is a manual Admin SDK write tool. It expects the ignored `scripts/serviceAccountKey.json` and a local `firebase-admin` installation. It is not required for everyday frontend development or tests. Read its destination collections and the [operations notes](./operations.md#catalog-seeding) before using it against a live project.

## Reviewing a refactor

Check both the exported contract and the visible behavior. Useful regression cases include a full year with investments/pets/relationships, tuition and taxed salary in the same tick, a delayed event request, a late initial save load, new-life replacement, and an account switch.

For UI extraction, verify sheet opening/back/close behavior, disabled actions, selected asset purchases, and mobile layout. Keep test results separate from deployment status, and record unresolved behavior as a follow-up rather than describing it as fixed.
