# SIMLYFE — AI Assistant Guide

## Project Overview

**SIMLYFE** is a mobile-first, browser-based life simulation game built with React 19 and Vite. Players create a character and age them one year at a time, navigating careers, relationships, finances, and AI-generated life events from birth to death. The UI uses a dark glassmorphism aesthetic. Cloud saves are powered by Firebase, AI events are proxied through a Supabase Edge Function, and LLM calls use OpenAI GPT-4o-mini.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 (functional components + hooks only) |
| Bundler | Vite 8 with React/Oxc plugin |
| Styling | Pure CSS with CSS custom properties (no Tailwind/UI libs) |
| State management | Custom `useGameState` hook (no Redux/Zustand) |
| Cloud backend | Firebase Firestore (saves) + Firebase Auth (anonymous) |
| LLM proxy | Supabase Edge Function (`supabase/functions/generate-event/`) |
| LLM client | `@supabase/supabase-js` — proxied call to OpenAI GPT-4o-mini |
| AI events (dev fallback) | Direct OpenAI call via `VITE_OPENAI_API_KEY` |
| Planned (unused) | `@google/generative-ai` (Gemini SDK is installed but not wired up) |
| Linting | ESLint 9 flat config with React Hooks plugin |

---

## Directory Structure

```
SIMLYFE/
├── src/
│   ├── components/         # React UI components
│   │   ├── ActionSheet.jsx       # Reusable bottom-sheet modal wrapper
│   │   ├── CharacterCreation.jsx # New-game form (name, gender, country)
│   │   ├── MainGame.jsx          # Core game UI (~1926 lines, all gameplay)
│   │   ├── EventModal.jsx        # Full-screen event choice popup
│   │   ├── DeathScreen.jsx       # End-of-life summary screen
│   │   └── sheets/
│   │       ├── AssetsSheet.jsx       # Assets & store browsing sheet
│   │       └── RelationshipsSheet.jsx # Relationship management sheet
│   ├── config/             # Static game data & config
│   │   ├── activities.js         # Activity categories and sub-menus
│   │   ├── specialCareers.js     # 11 special career paths with actions
│   │   ├── wealthTiers.js        # 8 wealth tiers: tax rates, lifestyle costs, gift scaling
│   │   ├── assetCatalog.js       # 4 asset categories: realEstate, vehicles, luxury, investments
│   │   ├── storeCatalog.js       # Branded store listings per asset category, tier-gated
│   │   ├── investmentMarket.js   # 5 tradeable instrument types: crypto, stocks, penny, bonds, funds
│   │   └── firebase.js           # Firebase init — reads from VITE_FIREBASE_* env vars
│   ├── engine/             # Core game logic
│   │   ├── gameState.js          # useGameState() hook — all game state & methods
│   │   ├── llmService.js         # LLM proxy (Supabase) + dev fallback (direct OpenAI)
│   │   ├── events.json           # Static fallback events library
│   │   └── careers.json          # Job definitions (salary, effects, min age)
│   ├── tests/              # Vitest test suite
│   │   ├── engine.mechanics.test.js  # Pure game-logic mirrors (200+ assertions)
│   │   ├── llmService.test.js        # LLM flow + schema validation
│   │   ├── config.data.test.js       # Activity/career data shape checks
│   │   ├── App.test.jsx              # Smoke test for App render
│   │   └── setup.js                  # Global mocks (firebase, llmService)
│   ├── assets/             # Static images
│   ├── App.jsx             # Root component — simple state-based router
│   ├── main.jsx            # React entry point (StrictMode)
│   └── index.css           # All global styles & CSS variables
├── supabase/
│   └── functions/
│       └── generate-event/
│           └── index.ts          # Deno edge function — proxies OpenAI call server-side
├── public/
├── index.html              # Vite entry HTML
├── package.json
├── vite.config.js
└── .gitignore
```

---

## Architecture

### State Management

All game logic lives in the custom hook `src/engine/gameState.js` (`useGameState()`). It is the single source of truth. Components are mostly presentational — they receive state and call methods from this hook.

