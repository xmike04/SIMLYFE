# /new-mechanic — Add a New Game Mechanic End-to-End

Implement a gameplay system from a defined rule through real tests, engine commands, and UI wiring.

## Steps

### 1. Define the rule and boundary

- Read [architecture](../../docs/architecture.md), [game mechanics](../../docs/game-mechanics.md), and [agent guide](../../docs/agent-guide.md).
- Inspect `src/engine/gameState.js` and the relevant modules in `src/engine/mechanics/` and `src/engine/annual/`.
- Define the trigger, inputs, outputs, costs, guards, and saved fields. Decide whether it runs on demand or inside the annual calculation.

### 2. Test the real calculation

- Define the production helper in the owning `src/engine/mechanics/` module, or a focused annual module when the rule belongs to a year tick.
- Add tests in the appropriate `src/tests/mechanics/` suite that import that actual export. Do not copy the calculation into the test.
- Cover meaningful boundaries: invalid inputs, zero/max values, affordability, state changes, and probability branches. Inject random values or a random function instead of making tests depend on uncontrolled draws.
- Confirm the test detects the missing or incorrect behavior, then implement the rule. Test adapters may translate signatures or inspect outputs; they must not reimplement the rule.

### 3. Wire state and persistence

- Keep shared life state and player commands in `useGameState`. Commands own action locks, React state commits, and persistence overrides.
- Integrate annual work into `src/engine/annual/advanceLifeYear.js` at the correct point. Preserve the existing order: tuition precedes salary/tax settlement; lifestyle cost uses the resulting balance.
- For a new saved field, update `src/engine/lifeSave.js` defaults and `LIFE_SAVE_KEYS`, hook initialization/clear/start/reset, `hydrateFromSave`, `src/engine/stateValidation.js`, and `firestore.rules`.
- Keep complete replacement writes at life boundaries. Mid-life `persistLife` overrides must include every field changed in the command.
- Test the actual command or hook where guards, async behavior, or save wiring can fail; a pure formula test cannot establish those behaviors.

### 4. Add config data if needed

- Add catalogs under `src/config/` and shape/reference checks in `src/tests/config.data.test.js`.
- Reuse existing catalog identifiers and domain helpers rather than introducing duplicate rules in UI code.

### 5. Add the UI

- For a dedicated panel, follow [new-sheet](./new-sheet.md).
- Activity items belong in `src/config/activities.js`; special-action dispatch belongs in `src/components/sheets/ActivitiesSheet.jsx`.
- `src/components/game/GameSheets.jsx` binds engine commands to sheets. MainGame retains screen-level selection and locking.
- Passive life-summary displays belong in `src/components/game/GameHeader.jsx` or the relevant existing view.

### 6. Integrate generated events if needed

- Pass a descriptive action context through the engine's event command.
- Extend the bounded projection in `src/engine/llmService.js` and the request/prompt contract in `supabase/functions/generate-event/contract.ts` together when the model needs a new state field.
- Keep provider calls and model settings server-owned. Do not add a browser-direct model call or silent static fallback.

### 7. Verify and document

- Run `npm run lint`, `npm test`, and `npm run build` in that order; run `npm run test:e2e` for changed browser flows.
- Run [balance-check](./balance-check.md) when stat or financial effects change.
- Run [schema-drift](./schema-drift.md) to identify copied-formula debt and missing production coverage, not to add more mirrors.
- Update the owning canonical document and record any remaining implementation or deployment gap.

## When to use

Use this checklist for a new economy, social, or progression system. Complete the calculation and persistence contract before building UI on top of it.
