# SIMLYFE - Agent Guide

Entry point for AI coding agents.

## Read first (source of truth)

1. [`docs/architecture.md`](./docs/architecture.md) — system design, cloud saves, death restart
2. [`docs/game-mechanics.md`](./docs/game-mechanics.md) — gameplay rules
3. [`docs/agent-guide.md`](./docs/agent-guide.md) — conventions, env, tests, known issues

Index: [`docs/README.md`](./docs/README.md). Project stub for Claude: [`CLAUDE.md`](./CLAUDE.md).

## Critical bullets

- **Framework:** React 19, Vite 8, pure CSS — no Tailwind, no UI libraries, no TypeScript.
- **State:** All game logic in `useGameState()` (`src/engine/gameState.js`). Extract pure helpers when adding mechanics.
- **Sheets:** New panels in `src/components/sheets/`, not inline in `MainGame.jsx`.
- **Cloud life boundaries:** `buildLifeSave` + `syncToCloud(..., { replace: true })` on `startLife` / `resetLife`. Live Again must call `resetLife()`.
- **LLM:** Pass descriptive `context` to `generateDynamicEvent()`. Authenticated proxy only; keep prompts/model server-owned and never add silent static fallbacks.
- **Tests:** Prefer real exports over mirrors when possible. Substantive changes: `_agents/workflows/test-app.md` (`lint` → `test` → `build`).
- **Action audits:** `/audit-job-school`, `/audit-relationships`, `/audit-activities`, or orchestrate with `/audit-actions` (see `docs/agent-guide.md`).
- **Content:** Mature themes are by design — do not sanitize without explicit instruction.

Full detail lives in the three `docs/` SOT files above — keep them updated when you change behavior.