Key state variables:
- `character` — name, gender, country
- `age`, `stats` (health, happiness, smarts, looks, grades, athleticism, karma 0–100)
- `bank` — numeric bank balance in dollars
- `career`, `salary` — current job
- `careerMeta` — `{ yearsInRole, isOnPIP, financialStressFlag, unemploymentYearsLeft }`
- `networking` — 0–100 score; gained from jobs and events, required for certain careers
- `economyCycle` — `{ year, phase, yearsInPhase }` — current economy phase state
- `education` — `{ highSchool, associate, bachelor, master, phd, currentDegree }`
- `relationships[]` — NPCs with name, age, relation score (0–100)
- `belongings[]`, `properties[]` — owned assets
- `history[]` — log entries shown in the history panel
- `isDead`, `isAging`, `currentEvent`, `activitiesThisYear`
- Hidden skill stats: `acting`, `voice`, `modeling` (not shown in UI directly)

### Component Routing

`App.jsx` renders one of three views based on game state:
1. No character → `<CharacterCreation />`
2. `isDead` → `<DeathScreen />`
3. Otherwise → `<MainGame />` + conditional `<EventModal />`

### LLM Event System

`src/engine/llmService.js` routes LLM calls through a Supabase Edge Function when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. This keeps `OPENAI_API_KEY` server-side. If only `VITE_OPENAI_API_KEY` is set, the service falls back to calling OpenAI directly (dev mode — key exposed in bundle).

The edge function lives at `supabase/functions/generate-event/index.ts` and is a thin Deno proxy: it reads `OPENAI_API_KEY` from Supabase secrets and forwards the request to `gpt-4o-mini`.

The prompt includes character stats, recent history (last 5 entries), and an optional `actionContext` string. The expected JSON response schema:

```json
{
  "description": "Event text (under 50 words)",
  "choices": [
    { "text": "Choice label", "effects": { "health": 10, "bank": -50, "happiness": 5 } }
  ]
}
```

The service strips markdown code fences from responses before parsing. If the call fails or returns malformed JSON, it returns an error event (no silent fallback to `events.json` — the error surfaces in the description).

**Stat enforcement rules embedded in the prompt:**
- Low athleticism → fails physical tasks
- High karma → fails crime attempts
- Low karma → succeeds in crime

### Firebase Cloud Saves

Anonymous Firebase Auth is used to create a persistent user ID. On every state change, the full game state is merged into `users/{uid}/saves/currentLife` in Firestore. `firebase.js` reads credentials from `VITE_FIREBASE_*` env vars — if any are missing, `auth` and `db` are `null` and cloud saves are silently skipped.

---

## Key Conventions

### Code Style
- **React 19 functional components only** — no class components
- **Hooks for everything** — all logic goes in `useGameState()` or local component state
- **Inline styles + CSS classes** — `MainGame.jsx` uses heavy inline styles for dynamic values; static styles live in `index.css`
- **No TypeScript** — the project is plain JSX; `@types/*` packages are installed but unused
- **No external UI libraries** — all components are hand-built; keep it that way

### Adding New Activities
1. Add the category to `ACTIVITY_CATEGORIES` in `src/config/activities.js`
2. Add the sub-menu array to `ACTIVITY_MENUS` in the same file
3. If it needs a special UI action, add a `specialAction` string and handle it in `MainGame.jsx`
4. If it should call the LLM, pass a descriptive `context` string — this becomes the `actionContext` in the prompt

### Adding New Careers
- **Standard jobs**: Add to `src/engine/careers.json` with `salary`, `happinessEffect`, `healthEffect`, `minAge`, `type` (`part_time` or `full_time`)
- **Special careers**: Add to `src/config/specialCareers.js` — each career has an array of `actions`, each with `label`, `context` (LLM prompt text), optional `cost`, and optional `specialAction`

### Adding New Events (static fallback)
Add to `src/engine/events.json`. Each event needs: `id`, `description`, `ageRange` (`[min, max]`), and `choices[]` with `text` and `effects`.

### Styling
- Use CSS variables defined in `index.css` (e.g., `var(--health-color)`, `var(--glass-bg)`)
- Glassmorphism pattern: `background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border)`
- Mobile-first: max container width is `480px` (desktop caps at `850px` height)
- Stat colors are mapped: health=red, happiness=amber, smarts=green, looks=pink, athleticism=blue, karma=purple

---

## Game Mechanics Reference

