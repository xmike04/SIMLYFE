# /new-sheet — Add a New Sheet Component

Add a gameplay panel using the existing sheet-routing and engine-command boundaries.

## Steps

1. Read `src/components/sheets/LotterySheet.jsx` and `src/components/ActionSheet.jsx`. Confirm the actual props: the wrapper accepts `title`, `onClose`, and children. Visibility is controlled by mounting the selected sheet; there is no required `isOpen` prop.

2. Read the current routing:
   - `src/components/MainGame.jsx` owns `activeSheet`, activity-menu selection, close/open callbacks, and frozen-state visibility.
   - `src/components/game/GameSheets.jsx` imports sheets and passes their state and handlers.
   - `src/components/sheets/ActivitiesSheet.jsx` handles category navigation and special-action dispatch.

3. Define the panel's purpose, state inputs, engine commands, and entry path. Resolve missing product choices from the task context before inventing behavior.

4. If new deterministic rules are needed, implement them in `src/engine/mechanics/` or `src/engine/annual/` with tests importing the real exports in `src/tests/mechanics/`. Add actual hook coverage for guards, persistence, and async interactions. Never create a test-local copy of the rule.

5. Create `src/components/sheets/[Noun]Sheet.jsx`. For example:

   ```jsx
   import ActionSheet from '../ActionSheet';

   export default function ExampleSheet({ value, onAction, onClose }) {
     return (
       <ActionSheet title="Example" onClose={onClose}>
         <button onClick={onAction}>Use {value}</button>
       </ActionSheet>
     );
   }
   ```

6. Register its render branch and explicit props in `GameSheets.jsx`. Wire its trigger through the appropriate existing screen or activity route. Reuse the shared `activeSheet` selection rather than introducing a separate visibility boolean for every panel. Preserve close/back behavior and the freeze while aging or resolving an event.

7. Add needed commands to `src/engine/gameState.js` and return them from `useGameState`. Keep presentation-only submenu/input state local to the sheet. For new persisted life fields, follow [new-mechanic](./new-mechanic.md#3-wire-state-and-persistence), including save defaults, hydration, validation, and Firestore rules.

8. Add component tests that click the real panel and verify its engine-command arguments, disabled state, and navigation. Generated-event actions should call the engine with a descriptive context; the sheet should not own a separate LLM transport.

9. Run `npm run lint`, `npm test`, and `npm run build`; run `npm run test:e2e` for the new browser flow. Check mobile layout and use [balance-check](./balance-check.md) if effects changed.

## When to use

Use this checklist when adding a gameplay panel. Keep the filename convention `[Noun]Sheet.jsx`, flat explicit props, and one engine owner for shared life state.
