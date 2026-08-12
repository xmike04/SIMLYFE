# SIMLYFE Architecture

> **Source of truth #1 of 3.** Stack, layout, state, events, and persistence.
> Also see [game-mechanics.md](./game-mechanics.md) and [agent-guide.md](./agent-guide.md).

## Overview

SIMLYFE is a mobile-first, browser-based life simulation game. Players create a character and age one year at a time through careers, relationships, finances, and LLM-generated life events. The UI uses a dark glassmorphism aesthetic.

Optional cloud saves use Firebase (anonymous auth + Firestore). Generated events go through a Supabase Edge Function to OpenAI `gpt-4.1-nano`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 functional components and hooks |
| Bundler | Vite 8 with React/Oxc plugin |
| Styling | Pure CSS with CSS custom properties (`src/index.css`) |
| State | Custom `useGameState()` in `src/engine/gameState.js` |
| Identity / cloud | Firebase anonymous Auth + optional Firestore saves |
| Event proxy | `supabase/functions/generate-event/` |
| LLM client | Authenticated, bounded `fetch` via Supabase proxy; no browser-direct OpenAI path |
| Lint / test | ESLint 9 flat config; Vitest; Playwright e2e |

## Directory map

```text
SIMLYFE/
  src/
    components/          # Presentational screens + ActionSheet
      sheets/            # Gameplay panels (Job, Assets, Relationships, …)
    config/              # Catalogs, wealth tiers, Firebase config
    engine/
      gameState.js       # All shared game logic + cloud sync
      llmService.js      # Authenticated, typed event proxy client
      firebaseToken.js   # Firebase ID-token provider bridge
      diagnostics.js     # Redacted operational diagnostics
      stateValidation.js # Observe-only cloud-save validation
      events.json        # Static event catalog (validated; not silent fallback)
      careers.json       # Standard career ladder data
    tests/
    App.jsx              # View routing
    index.css
  supabase/functions/generate-event/
    index.ts             # Auth, CORS, quotas, provider call
    contract.ts          # Request, prompt, and response contract
  supabase/migrations/   # Durable event-generation quotas
  scripts/               # Manual tools (not npm-wired)
  docs/                  # This folder — three SOT files + case study
```

## State management

All game logic lives in `useGameState()`. Components are presentational and receive state plus handlers from the hook.

### Persisted life fields (`LIFE_SAVE_KEYS`)

Written to Firestore at `users/{uid}/saves/currentLife`:

`character`, `age`, `stats`, `bank`, `history`, `isDead`, `flags`, `career`, `careerMeta`, `relationships`, `belongings`, `properties`, `education`, `networking`, `economyCycle`, `pets`, `will`

### Ephemeral (local only)

`currentEvent`, `isAging`, `activitiesThisYear`, `narrativeMode`, `cloudSync`, `careersData`

### Key local state

- `character` — name, gender, country, optional city
- `age`, `stats` — health, happiness, smarts, looks, grades, athleticism, karma, acting, voice, modeling
- `bank`, `career`, `careerMeta`, `networking`, `economyCycle`, `education`
- `relationships`, `belongings`, `properties`, `pets`, `history`
- `isDead`, `isAging`, `currentEvent`, `activitiesThisYear`

## Component routing (`App.jsx`)

1. No character and not dead → splash (once per session) then `CharacterCreation`
2. `isDead` → `DeathScreen`
3. Otherwise → `MainGame` + optional `EventModal`

### Death restart flow

1. Player dies → `isDead: true` synced to cloud (merge).
2. **Live Again** calls `resetLife()` (not `location.reload()`).
3. `resetLife` clears local state (`character: null`, `isDead: false`, empty pets/career/etc.) and **full-replaces** the cloud document via `buildLifeSave` + `syncToCloud(..., { replace: true })`.
4. App routes to `CharacterCreation`.
5. `startLife(...)` births a new life and again **full-replaces** the cloud doc (includes `career: null`, `pets: []`).

`ignoreCloudLoadRef` prevents a late initial `getDoc` from overwriting a life started or reset before cloud load finishes.

### Cloud sync modes

