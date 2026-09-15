# /audit-gamestate — Analyze Engine Extraction Opportunities

Identify the highest-value extraction candidates around `useGameState` without starting a refactor. Measure the current checkout; do not rely on a historical line count or a fixed number of returned values.

## Steps

1. Read [the architecture](../../docs/architecture.md), then measure and read `src/engine/gameState.js` in full. Count its current lines and returned state/commands. Follow imports into `src/engine/mechanics/`, `src/engine/annual/`, `src/engine/lifeSave.js`, and `src/engine/cloud/useCloudAccount.js` to establish what has already moved.

2. Map the remaining state and command boundaries by domain:
   - Career/education: eligibility, enrollment, hiring, startup, military, job actions
   - Investments/assets: purchase, sale, bank updates, catalog lookup
   - Relationships: NPC creation, gifts, marriage, breakup, custody, child support
   - Activities/health: costs, guards, yearly limits, stats, doctor actions
   - Life transitions: birth, death, reset, event resolution, hydration, persistence
   - Cloud transport: session adoption, linking/switching, loading, and saving

3. For each candidate, report:
   - Current file/line span and the exact functions involved
   - State it reads and writes, including cross-domain bank/stats/history dependencies
   - Async work, action locks, and persistence overrides that must remain coordinated
   - Existing pure helpers or transport boundaries it can use
   - Real-export or hook tests already covering it, plus gaps

4. Rank the top three candidates by interface clarity, duplicated logic, testability, and coupling. Do not rank by size alone or propose extracting helpers that have already moved. Favor a pure calculation when it has a clear input/output contract; retain React state and command coordination in `useGameState` unless another ownership model is explicitly justified.

5. Show proposed signatures, returned values, callers, and module locations. For a coupled action boundary, identify which work can move and which state commits, lock checks, or save decisions must remain together.

6. Flag functions whose extraction requires broader coordination. Explain the specific race, state dependency, or compatibility constraint, including life-boundary replacement and stable named exports.

## When to use

Run before an engine refactor and after each extraction to re-rank the remaining work. Use current source measurements rather than a fixed growth threshold.

## Constraints

- This audit is read-only. Report extraction recommendations; implement them only when the task also authorizes a refactor.
- `useGameState` remains the shared life-state owner. A domain name alone is not a reason to create another stateful hook.
- Keep game logic out of presentation components.
- The annual simulation already lives in `src/engine/annual/`; preserve calculation order and random draw order when considering further changes.
- Use `src/tests/mechanics/README.md` to distinguish real helper coverage from remaining copied formulas. Mirrored tests are technical debt, not proof that a command is wired correctly.
