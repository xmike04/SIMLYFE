# SIMLYFE - Agent Guide

This file is the entry point for AI coding agents (GitHub Copilot, Codex, etc.).

The full project guide - architecture, game mechanics, conventions, environment variables, and known issues - is in [`CLAUDE.md`](./CLAUDE.md). Read that file before making any changes.

## Key facts for agents

- **Framework:** React 19, Vite 8, pure CSS - no Tailwind, no UI libraries, no TypeScript
- **State:** All game logic lives in `src/engine/gameState.js` (`useGameState()` hook). Do not add state elsewhere.
- **Styling:** Use CSS variables from `index.css`. Follow the glassmorphism pattern already in use.
- **Tests:** Run `npm test` before and after changes. New mechanics go in `engine.mechanics.test.js` first as pure functions, then implemented in `gameState.js`.
- **Verification workflow:** For substantive app changes, follow `_agents/workflows/test-app.md`: `npm install`, `npm run lint`, `npm test`, then `npm run build`.
- **Sheets:** All gameplay panels are extracted into `src/components/sheets/`. Add new panels there, not inline in `MainGame.jsx`.
- **LLM events:** Pass a descriptive `context` string to `generateDynamicEvent()`. Do not add static event fallbacks - errors surface to the player by design.
- **Manual scripts:** `node scripts/test-llm.js` manually exercises the Supabase/OpenAI JSON event path and expects `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE` in `.env.local`; `node scripts/migrateData.js` pushes `src/engine/events.json` and `src/engine/careers.json` to Firestore and requires `scripts/serviceAccountKey.json` plus a temporary `npm install --no-save firebase-admin`.
- **Content:** This game contains intentionally mature themes (crime, violence, adult relationships, drug use). Do not sanitize or remove these.

See `CLAUDE.md` for the full reference.
