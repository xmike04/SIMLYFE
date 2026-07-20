# SIMLYFE Project Guide

SIMLYFE is a mobile-first, browser-based life simulation game (React 19 + Vite). Players age one year at a time through careers, relationships, finances, and LLM-generated events. Optional Firebase cloud saves; events via Supabase Edge Function → OpenAI `gpt-4.1-nano`.

## Source of truth (read these)

Canonical docs live under [`docs/`](./docs/README.md). **Any new model should read these three files first:**

| # | File | Owns |
|---|---|---|
| 1 | [`docs/architecture.md`](./docs/architecture.md) | Stack, state, routing, LLM, cloud saves / death restart |
| 2 | [`docs/game-mechanics.md`](./docs/game-mechanics.md) | Core loop, economy, careers, assets, death rules |
| 3 | [`docs/agent-guide.md`](./docs/agent-guide.md) | Conventions, env vars, tests, how to extend, known issues |

Do not duplicate long reference tables here. Update the matching `docs/*.md` file when behavior changes.

## Quick facts

- **State:** All game logic in `src/engine/gameState.js` (`useGameState()`). Do not add shared state elsewhere.
- **UI:** Presentational components + `src/components/sheets/`. Pure CSS variables in `index.css`. No TypeScript, Tailwind, or UI libraries.
- **Life reset:** DeathScreen → `resetLife()` → CharacterCreation → `startLife` with `buildLifeSave` + `syncToCloud(..., { replace: true })`. Never bare `location.reload()` for Live Again.
- **LLM:** Descriptive `context` to `generateDynamicEvent()`; errors surface to the player (no silent static fallback).
- **Verify:** `npm run lint && npm test && npm run build` (see `_agents/workflows/test-app.md`). E2e: `npm run test:e2e`.
- **Action audits:** `/audit-job-school`, `/audit-relationships`, `/audit-activities`, or `/audit-actions` (see `docs/agent-guide.md`).
- **Content:** Mature themes are intentional — do not sanitize without explicit instruction.

## Related entry points

- Agent stub: [`AGENTS.md`](./AGENTS.md)
- Human README: [`README.md`](./README.md)
- Portfolio case study: [`docs/case-study.md`](./docs/case-study.md) (not SOT)
