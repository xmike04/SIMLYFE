# CLAUDE.md — SIMLYFE Codebase Guide

This file provides context for AI assistants working on SIMLYFE, a life simulation browser game built with React and Vite.

---

## Project Overview

SIMLYFE is a single-page life simulation game where players create a character and live through procedurally-generated and LLM-generated events from birth to death, managing stats, career, relationships, and finances.

- **Frontend:** React 19 + Vite 8
- **Database:** Firebase 12 / Firestore (optional — gracefully degrades offline)
- **AI:** OpenAI GPT-4o-mini via REST for dynamic event generation
- **Style:** Vanilla CSS, dark glassmorphism theme, mobile-first (max-width: 480px)
- **Language:** JavaScript + JSX (no TypeScript)
- **Modules:** ES modules (`"type": "module"`)

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server with HMR (http://localhost:5173)
npm run build        # Production build → dist/
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

### Utility Scripts

```bash
node scripts/test-llm.js       # Test Gemini LLM integration (requires VITE_GEMINI_API_KEY)
node scripts/migrateData.js    # Migrate static JSON to Firestore (requires serviceAccountKey.json)
```

---

## Environment Variables

Create a `.env.local` file (never commit it — it's gitignored):

```
VITE_OPENAI_API_KEY=...    # Required for dynamic LLM event generation in-game
VITE_GEMINI_API_KEY=...    # Only needed for scripts/test-llm.js
```

Firebase credentials must be manually set in `src/config/firebase.js`. If left as placeholders, the app runs in offline mode (no cloud saves, no remote events).

---

## Repository Structure

```
SIMLYFE/
├── index.html
├── vite.config.js
├── eslint.config.js
├── package.json
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── scripts/
│   ├── migrateData.js         # One-time Firestore migration tool
│   └── test-llm.js            # LLM smoke test
├── src/
│   ├── main.jsx               # React entry point
│   ├── App.jsx                # Root component — screen routing
│   ├── index.css              # Global styles
│   ├── assets/
│   ├── components/
│   │   ├── MainGame.jsx       # Primary gameplay UI (794 lines)
│   │   ├── CharacterCreation.jsx
│   │   ├── EventModal.jsx
│   │   ├── DeathScreen.jsx
│   │   └── ActionSheet.jsx    # Reusable bottom sheet modal
│   ├── config/
│   │   ├── firebase.js        # Firebase init (uses placeholders by default)
│   │   ├── activities.js      # 24 activity categories, 145+ options
│   │   └── specialCareers.js  # 11 special career paths with custom actions
│   └── engine/
│       ├── gameState.js       # Core game logic — useGameState() hook (646 lines)
│       ├── llmService.js      # OpenAI REST call for dynamic events (86 lines)
│       ├── events.json        # 78 static age-gated events
│       └── careers.json       # 92 career definitions
└── _agents/
    └── workflows/
        └── test-app.md        # Manual test workflow
```

---

## Core Architecture

### Screen Flow (`App.jsx`)

The app uses a single `useGameState()` hook and renders one of three screens based on game state:

1. **CharacterCreation** — name, gender, country
2. **MainGame** — primary gameplay loop (tabs, stats, events)
3. **DeathScreen** — end-of-life summary (triggered at age 60+ with health ≤ 0)

An **EventModal** overlays MainGame when an event is active.

### Game State (`src/engine/gameState.js`)

All game logic lives in the `useGameState()` custom hook. Key state:

| Field | Type | Description |
|---|---|---|
| `character` | object | `{ name, gender, country }` |
| `age` | number | Current age (0–100+) |
| `stats` | object | health, happiness, smarts, looks, grades, athleticism, karma, acting, voice, modeling (all 0–100) |
| `bank` | number | Money in dollars |
| `career` | object | `{ id, title, salary, equity, happinessEffect }` |
| `history` | array | `[{ age, text }]` — log of life events |
| `relationships` | array | `[{ id, type, name, age, relation }]` |
| `belongings` | array | Assets with `cost`, `currentValue`, `upkeep` |
| `properties` | array | Real estate with depreciation and market swings |
| `flags` | object | Arbitrary boolean/value flags for tracking special one-time events |

**Key mechanics to be aware of:**
- Stats degrade after age 30 (gradual) and 50 (accelerated)
- Death triggers when `age >= 60` AND `health <= 0`
- Property values fluctuate with market crash/boom events
- Startup equity is volatile (random annual % swings)
- Careers affect happiness and health passively each year

### LLM Event Generation (`src/engine/llmService.js`)

Calls OpenAI GPT-4o-mini via `fetch` with a structured prompt. Events are age-gated and stat-constrained. Returns JSON with shape:

```json
{
  "text": "Event description",
  "choices": [
    { "label": "Choice text", "effects": { "health": 5, "happiness": -2 } }
  ]
}
```

Falls back to static `events.json` events if the API call fails or the key is missing.

### Static Data

- **`events.json`** — 78 events with `minAge`, `maxAge`, choice arrays, and stat effects
- **`careers.json`** — 92 careers with salary, happinessEffect, healthEffect, minAge, type (`part_time` | `full_time` | `business`)
- **`activities.js`** — 24 categories of activities (e.g. Mind & Body, Crime, Luxury) with age gates and stat effects
- **`specialCareers.js`** — 11 alternative career paths (Actor, Musician, Mafia, Cybercriminal, etc.) each with 4 custom actions

### Firebase (`src/config/firebase.js`)

Configured for anonymous auth + Firestore. Key paths:

- `users/{userId}/saves/currentLife` — full game save document

If Firebase credentials are placeholders, the app silently disables cloud features and runs offline.

---

## Code Conventions

- **No TypeScript** — plain JS/JSX throughout
- **No test framework** — validate by linting + building (see workflow below)
- **Component size** — components can be large (MainGame.jsx is 794 lines); do not split unless functionality clearly warrants it
- **State management** — all game state in a single `useGameState()` hook; no Redux/Zustand
- **CSS** — global `index.css`, no CSS modules or styled-components
- **ESLint** — flat config (`eslint.config.js`); uppercase/underscore-prefixed vars are exempt from `no-unused-vars`
- **Imports** — ES module `import`/`export`; no CommonJS `require()`
- **Event effects** — always deltas (e.g. `health: +5`), never absolute setters, unless explicitly overriding

---

## Testing Workflow

There is no automated test suite. To verify correctness:

```bash
npm run lint     # Catch JS/JSX errors
npm run build    # Catch build-time errors
npm run preview  # Manually test in browser
```

This is also documented in `_agents/workflows/test-app.md`.

---

## Common Tasks

### Adding a New Activity

Edit `src/config/activities.js`. Each activity entry shape:

```js
{
  id: 'unique_id',
  label: 'Display Name',
  minAge: 18,            // optional
  maxAge: 65,            // optional
  effects: { happiness: 5, bank: -50 },
  description: 'Short description shown in UI'
}
```

### Adding a New Career

Edit `src/engine/careers.json`. Entry shape:

```json
{
  "id": "unique_id",
  "title": "Job Title",
  "type": "full_time",
  "minAge": 22,
  "salary": 60000,
  "happinessEffect": 5,
  "healthEffect": -2
}
```

### Adding a Static Event

Edit `src/engine/events.json`. Entry shape:

```json
{
  "id": "unique_id",
  "minAge": 10,
  "maxAge": 18,
  "text": "Event description",
  "choices": [
    { "label": "Accept", "effects": { "happiness": 5 } },
    { "label": "Refuse", "effects": { "karma": 3 } }
  ]
}
```

### Modifying Game State Logic

All mechanics are in `src/engine/gameState.js`. The `useGameState()` hook exposes:
- State variables (character, age, stats, bank, career, history, etc.)
- Action dispatchers (advanceAge, applyChoice, setCareer, buyProperty, etc.)

Do not add side effects outside this hook.

---

## Key Constraints & Gotchas

1. **Firebase is optional** — never make Firebase a hard dependency; always check if it's initialized before calling Firestore
2. **LLM calls cost money** — `llmService.js` calls the OpenAI API on every "age advance"; ensure fallback logic stays intact
3. **Stat bounds** — all stats are 0–100; clamp after any modification
4. **Age gates** — activities, events, and careers each have independent `minAge`/`maxAge` logic; keep these consistent
5. **Mobile-first** — the UI targets 480px max-width; avoid wide layouts or multi-column grids
6. **No build-time secrets** — all `VITE_*` env vars are exposed to the client bundle; do not store server secrets this way
7. **ES modules only** — do not introduce `require()` calls; scripts in `/scripts/` use `import` too
