# /new-mechanic — Add a New Game Mechanic End-to-End

Full checklist for implementing a new gameplay system in SIMLYFE — from design to tests to UI.

## Steps

### 1. Design (read before touching code)
- Read `src/engine/gameState.js` to understand what state already exists and what the new mechanic might reuse.
- Read `docs/game-mechanics.md` and `docs/agent-guide.md` to ensure the new mechanic fits the existing model.
- Define clearly: What state does it add? What triggers it? What does it modify? Does it run every year (in `ageUp`) or on demand?

### 2. State (gameState.js)
- Add new state variable(s) via `useState` at the top of `useGameState()`.
- If it runs annually, integrate it into `ageUp()` at the correct position relative to existing logic (order matters — income before tax before lifestyle cost, etc.).
- If it's on-demand, add a new function and include it in the return object.
- If the new state must persist: add it to `LIFE_SAVE_KEYS` / `buildLifeSave` and every life-boundary replace; mid-life syncs still use merge — see `docs/architecture.md`.

### 3. Tests first (engine.mechanics.test.js)
- Before the UI exists, write pure-function mirrors of the new logic in `src/tests/engine.mechanics.test.js`.
- Cover: happy path, edge cases (zero values, max values, invalid inputs), any probability/RNG paths (seed the Math.random mock).
- Run `npm test` — the new tests should fail until implementation is complete.

### 4. Config data (if needed)
- If the mechanic introduces a new catalog (items, tiers, types), add a file to `src/config/`.
- Add shape validation for it in `src/tests/config.data.test.js`.

### 5. UI
- If the mechanic needs a dedicated panel: follow `/new-sheet` checklist.
- If it's a single action: add it to the appropriate `ACTIVITY_MENUS` entry in `src/config/activities.js` and handle the `specialAction` in `MainGame.jsx`.
- If it shows passive state (e.g., a score or counter): add it to the stats display area in `MainGame.jsx`.

### 6. LLM integration (if needed)
- If actions should generate AI events, pass a specific `context` string to `generateDynamicEvent()`.
- Update the prompt in `supabase/functions/generate-event/index.ts` if the new mechanic should influence how the LLM generates events (e.g., "player has X, which affects Y").

### 7. Verify
- Run `npm test` — all tests including new ones should pass.
- Run `npm run build` — no type or import errors.
- Run `/balance-check` if any stat effects were added.
- Run `/schema-drift` to confirm mirrors are accurate.

## When to use
Use this as a living checklist any time you're building a new system from scratch (new economy mechanic, new social system, new progression track, etc.). Work through each numbered step in order — don't skip to UI before tests.

## Tips & tricks
- The order in `ageUp()` matters. Salary income should run before tax deduction, which should run before lifestyle cost. Adding a new annual deduction in the wrong position can cause subtle balance bugs.
- If the mechanic has RNG, mock `Math.random` in tests to cover all probability branches deterministically.
- New state that isn't initialized in `startLife()` will be `undefined` on new games — always add it to the initial state object.
- Keep the mechanic's logic self-contained in `gameState.js` first. Only after the logic is tested should you build the UI on top of it.
