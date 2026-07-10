# SIMLYFE Project Guide

## Project Overview

SIMLYFE is a mobile-first, browser-based life simulation game built with React 19 and Vite. Players create a character and age them one year at a time, navigating careers, relationships, finances, and generated life events from birth to death. The UI uses a dark glassmorphism aesthetic. Optional cloud saves are powered by Firebase, events are proxied through a Supabase Edge Function, and LLM calls use OpenAI GPT-4.1-nano.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 functional components and hooks |
| Bundler | Vite 8 with React/Oxc plugin |
| Styling | Pure CSS with CSS custom properties |
| State management | Custom `useGameState` hook |
| Cloud backend | Optional Firebase Firestore saves with anonymous Firebase Auth |
| Event proxy | Supabase Edge Function in `supabase/functions/generate-event/` |
| LLM client | `fetch` through the Supabase proxy, with a local direct-call fallback |
| Linting | ESLint 9 flat config with React Hooks plugin |

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
      sheets/
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
      firebase.js
    engine/
      gameState.js
      llmService.js
      events.json
      careers.json
    tests/
      engine.mechanics.test.js
      llmService.test.js
      config.data.test.js
      market.test.js
      App.test.jsx
      setup.js
    assets/
    App.jsx
    main.jsx
    index.css
  supabase/functions/generate-event/index.ts
  scripts/migrateData.js
  scripts/test-llm.js
  public/favicon.svg
  public/icons.svg
  public/manifest.json
  index.html
  package.json
  vite.config.js
  eslint.config.js
