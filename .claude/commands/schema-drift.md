# /schema-drift — Detect Test and Save Contract Drift

Audit whether tests exercise the current production rules and whether the saved-life contracts stay aligned. This command reports findings; make fixes only when the task also authorizes them.

## Steps

1. Read [the mechanics test inventory](../../src/tests/mechanics/README.md). It lists tests of real exports, signature adapters, and remaining copied formulas. Locate the current tests in `src/tests/mechanics/` instead of relying on the former monolithic test file.

2. Map tested behavior to its production owner:
   - `src/engine/mechanics/`: stat effects, death, education, careers, investment transactions, relationships, and activity helpers
   - `src/engine/annual/`: composed year tick, belongings, relationship/NPC changes, and pets
   - `src/engine/gameState.js`: player commands, action locks, state commits, event timing, and persistence decisions
   - `src/engine/cloud/`: session and transport behavior plus account-input helpers
   - `src/config/`: catalogs, market rules, and wealth tiers

3. Inspect remaining mirrors and test adapters against those implementations:
   - Are constants, conditional ordering, edge cases, and random draw order equivalent?
   - Does the test ignore a new argument or returned field?
   - Does an adapter merely transform a call/read an output, or does it copy the rule?
   - Would changing the production rule cause the test to fail? If not, it does not establish production coverage.

4. Identify exported helpers or real command paths with no meaningful coverage. Recommend a direct-import test, a hook test, or a UI interaction test according to the boundary at risk. Do not recommend creating a new mirror to fill a gap.

5. Check saved-life schema alignment:
   - `src/engine/lifeSave.js`: `LIFE_SAVE_KEYS`, complete payload, and defaults
   - `src/engine/gameState.js`: initialization, clear/start/reset, hydration, and persistence overrides
   - `src/engine/stateValidation.js`: recognized current/legacy fields and warning behavior
   - `firestore.rules`: allowed write fields
   - `src/tests/firestoreRules.test.js`: drift coverage

6. Report:
   - **Drifted formulas or adapters:** production/test locations, scenario, and behavioral difference
   - **Missing production coverage:** untested helper, command, or UI boundary
   - **Save contract gaps:** omitted field, default, hydration, validation, or rules change
   - **Remaining mirror debt:** copied formulas still present, even if currently equivalent
   - **Fix order:** replace mirrors with tests of real exports or commands; isolate intentional behavior changes from extraction

## When to use

Run before extending a mechanics suite, after moving engine modules or changing saved fields, and when tests pass but the actual game behaves incorrectly.

## Constraints

- A mirror matching production today is still a maintenance liability. Do not call it proof of correct command wiring.
- Prefer importing an existing real helper. When logic is still embedded in a command, recommend a focused extraction or a real hook test instead of updating the copied formula as the long-term design.
- Preserve legacy save compatibility deliberately; do not silently coerce or migrate documents during a read-only audit.
- Test tax behavior inside a nonzero tax tier, and test both life-boundary replacement and ordinary mid-life writes.
