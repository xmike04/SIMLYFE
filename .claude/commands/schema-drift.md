# /schema-drift — Detect Test Mirror Drift

Engine tests in `src/tests/engine.mechanics.test.js` copy game logic from `gameState.js` as pure functions. These mirrors silently diverge when the originals change. This command finds the gaps.

## Steps

1. Read `src/engine/gameState.js`. Extract the logic for these known-mirrored functions:
   - Stat clamping (0–100 bounds)
   - Death probability formula (`age >= 60` curve)
   - Stat degradation per year (health, looks)
   - Career income after tax (wealth tier tax rate applied to salary)
   - Performance review roll calculation
   - Startup equity outcomes
   - Relationship decay formula
   - Day trading outcome probabilities
   - Lottery win check
   - Wealth tier lookup from bank balance

2. Read `src/tests/engine.mechanics.test.js`. Find the corresponding pure-function implementations used in tests.

3. For each mirrored function, diff the logic:
   - Are the constants the same? (tax rates, probability thresholds, multipliers)
   - Are the conditionals in the same order?
   - Are edge cases handled the same way?
   - Has a new parameter been added to the real function that the test mirror ignores?

4. Also check: are there functions in `gameState.js` that should be tested but have no mirror in `engine.mechanics.test.js` at all?

5. Output a drift report:
   - **Drifted**: list each function where the mirror differs from the source, with a description of the difference
   - **Missing**: list functions that exist in gameState.js but have no test mirror
   - **Clean**: list mirrors that are accurately in sync
   - Recommend whether each drift is a test bug (mirror needs update) or a source bug (logic changed silently)

## When to use
Run this before writing new tests to avoid building on a stale mirror. Run after any significant change to `gameState.js`. Run whenever a test passes but the game behaves incorrectly in the browser — this is the most common cause.

## Tips & tricks
- Test failures are obvious. Drift is silent — a mirror can be wrong for months while all tests pass. This command exists precisely because of that.
- Treat drift as a bug, not a cosmetic issue. The whole point of the mirror pattern is exact fidelity to production logic.
- If a mirrored function has drifted because the real function was intentionally changed, update the test mirror immediately — don't defer it.
- Pay special attention to wealth tier tax rates in `wealthTiers.js` — these change more often than the test mirrors get updated.