```

## Architecture

### State Management

All game logic lives in `src/engine/gameState.js` through the `useGameState()` hook. Components are mostly presentational and receive state plus handler functions from this hook.

Key state variables:

- `character`: name, gender, country, and optional city
- `age`, `stats`: health, happiness, smarts, looks, grades, athleticism, karma, acting, voice, and modeling
- `bank`: liquid balance in dollars
- `career`, `careerMeta`, `networking`: current work state and career progression data
- `economyCycle`: current year, phase, and duration within the phase
- `education`: completed or active degree state
- `relationships`: NPCs with relationship type, age, status, and relation score
- `belongings`, `properties`: owned assets
- `history`: log entries shown in the history panel
- `isDead`, `isAging`, `currentEvent`, `activitiesThisYear`

### Component Routing

`App.jsx` renders one of three views:

1. No character: `CharacterCreation`
2. Dead character: `DeathScreen`
3. Active life: `MainGame` plus conditional `EventModal`

### Event System

`src/engine/llmService.js` routes generated event calls through a Supabase Edge Function when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. This keeps `OPENAI_API_KEY` server-side. If only `VITE_OPENAI_API_KEY` is set, the service falls back to calling OpenAI directly in local development.

The edge function lives at `supabase/functions/generate-event/index.ts`. It reads `OPENAI_API_KEY` from Supabase secrets, validates the request shape, and forwards the request to `gpt-4.1-nano`.

The prompt includes character stats, recent history, and an optional `actionContext` string. Responses are capped at 200 tokens by default, 400 in narrative mode, and the prompt asks for a 1-2 sentence description under 35 words.

Expected JSON response:

```json
{
  "description": "Event text",
  "choices": [
    { "text": "Choice label", "effects": { "health": 10, "bank": -50, "happiness": 5 } }
  ]
}
```

If the call fails or returns malformed JSON, the service returns an error event instead of silently falling back to static events.

Prompt rules currently include:

- Low athleticism should fail physical tasks.
- High karma should fail crime attempts.
- Low karma should succeed in crime.

### Firebase Cloud Saves

Anonymous Firebase Auth creates a persistent user ID. The game merges state into `users/{uid}/saves/currentLife` in Firestore. `src/config/firebase.js` reads credentials from `VITE_FIREBASE_*` environment variables. If any are missing, `auth` and `db` are `null` and cloud saves are skipped.

## Key Conventions

### Code Style

- React 19 functional components only.
- Keep all shared game logic in `useGameState()` or extracted pure helpers.
- Use inline styles for dynamic values in `MainGame.jsx`; keep static styles in `index.css`.
- Do not add TypeScript.
- Do not add external UI libraries.
- Use CSS variables from `index.css`.

### Adding Activities

1. Add the category to `ACTIVITY_CATEGORIES` in `src/config/activities.js`.
2. Add the sub-menu array to `ACTIVITY_MENUS`.
3. If it needs a special UI action, add `specialAction` and handle it in `MainGame.jsx`.
4. If it should trigger a generated event, pass a descriptive `context` string.

### Adding Careers

- Standard jobs live in `src/engine/careers.json`.
- Special careers live in `src/config/specialCareers.js`.
- Special career actions should include `label`, `context`, optional `cost`, and optional `specialAction`.

### Adding Static Events

Add static catalog entries to `src/engine/events.json`. Each event needs `id`, `description`, `ageRange`, and `choices` with `text` plus `effects`.

## Game Mechanics Reference

### Core Loop

1. Player clicks the `+Age` button.
2. `ageUp()` applies stat degradation, economy tick, income, investment returns, performance review, event generation, and death checks.
3. If an event fires, `currentEvent` is set and `EventModal` renders.
4. Player chooses an option, then `handleChoice()` applies effects and logs history.

### Stat Degradation

- Health loses 1 per year at age 30+, then 2 per year at age 50+.
- Looks loses 1 per year at age 50+.
- Other stats are stable unless changed by events or activities.

### Death Conditions

- Health at or below 0 causes immediate death.
- Age 60+ uses `(age - 60) / 40` probability, capped so death is guaranteed at age 100.

### Economy Cycle

Economy phases rotate on fixed durations: `normal` for 3 years, `boom` for 2 years, `recession` for 2 years, then back to `normal`. Phase affects investment returns and performance review outcomes.

### Wealth Tiers

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

Tier affects gift amounts, date costs, relationship decay, and lifestyle pressure.

### Career System

Standard careers use `nextTierId` and `promotionRequirements`. Each year with a job runs `runPerformanceReview()`.

| Outcome | Effect |
|---|---|
| `promoted` | Advances to next tier if requirements are met; otherwise treated as raise |
| `raise` | Salary x 1.05 |
| `no_change` | No effect |
| `pip` | Performance Improvement Plan flag set; next review is penalized |
| `fired` | Career set to null, 2 years unemployment, happiness -30 |

Review roll considers smarts, health, karma, networking, PIP state, financial stress, and economy phase.

### Networking

`networking` is a 0-100 score. It is gained from industry mixers, conferences, jobs, and events. Certain career tracks require a minimum networking score.

### Education

`DEGREE_CONFIG` defines this pipeline: `highSchool`, `associate`, `bachelor`, `master`, `phd`. Annual tuition is deducted while enrolled. Completion unlocks some career tracks and grants stat bonuses.

### Asset Catalog

`src/config/assetCatalog.js` defines four asset categories:

- `realEstate`: appreciates 3-6% per year and is affected by market conditions.
- `vehicles`: depreciates 8-20% per year, with some exceptions.
- `luxury`: collectibles hold or gain value slowly, usually 2-8% per year.
- `investments`: returns are driven by `returnProfile` and economy phase.

`src/config/storeCatalog.js` wraps catalog items into named stores with specific listings. Stores are tier-gated.

### Investment Market

| Sub-type | Key mechanic |
|---|---|
| `crypto` | High volatility; >=1.5 volatility can trigger a 50x-1000x moonshot |
| `stocks` | Annual drift plus volatility swing, with sector tags |
| `penny` | 12% bankrupt chance, 10% moonshot, otherwise +/-50% random |
| `bonds` | Fixed coupon paid annually; matures after set years |
| `funds` | `returnProfile` driven annual return |

`getMarketHealth()` returns Bullish, Mixed, or Bearish labels and scores per sub-type and economy phase.

### Legacy Economy Mechanics

| Mechanic | Details |
|---|---|
| Lottery | $5 per ticket, 0.001% win rate, $10M jackpot |
| Gambling | $100 bet, 45% win rate, 2x return |
| Day trading | $1000 buy-in; 40% lose all, 20% lose half, 20% gain 50%, 15% gain 100%, 5% gain 400% |
| Startup equity | 20% bankrupt, 30% downturn at 0.8x, 30% steady, 20% moonshot at 3x |
| Real estate legacy | 5% crash, 10% boom per year |

## Environment Variables

| Variable | Purpose | Where |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL for event proxy | `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key for edge function calls | `.env.local` |
| `VITE_OPENAI_API_KEY` | Local direct-call fallback only | `.env.local` |
| `VITE_FIREBASE_API_KEY` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_APP_ID` | Firebase credentials | `.env.local` |
| `VITE_ENABLE_DEV_TOOLS` | Optional debug sheet gate | `.env.local` |
| `OPENAI_API_KEY` | Supabase secret, server-side only | Supabase dashboard |

Do not set `VITE_OPENAI_API_KEY` in production builds. Production should use the Supabase proxy so the OpenAI key stays server-side.

## Development Workflow

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
npm run preview
```

For substantive app changes, run `npm install`, `npm run lint`, `npm test`, and `npm run build`. Run `npm run test:e2e` for browser-flow changes.

## Test Architecture

| File | What it tests |
|---|---|
| `engine.mechanics.test.js` | Pure game-logic mirrors for mechanics, markets, income, relationships, and start-life validity |
| `llmService.test.js` | Proxy path, local fallback path, malformed JSON handling, and static catalog schema validation |
| `config.data.test.js` | Activity, career, asset, and store catalog shape |
| `market.test.js` | Investment market mechanics |
| `App.test.jsx` | Render smoke test |

Testing conventions:

- Engine tests mirror logic from `gameState.js` as pure functions.
- LLM tests use `vi.resetModules()` and `vi.stubEnv()` before imports.
- `src/tests/setup.js` mocks Firebase and `llmService` except where tests explicitly unmock them.
- New mechanics should get pure-function tests before implementation.

## Known Issues

- `gameState.js` is large and returns many values; focused hooks or shared pure helpers would reduce drift.
- Engine tests mirror logic that can diverge from implementation if shared helpers are not extracted.
- The Supabase edge function is callable by anyone with the public project URL and anon key.
- `scripts/` are manual and are not wired into npm scripts.
- Death is guaranteed at age 100; this may be intentional.

## Content Notes

SIMLYFE contains intentionally mature and dark themes including crime, violence, adult relationships, drug use, and illegal activities. This is by design. Do not sanitize or remove these features without explicit user instruction.