| Call | Mode | When |
|---|---|---|
| `syncToCloud(data, { replace: true })` | `setDoc` without merge | `startLife`, `resetLife` — wipes stale prior-life fields |
| `persistLife(overrides)` | full `buildLifeSave` + merge | Mid-life mutations (choices, lottery, buys, etc.) |

`persistLife` keeps a `lifeSnapshotRef` (updated every render and eagerly on persist). Callers must pass every field they just mutated as `overrides` because React `setState` has not flushed yet.

Canonical payload builder: exported `buildLifeSave(fields)` in `gameState.js`. Always emits every `LIFE_SAVE_KEYS` entry (nulls/empties intentional on replace).

### Security rules

Least-privilege rules live in [`firestore.rules`](../firestore.rules): the life save is readable/writable only by its owner (`request.auth.uid == userId`), writes must stay within the known save-field allowlist, `careers` is read-only for signed-in players (seeded via the Admin SDK), and everything else is denied. **Deployment is manual** — Firebase console (Firestore → Rules) or `firebase deploy --only firestore:rules`. `src/tests/firestoreRules.test.js` fails if the allowlist drifts from `LIFE_SAVE_KEYS` / `KNOWN_SAVE_FIELDS`.

App Check (reCAPTCHA v3) initializes in `src/config/firebase.js` when `VITE_FIREBASE_APPCHECK_SITE_KEY` is set — a no-op otherwise, and a failed init never blocks cloud saves. The activation decision is the pure `getAppCheckSetup(env)` in `src/config/appCheck.js` (tested directly; `firebase.js` stays mocked in tests). Key registration and enforcement are console-side steps.

Firebase is skipped when any `VITE_FIREBASE_*` credential is missing (`auth` / `db` are `null`).
Firebase anonymous Auth is required for generated events because its short-lived ID token authenticates the Supabase proxy caller.

### Aging / event UI freeze

While `isAging` or `currentEvent` is set:

- Mutating handlers early-return via `isActionLocked()` (except `handleChoice`, which resolves the open event).
- `MainGame` closes any open sheet and disables action tabs / Age / narrative toggle.

This prevents mid-await spends from racing the post-`ageUp` cloud write.

## Event system

`src/engine/llmService.js`:

- Sends only a bounded `{ state, actionContext, narrativeMode }` projection to the configured Supabase function.
- Uses the Firebase ID token as the bearer credential and the Supabase publishable key (or legacy anon key) only as the `apikey` gateway header.
- Enforces one 20-second client budget across token retrieval and the proxy call, validates the normalized response envelope, and emits redacted diagnostics.
- Returns sanitized player-visible error events on auth, timeout, network, rate-limit, service, or validation failure. There is no browser-direct OpenAI path or silent static fallback.

The edge function verifies exact origins and Firebase tokens, validates the bounded request, consumes per-user and project-wide durable quota, owns the prompt/model/temperature/token ceiling, and forwards to OpenAI `gpt-4.1-nano` by default. Strict Structured Outputs are normalized into the browser envelope and validated again by the client.

Expected model JSON:

```json
{
  "description": "Event text",
  "choices": [
    { "text": "Choice label", "effects": { "health": 10, "bank": -50, "happiness": 5 } }
  ]
}
```

Default max tokens are 200 (400 in narrative mode); the server-owned prompt asks for 1–2 sentences under 35 words. Prompt rules include athleticism gating physical tasks and karma gating crime.

Annual age-up prompts also include an explicit server-owned life-stage contract from `getAgeEventGuidance(age)` in `contract.ts`. Infancy stays grounded and low-stakes; age 3 onward requires an engaging situation with age-plausible, materially different choices. Recent history is included with a no-repeat rule. See [game-mechanics.md](./game-mechanics.md#annual-event-pacing) for the public gameplay contract.

## Related code

| Concern | Primary file |
|---|---|
| Life save / reset | `src/engine/gameState.js` (`buildLifeSave`, `resetLife`, `startLife`, `syncToCloud`, `persistLife`) |
| Death UI | `src/components/DeathScreen.jsx` |
| Routing | `src/App.jsx` |
| LLM client | `src/engine/llmService.js` |
| LLM prompt / edge contract | `supabase/functions/generate-event/contract.ts` |
| Firebase init | `src/config/firebase.js` |
