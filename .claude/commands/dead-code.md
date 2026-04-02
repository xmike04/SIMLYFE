# /dead-code — Find Unused Code and Dead Paths

Identify exports, state variables, functions, and config entries that are defined but never referenced anywhere in the codebase.

## Steps

1. Read `src/engine/gameState.js`. Check the `return` statement at the end of `useGameState()`:
   - For each returned value and function, search for usages in `src/components/` (MainGame.jsx, all sheets, App.jsx).
   - Flag any returned item with zero usages in components — it's dead return value.
   - Flag any internal function that is defined but never called within the hook itself or the return.

2. Read `src/config/activities.js`. For each `specialAction` string defined in `ACTIVITY_MENUS`:
   - Search `MainGame.jsx` for that string in a `switch` or `if` block.
   - Flag any `specialAction` with no matching handler — it fires into nothing.

3. Read `src/config/specialCareers.js`. For each career's `actions` array:
   - Check that each action's `specialAction` string (if any) is handled in the sheet or `MainGame.jsx`.
   - Flag unhandled actions.

4. Read `src/engine/events.json`. Check for:
   - Events with `ageRange` values that can never fire given the death-at-100 cap (e.g., `[101, 120]`).
   - Duplicate event IDs.
   - Events referencing stat keys that don't exist in the game (typos like `"hapiness"` or `"luck"`).

5. Read `src/engine/careers.json`. Check for:
   - Jobs with `nextTierId` pointing to a career ID that doesn't exist in the file.
   - Jobs with `minAge` greater than the death cap.
   - Careers in a `sector` not referenced anywhere in the UI.

6. Scan all files in `src/components/` and `src/config/` for:
   - `import` statements where the imported symbol is never used in the file.
   - `const` declarations that are never referenced below them.

7. Output a dead code report:
   - **Dead returns**: gameState functions/values returned but never consumed
   - **Orphaned actions**: specialAction strings with no handler
   - **Broken references**: nextTierId/career IDs that point nowhere
   - **Bad event data**: ageRange, stat key, or ID issues in events.json
   - **Unused imports**: file:line for each

## When to use
Run this before a major refactor or before cutting a release. Run whenever `gameState.js` or `activities.js` gets a significant update, since those are the most common sources of orphaned references. Not needed to run frequently — quarterly or per major feature is enough.

## Tips & tricks
- Dead returns in `useGameState` are harmless but add noise — they make the hook harder to understand.
- Orphaned `specialAction` strings are silent bugs — the activity fires but nothing happens, which looks like a broken feature to the player.
- `events.json` stat key typos are a common source of "why isn't this choice doing anything" bugs. The game silently ignores unknown keys.
- Don't delete dead config entries without confirming they're not referenced in tests — `config.data.test.js` may test for their existence.
