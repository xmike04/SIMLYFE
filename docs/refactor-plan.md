# Codebase and documentation refactor

Requested scope: plan and execute a large refactor while retaining the existing game, framework, saved lives, and authenticated service contract.

Baseline: `a49a1ca`; implementation branch: `codex/refactor-engine-and-docs`.

## Phases and evidence ledger

| Phase | Deliverable | Dependency | Status |
|---|---|---|---|
| 1 | Baseline, domain audit, and compatibility contract | None | VERIFIED: lint, 1,337 tests in 19 files, production build pass before edits |
| 2 | Mechanics modules and canonical life serialization | 1 | VERIFIED: historical exports and 17-key save contract retained; existing helper tests pass |
| 3 | Annual simulation modules and tests of production rules | 2 | VERIFIED: 30 seeded original/refactored hook comparisons; 9 annual composition tests |
| 4 | Focused gameplay panels and asset views | 1; stable engine API | VERIFIED: 11 UI tests pass before/after; 32 rendered screen states match; desktop/mobile first-run checks pass |
| 5 | Canonical documentation, development/operations guides, usable LLM probe | 2–4 for final paths | VERIFIED: documentation check passes; 3 real-script tests verify Origin/auth headers and missing configuration |
| 6 | Independent review, full checks, browser evidence, final metrics | 2–5 | VERIFIED: no blocking review findings; lint, 1,371 tests in 42 files, build, documentation check, and both browser projects pass |

## Baseline audit

| Area | Original size | Coupling and chosen boundary |
|---|---:|---|
| `src/engine/gameState.js` | 2,741 lines | State owner, pure rules, annual simulation, cloud lifecycle, and actions share one file |
| Existing mechanics/defaults | First 663 lines | Low coupling: stat/education/career/investment/relationship/estate rules can move directly |
| Annual transition | About 550 lines | High coupling across domains; separate synchronous calculation from async orchestration |
| Cloud boot/save/account handling | About 440 lines | High lifecycle coupling; extraction requires account/load/reset integration tests |
| `src/components/MainGame.jsx` | 534 lines | Header, sheet routing, activity menus, developer controls |
| `src/components/sheets/AssetsSheet.jsx` | 681 lines | Shopping, portfolio, details, and investment views |
| `src/tests/engine.mechanics.test.js` | 3,788 lines | Mixed domains and copied rules that already differ from runtime |

Career actions also change cash, stats, history, networking, and education eligibility. Relationships change cash/stats/history and can open custody events. Asset actions change cash and history. These mutations remain coordinated by the main hook; independent state stores would make their interactions harder to follow.

### First extraction candidates

1. `advanceBelongingsYear(belongings, stats, options)` → holdings, updated stats, upkeep, coupon income, bond maturities. This replaces duplicated investment processing in tests.
2. `advanceRelationshipsYear(relationships, stats, options)` and `advancePetsYear(pets, options)` → next entities and annual effects/history, with supplied randomness.
3. Existing named pure helpers, including education, salary/lifestyle, estate settlement, and `buildLifeSave(fields)` → domain modules without changing signatures.

## Compatibility contract

- React 19, Vite, JavaScript, and existing CSS remain the stack. `useGameState()` remains the game state owner.
- Preserve the public hook methods and historical named exports from `gameState.js`.
- Preserve all **17** `LIFE_SAVE_KEYS` and `users/{uid}/saves/currentLife`. Start/reset replace complete documents; ordinary actions merge complete snapshots.
- Preserve annual order: grades/economy/education → aging → income/lifestyle/review → property/belongings → child support/pets → relationships/NPCs → death → authenticated LLM → history/persist.
- Preserve random draw order, including skipped branches. Supply RNG dependencies to calculation helpers so deterministic tests exercise production logic.
- Preserve UI state lifetime, labels, styling, activity limits, frozen controls, and navigation.
- Preserve server-owned prompts/model, quotas, Firebase token validation, and visible LLM failures.
- No balance changes, new gameplay, schema migration, dependency upgrade, credential changes, or production publication as part of this structural pass.