### Core Loop
1. Player clicks the green **+Age** button
2. `ageUp()` runs: applies stat degradation, economy cycle tick, salary income, investment returns, performance review, random events, death check
3. If an event fires, `currentEvent` is set → `EventModal` renders
4. Player picks a choice → `handleChoice()` applies effects, logs to history

### Stat Degradation (per year)
- Health: -1 at age 30+, -2 at age 50+
- Looks: -1 at age 50+
- All other stats: stable unless modified by events/activities

### Death Conditions
- `health <= 0` → immediate death
- Age 60+: probability = `(age - 60) / 40`, capped to guarantee death at age 100

### Economy Cycle
Three phases rotate on fixed durations: `normal` (3 yrs) → `boom` (2 yrs) → `recession` (2 yrs) → `normal`. Tracked in `economyCycle` state. Phase affects all investment returns (boom adds bonus, recession adds penalty) and performance review outcomes (+5% roll in boom, −5% in recession). The current phase is visible to the player in the UI.

### Wealth Tier System
Defined in `src/config/wealthTiers.js`. 8 tiers based on liquid bank balance:

| Tier | Min Bank | Income Tax | CGT | Lifestyle Cost/yr |
|---|---|---|---|---|
| Broke | −∞ | 0% | 0% | $0 |
| Struggling | $1k | 10% | 10% | $0 |
| Working Class | $10k | 15% | 15% | $500 |
| Middle Class | $50k | 22% | 20% | $3,000 |
| Upper Middle | $250k | 28% | 23% | $10,000 |
| Wealthy | $1M | 35% | 28% | $40,000 |
| Rich | $10M | 40% | 33% | $150,000 |
| Ultra-Wealthy | $100M | 45% | 37% | $1,000,000 |

Tier also drives: gift button amounts, date costs, relationship decay multiplier (higher wealth = faster decay), and a happiness penalty reflecting the burden of expectations.

### Career System
Standard careers in `careers.json` support tiered tracks via `nextTierId` and `promotionRequirements` (`minYearsInRole`, `minSmarts`, `minHealth`, `minKarma`). A `sector` field groups careers for UI display. Each year with a job runs `runPerformanceReview()`, which produces one of five outcomes:

| Outcome | Effect |
|---|---|
| `promoted` | Advances to next tier if `promotionRequirements` met; otherwise treated as raise |
| `raise` | Salary × 1.05 |
| `no_change` | No effect |
| `pip` | Performance Improvement Plan flag set; roll penalised next year |
| `fired` | Career set to null, 2 years unemployment, happiness −30 |

Review roll is based on smarts, health, karma, networking score, PIP flag, financial stress, and economy phase.

### Networking System
`networking` is a 0–100 score. Gained from attending industry mixers/conferences (`networking_mixer` activity, costs $200) and from certain career/event outcomes. Required threshold for some career tracks. Contributes to performance review roll (`+0.02` per 10 points).

### Education / Degree System
`DEGREE_CONFIG` (exported from `gameState.js`) defines a pipeline: `highSchool` → `associate` (2 yrs, $10k/yr) → `bachelor` (4 yrs, $20k/yr) → `master` (2 yrs, $30k/yr) → `phd` (4 yrs, free, −20 happiness). Annual tuition is deducted from bank each year while enrolled. Completion unlocks certain career tracks and grants stat bonuses.

### Asset & Store Catalog
`src/config/assetCatalog.js` defines purchasable assets in four categories:
- **realEstate** — appreciates 3–6%/yr, affected by market crash/boom events
- **vehicles** — depreciates 8–20%/yr (hypercars are an exception, slight appreciation)
- **luxury** — collectibles hold/gain value slowly (2–8%/yr)
- **investments** — return driven by `returnProfile` and economy phase

Assets have `upkeep` (deducted annually), `statEffects` (applied passively each year), and a `minTier` wealth gate.

`src/config/storeCatalog.js` wraps catalog items into named, branded stores (e.g., "Pinnacle Luxury Estates", "Apex Motorsports") with specific make/model listings. Stores are also tier-gated.

### Investment Market
`src/config/investmentMarket.js` provides five tradeable instrument sub-types accessed via the Investments hub:

