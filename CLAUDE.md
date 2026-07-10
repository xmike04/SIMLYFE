# SIMLYFE Project Guide

## Project Overview

SIMLYFE is a mobile-first browser life simulator built with React 19 and Vite. Players create a character and age one year at a time while careers, relationships, education, finances, assets, pets, health, and generated events evolve. The interface uses dark glassmorphism. Firebase anonymous authentication identifies proxy callers and enables optional Firestore saves; AI events travel through an authenticated Supabase Edge Function and default to OpenAI `gpt-4.1-nano`.

The portfolio overview is in [`docs/case-study.md`](./docs/case-study.md). This file is the architecture and implementation reference for coding agents.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 functional components and hooks |
| Bundler | Vite 8 with the React/Oxc plugin |
| Styling | Pure CSS and CSS custom properties; no Tailwind or UI library |
| State | Custom `useGameState()` hook; no Redux/Zustand |
| Identity and saves | Firebase anonymous Auth and Firestore |
| Event proxy | Supabase Edge Function in `supabase/functions/generate-event/` |
| LLM client | Authenticated browser `fetch` with a typed, bounded payload |
| LLM model | Server-owned `gpt-4.1-nano` default and strict Structured Outputs |
| Tests | Vitest, Testing Library, Playwright |
| Hosting | Vercel |

## Directory Map

```text
SIMLYFE/
  src/
    components/
      ActionSheet.jsx
      CharacterCreation.jsx
      MainGame.jsx
      EventModal.jsx
      DeathScreen.jsx
      SplashScreen.jsx
      sheets/                    # Extracted gameplay panels
        JobSheet.jsx
        AssetsSheet.jsx
        RelationshipsSheet.jsx
        DoctorSheet.jsx
        LotterySheet.jsx
        CasinoSheet.jsx
        DatingSheet.jsx
        WillsSheet.jsx
        PetsSheet.jsx
    config/
      activities.js
      specialCareers.js
      wealthTiers.js
      assetCatalog.js
      storeCatalog.js
      investmentMarket.js
      petCatalog.js
      cityData.js
      firebase.js               # Lazy-imported Firebase initialization
    engine/
      gameState.js              # All authoritative game state and mechanics
      llmService.js             # Authenticated, typed proxy client
      firebaseToken.js          # Lazy Firebase-to-LLM token-provider bridge
      diagnostics.js            # Strict operational diagnostic allowlists
      stateValidation.js        # Observe-only hydrated-save validation
      events.json
      careers.json
    tests/
  supabase/
    config.toml
    functions/generate-event/
      index.ts                  # Auth, CORS, quota, prompt, provider call
      contract.ts               # Request/provider schemas and normalization
      contract.test.ts
      quota-migration.test.ts
    migrations/
  tests/e2e/first-run.spec.js
  scripts/
    migrateData.js
    test-llm.js
  docs/
    case-study.md
    screenshots/
  public/
    favicon.svg
    icons.svg
    manifest.json
    og-image.png
  playwright.config.js
  vite.config.js
  eslint.config.js
```

## Architecture

### State Management

All shared game state and authoritative mutations live in `src/engine/gameState.js` through `useGameState()`. Components are presentational or orchestration surfaces and receive state plus handlers from the hook. Do not introduce a second application-state owner.

Important state includes:

- `character`, `age`, `stats`, `flags`, `bank`, and `isDead`
- `career`, `careerMeta`, `networking`, `education`, and `economyCycle`
- `relationships`, `pets`, `belongings`, and `properties`
- `history`, `currentEvent`, `activitiesThisYear`, `isAging`, and `narrativeMode`

### Component Routing

`App.jsx` renders one of three views:

1. No character: `CharacterCreation`
2. Dead character: `DeathScreen`
3. Active life: `MainGame`, plus `EventModal` when `currentEvent` exists

Gameplay panels belong in `src/components/sheets/`; do not add large inline panels back to `MainGame.jsx`.

### Event System

`src/engine/llmService.js` sends only `{ state, actionContext, narrativeMode }` to the configured Supabase function. The state projection normalizes Unicode and numbers, caps text and arrays, includes at most five recent history entries/relationships/pets, and rejects a serialized body above 16 KiB. Caller-controlled messages, prompts, models, temperature, and token ceilings are not part of the contract.

Firebase is loaded dynamically by `gameState.js`. After anonymous sign-in, `firebaseToken.js` exposes only a token-provider callback to `llmService.js`; this avoids statically pulling the Firebase SDK into the entry bundle. The Firebase ID token is the bearer credential. The Supabase publishable or legacy anon key is sent only as the `apikey` gateway header.

The client applies one 20-second budget across token retrieval and the proxy request. It validates the normalized `{ event, meta }` response again before presenting it. Authentication, timeout, network, rate-limit, provider, and validation failures become sanitized player-visible error events. Do not log prompts, action context, player state, names, history, credentials, raw provider responses, or raw exception messages. Do not silently substitute `events.json` when an LLM call fails.

The edge function owns:

