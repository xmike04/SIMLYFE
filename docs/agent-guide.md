# SIMLYFE Agent Guide

> **Source of truth #3 of 3.** Conventions for humans and coding agents.
> Also see [architecture.md](./architecture.md) and [game-mechanics.md](./game-mechanics.md).

Root stubs: [`AGENTS.md`](../AGENTS.md) and [`CLAUDE.md`](../CLAUDE.md) point here. Prefer updating **this file** when conventions change.

## Hard constraints

- React 19 functional components only — no TypeScript, no Tailwind, no external UI libraries.
- All shared game logic in `useGameState()` or extracted pure helpers in/near `src/engine/gameState.js`.
- Static styles in `src/index.css` (CSS variables); dynamic values may use inline styles in `MainGame.jsx`.
- Gameplay panels belong in `src/components/sheets/`, not inlined into `MainGame.jsx`.
- LLM: pass a descriptive `context` string to `generateDynamicEvent()`. Keep prompts/model settings server-owned in `supabase/functions/generate-event/contract.ts`; do not add browser-direct OpenAI calls or silent static fallbacks.
- Mature content is intentional — do not sanitize without explicit user instruction.

## How to extend

### Activities

1. Category → `ACTIVITY_CATEGORIES` in `src/config/activities.js`.
2. Sub-menu → `ACTIVITY_MENUS`.
3. Special UI → `specialAction` handled in `MainGame.jsx`.
4. Generated event → descriptive `context` string.

### Careers

- Standard → `src/engine/careers.json`.
- Special → `src/config/specialCareers.js` (`label`, `context`, optional `cost` / `specialAction`).

### Static events

`src/engine/events.json`: `id`, `description`, `ageRange`, `choices[]` with `text` + `effects`.

### Cloud life boundaries

- New life / reset must use `buildLifeSave(...)` + `syncToCloud(..., { replace: true })`.
- Mid-life updates may keep `{ merge: true }`.
- Always include `career`, `pets`, and `isDead` on replace writes.
- Death UI must call `resetLife()`, never bare `location.reload()`.

## Environment variables

| Variable | Purpose | Where |
|---|---|---|
| `VITE_SUPABASE_URL` | Event proxy project URL | `.env.local` |
| `VITE_SUPABASE_PUBLISHABLE` | Publishable key for edge calls | `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | Legacy fallback only | `.env.local` |
| `VITE_FIREBASE_*` | Authenticated AI events + optional cloud saves (all six required) | `.env.local` |
| `VITE_ENABLE_DEV_TOOLS` | Debug sheet gate | `.env.local` |
| `OPENAI_API_KEY` | Server secret for edge function | Supabase secrets |
| `FIREBASE_PROJECT_ID` | Firebase token audience / issuer validation | Supabase secrets |
| `ALLOWED_ORIGINS` | Exact frontend-origin allowlist | Supabase secrets |
| `RATE_LIMIT_HMAC_SECRET` | Pseudonymous user quota key | Supabase secrets |
| `GENERATE_EVENT_GLOBAL_DAILY_LIMIT` | Project-wide daily admission cap | Supabase secrets |

## Development workflow

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
npm run preview
```

Substantive app changes: follow `_agents/workflows/test-app.md` — `npm install`, `npm run lint`, `npm test`, `npm run build`. Use e2e for browser-flow changes.

### Manual scripts (not npm-wired)

- `node scripts/test-llm.js` — needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE`.
- `node scripts/migrateData.js` — needs `scripts/serviceAccountKey.json` + temporary `firebase-admin`.

## Testing

| File | Covers |
|---|---|
| `engine.mechanics.test.js` | Mechanics (imported helpers + remaining mirrors) |
| `llmService.test.js` | Authenticated proxy / bounded projections / sanitized failures / catalog schema |
| `supabase/functions/generate-event/contract.test.ts` | Edge request, prompt, response, and quota contracts |
| `config.data.test.js` | Activity, career, asset, store shapes |
| `market.test.js` | Investment market |
| `App.test.jsx` | Render smoke |

Conventions:

- Prefer testing real exported helpers (`buildLifeSave`, `enrollDegree`, `advanceDegreeYear`, `applyPaperInvestmentReturn`, `findSpouse`, `markAsEx`, `normalizeRelationshipNpc`, `applyEffectsPure`, `yearlyActivityTrackId`, `canConsumeYearlyActivity`, `pickHeadhunterPlacement`) over forever-diverging mirrors when possible.
- Education UI must bind `yearsInProgram`; headhunter must charge `HEADHUNTER_COST` inside `hireViaHeadhunter` (not a lone LLM event).
- Career eligibility and headhunter placement must both use `hasRequiredDegree` so higher completed degrees satisfy lower minimum requirements.
- Mid-life cloud writes use `persistLife(overrides)` with a full `buildLifeSave` payload; pass every field mutated in the same tick.
- Dating NPCs must go through `normalizeRelationshipNpc(..., { asDating: true })` / `addRelationship`.
- Divorce / breakup must use `markAsEx` so `findSpouse` and romance actions stay correct.
- Gym/run and other special skills with `yearlyLimit` must call `consumeYearlyActivity` (or `performActivity`).
- Military Job menu must call `enlistMilitary` (sets `soldier` career), not LLM-only enlist flavor.
- `startStartup` owns `STARTUP_COST` ($500) via `computeStartupLaunch` — JobSheet must not also `debugModifyBank` for that action.
- An active founder cannot launch again: keep the engine `already_founder` guard and the disabled JobSheet state aligned.
- Investment purchases must go through `prepareInvestmentPurchase`; store canonical singular sub-types and reject malformed input before state mutation.
- Gambling must use `computeGambleResult` so invalid/non-finite stakes cannot corrupt bank state.
- New mechanics: pure-function tests first, then wire into `gameState.js`.
- LLM tests: `vi.resetModules()` + `vi.stubEnv()` before import.
- `src/tests/setup.js` mocks Firebase and `llmService` by default.

## Action-tree audit agents

Slash commands (Claude) and matching skills under `.agents/skills/`:

| Command | Skill | Walks |
|---|---|---|
| `/audit-job-school` | `simlyfe-job-school` | Job sheet, careers, education, recruiter |
| `/audit-relationships` | `simlyfe-relationships` | Relationships + dating + ageUp NPC |
| `/audit-activities` | `simlyfe-activities` | Activity categories/menus + special sheets |
| `/audit-actions` | — | Orchestrates all three in parallel, then synthesizes |

Run after sheet/`gameState` changes or when hunting unwired buttons. Agents are read-only unless asked to fix.

1. The three SOT files under `docs/` are authoritative: `architecture.md`, `game-mechanics.md`, `agent-guide.md`.
2. When behavior changes, update the relevant SOT file in the same PR/change.
3. Keep `CLAUDE.md` / `AGENTS.md` as short pointers + critical bullets — do not fork long mechanics tables there.
4. `docs/case-study.md` is portfolio narrative, not gameplay SOT.

## Known issues

- `gameState.js` is large; prefer extracted pure helpers to reduce test drift.
- Firebase App Check or another trusted device/network control is still recommended before a large public launch.
- No `firestore.rules` committed; deploy least-privilege rules in the Firebase console.
- Death guaranteed at age 100 (may be intentional).
- Wills UI is largely flavor; estate is not applied on death.