| Sub-type | Key mechanic |
|---|---|
| `crypto` | High volatility; ≥1.5 volatility triggers moonshot mechanic (2% chance of 50×–1000× per year) |
| `stocks` | Annual drift + volatility swing; sector-tagged (tech, healthcare, finance, etc.) |
| `penny` | 12% bankrupt chance, 10% moonshot (2×–6×), else ±50% random |
| `bonds` | Fixed coupon paid annually; matures after set years; minimal volatility |
| `funds` | `returnProfile`-driven annual return; range from bond index to VC seed |

`getMarketHealth()` returns a Bullish/Mixed/Bearish label and score per sub-type per economy phase, used for UI display.

### Economy (legacy mechanics)
| Mechanic | Details |
|---|---|
| Lottery | $5/ticket, 0.001% win rate, $10M jackpot |
| Gambling | $100 bet, 45% win rate, 2× return |
| Day trading | $1000 buy-in; 40% lose all, 20% lose half, 20% +50%, 15% +100%, 5% +400% |
| Startup equity | 20% bankrupt, 30% downturn (×0.8), 30% steady, 20% moonshot (×3) |
| Real estate (legacy) | 5% crash, 10% boom per year — asset catalog items use appreciation rates instead |

### Dating Success Formula
`successChance = (partnerLooks / 150) + (playerLooks / 150)`

---

## Environment Variables

| Variable | Purpose | Where |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL — enables LLM proxy | `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key — authorises edge function calls | `.env.local` |
| `VITE_OPENAI_API_KEY` | Dev fallback — direct OpenAI call (key exposed in bundle) | `.env.local` |
| `VITE_FIREBASE_API_KEY` | Firebase credentials — all six vars required to enable cloud saves | `.env.local` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase credentials | `.env.local` |
| `VITE_FIREBASE_APP_ID` | Firebase credentials | `.env.local` |
| `OPENAI_API_KEY` | Set as Supabase secret (server-side only — not in `.env.local`) | Supabase dashboard |

**Security note:** When `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set, the OpenAI key stays server-side in the edge function. The `VITE_OPENAI_API_KEY` fallback is for local dev only and must not be used in production.

---

## Development Workflow

```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server (hot reload)
npm run build      # Production build → dist/
npm run lint       # ESLint check
npm run preview    # Preview production build locally
npm test           # Run full test suite (Vitest, one-shot)
npm run test:watch # Watch mode for TDD
npm run test:coverage  # Coverage report → coverage/
```

## Test Architecture

Tests live in `src/tests/`. Four files, each targeting a distinct layer:

| File | What it tests |
|---|---|
| `engine.mechanics.test.js` | Pure game-logic functions mirrored from `gameState.js`: stat clamping, death formula, age-up degradation, career income, startup equity, property market, lottery/gambling/day-trading, startLife validity, relationship helpers (200+ assertions) |
| `llmService.test.js` | `generateDynamicEvent` — proxy path, dev-fallback path, malformed JSON handling; full schema validation of `events.json` and `careers.json` |
| `config.data.test.js` | Shape and consistency of `ACTIVITY_CATEGORIES`, `ACTIVITY_MENUS`, and `SPECIAL_CAREERS` |
| `App.test.jsx` | Smoke test — verifies the app renders without crashing |

**Key conventions:**
- Engine tests mirror logic from `gameState.js` as pure functions — no React, no mocks needed
- LLM tests use `vi.resetModules()` + `vi.stubEnv()` before each import to control the `VITE_OPENAI_API_KEY` const
- `src/tests/setup.js` auto-mocks `firebase` and `llmService` for all tests except `llmService.test.js` (which uses `vi.unmock`)
- When adding a new mechanic: add the pure-function mirror + tests to `engine.mechanics.test.js` first, then implement in `gameState.js`
- When adding new static data (events, careers, activities): the existing schema tests will catch missing fields automatically

---

## Known Issues / TODOs

- **`@google/generative-ai` unused**: Gemini SDK is installed but never imported — either wire it up or remove it
- **`firebase-admin` in client bundle**: Admin SDK should only run server-side; it's in `dependencies`, which may increase bundle size
- **`MainGame.jsx` size**: At ~1926 lines, consider splitting further into sub-components beyond the existing `sheets/` directory
- **Death probability**: Currently guarantees death at age 100 — this may be intentional

---

## Content Notes

SIMLYFE contains intentionally mature and dark themes including crime, violence, adult relationships, drug use, and illegal activities. This is by design. Do not sanitize or remove these features without explicit user instruction.
