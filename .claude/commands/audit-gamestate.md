# /audit-gamestate — Analyze gameState.js for Extraction Opportunities

`src/engine/gameState.js` is ~1687 lines and returns 50+ values from a single hook. This command identifies the highest-value extraction candidates without requiring a full refactor.

## Steps

1. Read `src/engine/gameState.js` in full.

2. Group all functions and state by domain:
   - Career: hiring, firing, performance review, salary, PIP, promotion
   - Education: degree enrollment, tuition, completion, stat bonuses
   - Investments: market positions, buy/sell, annual returns, moonshot logic
   - Relationships: NPC management, aging, decay, gifts, dating
   - Assets: purchase, upkeep deduction, appreciation/depreciation
   - Economy: cycle tick, phase transitions, wealth tier calculation
   - Health/Death: stat degradation, death probability, doctor actions

3. For each domain, report:
   - How many lines it spans
   - Whether it reads/writes state from other domains (coupling score)
   - Whether it could be a standalone `useX()` hook with no breaking changes

4. Identify the top 3 extraction candidates — those that are largest, least coupled to other domains, and have the clearest interface boundary.

5. For each candidate, show the exact function signatures that would move and what the new hook's return value would look like.

6. Flag any functions that are so entangled they cannot be extracted without a larger refactor — explain why.

## When to use
Run this before starting any refactor of `gameState.js`. Run it again after each extraction to re-rank the remaining candidates. Good to run every 200+ lines of new logic added to the hook.

## Tips & tricks
- Do not start extracting during this audit — it's a planning pass only. Extraction in the same session often creates scope creep.
- The safest first extraction is usually `useEducation` — it has a clear entry point (`enroll`) and clear outputs (`education` state + tuition deduction).
- Coupling score matters more than size. A 300-line domain that only touches its own state is safer to extract than a 100-line one that reads `career`, `bank`, and `stats` all at once.
- After extraction, the parent `useGameState` should just re-export the sub-hook's values — no logic should move to components.