## Known baseline discrepancies

The old investment-test mirror credits fund paper returns to cash, unlike production. The crypto-test mirror applies boom trend once, while production applies it twice. The performance-review mirror also differs in text and financial-stress handling. Replacement tests must call production rules and retain existing runtime semantics.

Additional baseline behavior to keep visible: annual LLM requests use pre-tick relationships/pets; hydration does not restore flags. These require explicit follow-up behavior changes, not incidental edits during extraction.

## Verification

Run `npm run lint` → `npm test` → `npm run build`, then `npm run test:e2e`. Add targeted tests for extracted annual calculations, preserved RNG order, cloud save boundaries/account changes, and sheet routing. Independently review the complete diff. Validate documentation paths and commands against the finished tree. Record final metrics and distinguish local verification from deployment.

## Results

| Original concentration | Before | After |
|---|---:|---:|
| Game state owner | 2,741 lines | 1,273 lines |
| Main game screen | 534 lines | 166 lines |
| Assets navigation | 681 lines | 108 lines |
| Mechanics tests | One 3,788-line file | 19 domain suites; largest 343 lines |

Calculations now live in seven mechanics modules, the canonical life-save module, and four annual modules. Firebase bootstrap/account/save transport lives in `cloud/useCloudAccount.js`. The state owner retains the public commands, lifecycle boundaries, async event handling, and explicit persistence decisions.

The test reorganization preserves 465 mechanics cases. It retires 18 copied calculations; remaining legacy formula tests are inventoried in [the mechanics test README](../src/tests/mechanics/README.md). Thirty-four additional permanent cases cover UI navigation, cloud lifecycle, annual composition, and the manual probe.

### Compatibility evidence

- Compared original `a49a1ca` and extracted hooks across 30 deterministic scenarios: career/founder/elder cases, ten seeds each, up to 14 annual steps. Full saved fields, histories, event values, and LLM input objects matched. The audit warmed the renderer and SDK before seeded runs so one-time library initialization did not consume gameplay randomness. Temporary baseline copies were removed after comparison.
- The 11 cloud lifecycle tests passed against both original and extracted hooks. They cover persisted-session adoption, guest creation, delayed boot loads, complete replacement/merge writes, Google/email linking and switching, sign-out, and mutation locking during an event request.
- The 11 UI tests passed against both old and new components. Separate comparisons matched DOM elements, text, and styles across 32 screen states, controlling market randomness and ignoring attribute order/empty style attributes.
- Independent review compared 52 unchanged helper declarations and 54 unchanged command/cloud declarations by syntax tree. It found no blocking regression; its one minor architecture wording correction was applied.
- The browser suite completes creation, 18 annual events, and all four core sheets in desktop Chrome and a Pixel 7 viewport. It checks authentication-header separation and absence of horizontal page overflow. Gameplay/assets screenshots are written under `test-results/`; animations are completed before capture.
- A local browser using the real configured Firebase/Supabase services created a separate `Refactor Check` life, generated and resolved an authenticated AI event, and restored the same age, stats, and event history after reload. The browser reported no warning/error logs. This verifies the refactored local client against the existing services; it is not a production frontend deployment.

### Scope and remaining boundaries

The implementation and local verification above were completed on `codex/refactor-engine-and-docs` before PR publication. Merge and deployment receipts must be checked separately; this ledger does not establish that a later production build passed live acceptance. The earlier production baseline is recorded in [operations](./operations.md#recorded-production-baseline).

After extraction, the largest remaining concentration is the hook's cross-domain commands: relationship/custody actions, asset transactions, and general activities. A future extraction should move their complete state transitions with hook-level persistence tests, rather than splitting them into independent state owners. The cloud hook is 345 lines and the annual coordinator is 239 lines; their lifecycle/order contracts now have dedicated tests.
