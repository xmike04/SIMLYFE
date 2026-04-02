# /new-sheet — Add a New Sheet Component

Step-by-step checklist for adding a new gameplay panel (sheet) to SIMLYFE, following the established pattern.

## Steps

1. Read an existing simple sheet for reference — `src/components/sheets/LotterySheet.jsx` is a good baseline. Note:
   - Props it receives (always: `isOpen`, `onClose`, plus any game state/methods it needs)
   - How it uses `<ActionSheet>` as the wrapper
   - How it calls `generateDynamicEvent()` for LLM-driven actions
   - How it calls game state methods vs reads state

2. Read `src/components/ActionSheet.jsx` to understand the wrapper API.

3. Read `src/components/MainGame.jsx` to understand:
   - How existing sheets are imported at the top
   - How sheet open/close state is managed (`useState` booleans, one per sheet)
   - Where sheet components are rendered at the bottom of the JSX
   - How the sheet trigger button is wired in the activities/actions area

4. Ask: what is the name of the new sheet? What game state does it need to read? What methods does it need to call? What actions should it offer — LLM-driven, deterministic, or both?

5. Create `src/components/sheets/[SheetName]Sheet.jsx` following the exact prop pattern:
   ```jsx
   export default function [SheetName]Sheet({ isOpen, onClose, /* game state props */ }) {
     return (
       <ActionSheet isOpen={isOpen} onClose={onClose} title="Sheet Title">
         {/* content */}
       </ActionSheet>
     );
   }
   ```

6. In `MainGame.jsx`:
   - Add `import [SheetName]Sheet from './sheets/[SheetName]Sheet'`
   - Add `const [show[SheetName], setShow[SheetName]] = useState(false)`
   - Add `<[SheetName]Sheet isOpen={show[SheetName]} onClose={() => setShow[SheetName](false)} ... />` near the other sheet renders
   - Add the trigger button in the appropriate activity category

7. If the sheet needs new game state or methods, add them to `src/engine/gameState.js` and return them from `useGameState()`.

8. If the sheet has deterministic mechanics, add pure-function mirrors and tests to `src/tests/engine.mechanics.test.js` before implementing.

9. Run `npm test` and `npm run build` to confirm no regressions.

## When to use
Run this command any time you're about to add a new gameplay panel. Use it as a live checklist — work through each step in order. Do not skip step 8 (tests first for deterministic logic).

## Tips & tricks
- Keep props flat — don't pass the entire game state object. Explicitly list only what the sheet needs.
- LLM-driven actions in sheets should always pass a specific `context` string describing the action, not a generic one. The more specific, the better the event quality.
- If the sheet has tabs or sub-modes, manage that state locally inside the sheet — don't add it to `useGameState`.
- Name the file exactly `[Noun]Sheet.jsx` (e.g., `PrisonSheet.jsx`, `TherapySheet.jsx`) — no `Panel`, `Modal`, or `Screen` suffixes.
- After adding the sheet, run `/balance-check` if any new stat effects were added.