- exact-origin CORS and POST/OPTIONS method enforcement
- Firebase RS256 signature, audience, issuer, time, and subject verification
- streamed body size and body/whole-operation deadlines
- typed input validation before quota consumption
- HMAC-pseudonymous per-user quota keys
- a durable Postgres token bucket and project-wide circuit breaker
- prompt, model, temperature, strict output schema, and token ceiling
- OpenAI timeout/cancellation and normalized response metadata

The server prompt treats all supplied JSON as untrusted data. Event descriptions are limited to 35 words; responses contain one to three choices. The model still proposes bounded numeric effects in this migration phase. That is legacy behavior: permanent consequence ownership should move into a deterministic consequence engine in a later phase.

### Firebase Saves

When all six Firebase browser variables exist, `gameState.js` signs in anonymously and merges state into `users/{uid}/saves/currentLife`. Firebase remains optional for the basic UI, but anonymous Auth is required for generated AI events. Missing configuration produces skipped save diagnostics and an authentication error event for generation.

Hydration validation is observe-only: it reports safe field-level warnings but preserves existing save compatibility. Current Firestore writes are partial merges and are not revisioned or transactional across a full age transition; see Known Issues.

### Diagnostics

`diagnostics.js` uses event-specific allowlists. Save/load records contain operation ID, status, elapsed time, safe field names, and an allowlisted error class. LLM records may contain request ID, model, HTTP status, elapsed time, normalized token counts, and a safe error code. Diagnostics must never change gameplay or throw back into the caller.

## Key Conventions

### Code Style

- React functional components and hooks only.
- Keep shared state and mechanics in `useGameState()` or extracted pure helpers.
- Use JavaScript/JSX; do not start an incidental TypeScript migration.
- Use CSS variables from `src/index.css` and follow the existing glassmorphism style.
- Do not add Tailwind, a component library, or another state library.
- Keep static styles in CSS; use inline styles only for genuinely dynamic values.
- Preserve the intentionally mature content rather than sanitizing it.

### Adding Activities

1. Add the category to `ACTIVITY_CATEGORIES` in `src/config/activities.js`.
2. Add its entries to `ACTIVITY_MENUS`.
3. Use `specialAction` only when a deterministic handler is required.
4. For generated events, pass a descriptive `context`; it becomes bounded `actionContext` data, not a caller-owned prompt.
5. Preserve yearly-limit, guard, cost, base-effect, and failure behavior in `performActivity()`.

### Adding Careers

- Standard jobs live in `src/engine/careers.json`.
- Special careers live in `src/config/specialCareers.js`.
- Special actions may include `label`, `context`, `cost`, and `specialAction`.
- Add pure mechanic tests before changing progression, income, or performance review logic.

### Adding Static Events

Static catalog events live in `src/engine/events.json` and require `id`, `description`, `ageRange`, and choices with `text` and `effects`. Static content is not an error fallback for failed generated events.

## Game Mechanics Reference

### Core Loop

1. The player clicks `+Age`.
2. `ageUp()` guards against duplicate transitions and computes the next year.
3. It applies stat decay, economy changes, career income/review, education, markets, asset upkeep, relationship/NPC updates, pet updates, and death checks.
4. A generated event is requested from the resulting bounded snapshot.
5. `EventModal` presents the validated event.
6. `handleChoice()` applies bounded effects, updates history, and syncs changed state.
7. `finally` releases the transition guard even after an unexpected failure.

### Stat Degradation and Death

- Health loses 1 per year at age 30+, then 2 per year at age 50+.
- Looks loses 1 per year at age 50+.
- Health at or below 0 causes immediate death.
- At age 60+, mortality uses `(age - 60) / 40`; death is guaranteed at 100.

### Economy and Wealth

The economy rotates through `normal` for 3 years, `boom` for 2, and `recession` for 2. It affects investments and performance reviews.

| Tier | Min Bank | Income Tax | CGT | Lifestyle Cost/yr |
|---|---:|---:|---:|---:|
| Broke | -infinity | 0% | 0% | $0 |
| Struggling | $1k | 10% | 10% | $0 |
| Working Class | $10k | 15% | 15% | $500 |
| Middle Class | $50k | 22% | 20% | $3,000 |
| Upper Middle | $250k | 28% | 23% | $10,000 |
| Wealthy | $1M | 35% | 28% | $40,000 |
| Rich | $10M | 40% | 33% | $150,000 |
| Ultra-Wealthy | $100M | 45% | 37% | $1,000,000 |

### Career and Education

Standard careers use `nextTierId` and `promotionRequirements`. Annual performance review can promote, raise, hold, place the character on a PIP, or fire them. The roll considers smarts, health, karma, networking, financial stress, PIP state, and economy phase.

`DEGREE_CONFIG` defines `highSchool`, `associate`, `bachelor`, `master`, and `phd`. Tuition is deducted while enrolled; completion unlocks tracks and bonuses.

### Relationships, Pets, and Assets

Relationships carry stable IDs plus type, name, age, relation score, status, and life-state fields. The current representation supports the shipped mechanics but is not yet a general persistent-NPC entity model.

