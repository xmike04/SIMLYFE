# SIMLYFE

SIMLYFE is a mobile-first browser life simulator built with React 19 and Vite. Players create a character, age one year at a time, and navigate careers, relationships, education, assets, cities, pets, health, gambling, and AI-generated life events.

- Live demo: https://simlyfe.vercel.app
- **Source of truth (for contributors & models):** [docs/README.md](docs/README.md)
  - [Architecture](docs/architecture.md) · [Game mechanics](docs/game-mechanics.md) · [Agent guide](docs/agent-guide.md)
- Technical case study: [docs/case-study.md](docs/case-study.md)
- Agent entry stubs: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md)

AI events use an authenticated Supabase Edge Function backed by OpenAI. Firebase anonymous authentication supplies the player identity used by the proxy and also enables optional Firestore cloud saves. The browser never receives an OpenAI credential.

## Why It Exists

SIMLYFE is a playable portfolio project with a darker, faster life-sim loop. Its deterministic systems make stats and prior choices matter: athleticism affects physical actions, karma changes crime outcomes, wealth tiers create lifestyle pressure, and generated events receive a bounded snapshot of current game state.

## Stack

| Layer | Technology |
|---|---|
| App | React 19, Vite 8, plain JSX |
| Styling | Pure CSS with CSS variables |
| State | Custom `useGameState()` hook |
| Identity and saves | Firebase anonymous auth and optional Firestore persistence |
| AI events | Authenticated Supabase Edge Function; OpenAI `gpt-4.1-nano` default |
| Tests | Vitest, Testing Library, Playwright |
| Hosting | Vercel |

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app opens at `http://localhost:5173`. It is designed mobile-first and is best reviewed first around `390px` wide.

Configure the browser-visible values in `.env.local`:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE=your_supabase_publishable_key

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`VITE_SUPABASE_ANON_KEY` is supported only for legacy Supabase projects. All six Firebase values are required for authenticated AI events and cloud saves. When Firebase or the proxy is unavailable, gameplay surfaces a sanitized error event; it does not call OpenAI from the browser or silently substitute static content. Debug tools remain hidden unless `VITE_ENABLE_DEV_TOOLS=true`.

## Supabase Backend

Apply the checked-in quota migration, configure server-only secrets, and deploy the function:

```bash
supabase db push
supabase secrets set \
  OPENAI_API_KEY=your_openai_key \
  FIREBASE_PROJECT_ID=your_firebase_project_id \
  ALLOWED_ORIGINS=http://localhost:5173,https://your-production-origin.example \
  RATE_LIMIT_HMAC_SECRET=replace-with-at-least-32-random-characters \
  GENERATE_EVENT_GLOBAL_DAILY_LIMIT=1000
supabase functions deploy generate-event
```

`ALLOWED_ORIGINS` is an exact, comma-separated origin allowlist: add each production or preview origin that should call the function. `OPENAI_MODEL` is an optional server-only override; the default is `gpt-4.1-nano`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function runtime.

`supabase/config.toml` disables the Supabase gateway's JWT check for this function because the caller carries a Firebase token. The function itself verifies that token's RS256 signature, issuer, audience, timestamps, and subject before quota or provider access.

The durable quota layer allows a burst of 2, sustains 6 requests per minute, and caps each authenticated identity at 100 requests per UTC day. A project-wide circuit breaker defaults to 1,000 daily admissions and can be configured from 100 to 100,000. Inactive pseudonymous quota rows are pruned after seven days. Before a large public launch, also add Firebase App Check or a trusted device/network control and configure an OpenAI project spend limit.

## Scripts

```bash
npm run dev            # Start Vite
npm run lint           # ESLint
npm test               # Vitest unit and contract suite
npm run test:e2e       # Playwright first-run and proxy-contract flow
npm run build          # Production build
npm run preview        # Preview the built app
```

For a manual authenticated proxy probe, provide a short-lived Firebase ID token and run:

```bash
FIREBASE_ID_TOKEN=... \
VITE_SUPABASE_URL=... \
VITE_SUPABASE_PUBLISHABLE=... \
node scripts/test-llm.js
```

## Testing Coverage

The Vitest suite covers engine mechanics, market behavior, static catalogs, authenticated proxy requests, input and output schemas, redacted diagnostics, save hydration validation, timeouts, failure injection, and quota migration invariants. The Playwright test verifies the first-run flow through character creation, 18 age transitions, normalized AI events, bearer/API-key separation, and core sheet navigation.

## Production Notes

The Vercel project is `xmike04s-projects/simlyfe`. Local Vercel metadata lives in the ignored `.vercel/` directory. Before promotion, run:

```bash
vercel pull --yes --environment=production
npm run lint
npm test
npm run build
CI=1 npm run test:e2e
```

Deploy and inspect a preview first. Production also requires all six Firebase browser variables, the Supabase URL and publishable key, a deployed migration/function, matching server secrets, and an `ALLOWED_ORIGINS` entry for the final frontend origin.