Assets are defined in `assetCatalog.js` and grouped by `storeCatalog.js`. Real estate appreciates and responds to markets; vehicles depreciate; luxury goods may hold/appreciate; investments use economy-aware return profiles. Crypto, stock, penny-stock, bond, and fund mechanics live in `investmentMarket.js`.

## Environment Variables

### Browser-visible (`.env.local` / Vercel)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL for the event proxy |
| `VITE_SUPABASE_PUBLISHABLE` | Preferred public gateway key, sent only as `apikey` |
| `VITE_SUPABASE_ANON_KEY` | Legacy public-key fallback |
| `VITE_FIREBASE_API_KEY` | Firebase configuration; all six fields are required |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase configuration |
| `VITE_FIREBASE_PROJECT_ID` | Firebase configuration |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase configuration |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase configuration |
| `VITE_FIREBASE_APP_ID` | Firebase configuration |
| `VITE_ENABLE_DEV_TOOLS` | Optional debug-sheet gate; false by default |

Every `VITE_*` value is browser-visible. Never put an OpenAI key, service-role key, HMAC secret, or other server credential in one.

### Supabase function secrets/runtime

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Server-only OpenAI credential |
| `FIREBASE_PROJECT_ID` | Expected Firebase token audience and issuer |
| `ALLOWED_ORIGINS` | Exact comma-separated HTTP(S) frontend origins |
| `RATE_LIMIT_HMAC_SECRET` | Random secret of at least 32 characters for quota pseudonyms |
| `GENERATE_EVENT_GLOBAL_DAILY_LIMIT` | Optional 100-100,000 project cap; default 1,000 |
| `OPENAI_MODEL` | Optional server-only model override |
| `SUPABASE_URL` | Supabase-provided URL used by the quota RPC |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase-provided server-only RPC credential |

`supabase/config.toml` sets `verify_jwt = false` only because the gateway cannot verify Firebase tokens. The function performs its own verification before provider access. Never expose the service-role key.

## Backend Setup

```bash
supabase db push
supabase secrets set \
  OPENAI_API_KEY=... \
  FIREBASE_PROJECT_ID=... \
  ALLOWED_ORIGINS=http://localhost:5173,https://simlyfe.vercel.app \
  RATE_LIMIT_HMAC_SECRET=... \
  GENERATE_EVENT_GLOBAL_DAILY_LIMIT=1000
supabase functions deploy generate-event
```

Add every allowed Vercel preview origin explicitly; wildcards are rejected. Use `scripts/test-llm.js` with a short-lived `FIREBASE_ID_TOKEN` for a manual endpoint probe.

## Development Workflow

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
CI=1 npm run test:e2e
npm run preview
```

Run lint, unit/contract tests, and a production build for substantive changes. Run Playwright whenever browser flow, Firebase loading, proxy authentication, or event presentation changes. Before production, deploy and inspect a Vercel preview first.

## Test Architecture

| File | Coverage |
|---|---|
| `engine.mechanics.test.js` | Pure mirrors/invariants for engine, careers, economy, assets, relationships, and activities |
| `llmService.test.js` | Auth, bounded projection, normalized responses, timeouts, validation, and sanitized failures |
| `config.data.test.js` | Activity, career, asset, store, pet, and related catalog shape |
| `market.test.js` | Investment and economy mechanics |
| `diagnostics.test.js` | Diagnostic allowlists and privacy redaction |
| `stateValidation.test.js` | Observe-only save-shape validation |
| `gameState.diagnostics.test.jsx` | Age/activity failure handling and guard cleanup |
| `App.test.jsx` | Render smoke test |
| `contract.test.ts` | Edge input, prompt boundary, output normalization, origins, and deadlines |
| `quota-migration.test.ts` | Quota lock order, pruning, and database privileges |
| `tests/e2e/first-run.spec.js` | First run, 18 age transitions, authenticated proxy contract, and gameplay sheets |

Testing conventions:

- New mechanics begin as pure functions/tests in `engine.mechanics.test.js`, then move into `gameState.js`.
- LLM tests reset modules and stub environment before importing the client.
- Treat browser input and model output as untrusted in every test layer.
- Add failure-injection coverage for each new async boundary.
- Keep Playwright provider calls mocked; never spend real tokens in CI.

## Known Issues and Migration Boundaries

- `gameState.js` remains large and returns many values; extract shared pure engine modules incrementally rather than creating a second state owner.
- Engine tests mirror some implementation logic and can drift until helpers are shared.
- Firestore partial merges have no revision, idempotency key, atomic age-transition commit, or multi-tab conflict resolution.
- Generated choices still carry bounded numeric effects; deterministic consequence ownership is the next architectural boundary.
- The current relationship objects are not yet a persistent autonomous-NPC entity/graph model.
- Rotating anonymous Firebase identities can consume the shared project quota. The global cap bounds spend but is not device attestation.
- The singleton project quota lock serializes admissions; revisit only when measured throughput requires partitioning or another atomic counter design.
- Manual scripts are not wired into npm commands.

## Content Notes

SIMLYFE intentionally includes mature and dark themes such as crime, violence, adult relationships, drug use, and illegal activities. Do not sanitize or remove them without explicit owner instruction.
