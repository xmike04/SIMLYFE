# SIMLYFE Agent Guide

> **Source of truth #3 of 3.** Contribution rules and extension patterns.
> Read [architecture](./architecture.md), then [game mechanics](./game-mechanics.md), then this guide.

Root [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md) are short entry points. Update the document that owns a fact instead of copying its details into every entry point.

## Hard constraints

- Frontend: React 19 functional components, JavaScript/JSX, Vite 8, pure CSS. Do not introduce TypeScript, Tailwind, or UI libraries. The existing Supabase edge function uses TypeScript.
- Keep one shared state owner: `useGameState()` orchestrates life state and commands. Extract calculations into the appropriate `src/engine/mechanics/` or `src/engine/annual/` module.
- Pure helpers return values. Keep React setters, cloud writes, and network calls in their owning hooks or services.
- Gameplay panels belong in `src/components/sheets/`; keep MainGame focused on the game screen and navigation.
- Static styles belong in `src/index.css`; computed values can use inline styles.
- Pass a descriptive `context` to `generateDynamicEvent`. Keep prompts and model settings in the server contract. Do not add browser-direct OpenAI calls or silent static fallbacks.
- Mature content is intentional. Do not sanitize it without an explicit request.

## Before changing code

1. Read the owning implementation and its callers. For a mechanic, inspect both its engine command and its visible UI action.
2. Check the working tree and preserve unrelated changes.
3. Identify the observable behavior and persistence boundary that must remain stable.
4. Add or update meaningful tests of real exports where behavior can regress.
5. Run the [development checks](./development.md#required-checks) and update the relevant canonical document in the same change.

For a large refactor, keep a written plan with bounded phases and evidence. The current extraction plan and validation ledger are in [refactor-plan.md](./refactor-plan.md).

## Extension map

| Change | Start here | Keep aligned |
|---|---|---|
| Activity | `src/config/activities.js`: `ACTIVITY_CATEGORIES`, `ACTIVITY_MENUS` | Special-action routing in ActivitiesSheet, yearly consumption, descriptive event context |
| Standard career | `src/engine/careers.json` | Eligibility, next-tier requirements, performance review |
| Special career | `src/config/specialCareers.js` | Engine command, actual cost, UI disabled state |
| New gameplay panel | `src/components/sheets/` | GameSheets routing and action locking |
| Annual mechanic | `src/engine/annual/`, supporting domain helper | Tick ordering, injected randomness, full annual save |
| New saved field | `src/engine/lifeSave.js` | Hydration, reset defaults, validation, Firestore allowlist |
| AI event request | `src/engine/llmService.js` | Bounded client projection and server contract |
| Static event | `src/engine/events.json` | `id`, `description`, `ageRange`, and choices with text/effects |

Existing `gameState.js` named exports remain compatible with existing callers. New tests and domain modules should import the implementation owner directly when practical; do not create duplicate implementations just to test them.

## Persistence and account invariants

- `startLife` and `resetLife` must use `buildLifeSave` plus `syncToCloud(..., { replace: true })`. Include every save field, especially `career`, `pets`, and `isDead`.
- Death UI calls `resetLife`, never bare `location.reload()`.
- Mid-life commands use `persistLife(overrides)` with every field changed in that command. React state may not have flushed when the save is built.
- Add persisted fields to the Firestore write allowlist and save-validation contract. The drift test must keep those contracts aligned.
- Account commands use the shared cloud account hook. Preserve link-first anonymous upgrades and explicit account-switch hydration.
- Validate email credentials before provider calls. Bootstrap and explicit sign-out own anonymous-session creation; sheets must not replace persisted sessions themselves.
- Sign-out and account switching must not write or delete the previous account's save.
- Support requests remain separate from life saves. A request acknowledgment is
  not account deletion; keep the in-app report flow from resolving an event.
  Test support permissions against the real rules with `npm run test:rules`.
- Android Google must keep `skipNativeAuth: true` and link through the shared JS
  Auth user. Back may close panels or background the app; it must never reload or
  reset a life. Follow the [Android runbook](./android.md) for native verification.

See [architecture](./architecture.md#life-state-and-save-contract) for the complete data flow.

## Domain invariants

- **Education:** use `yearsInProgram`; charge year-one tuition at enrollment. Both eligibility and headhunter placement use `hasRequiredDegree` for minimum career requirements.
- **Recruiter:** `hireViaHeadhunter` charges `HEADHUNTER_COST`, including an unsuccessful placement. An LLM event alone does not perform placement.
- **Startup:** `startStartup` owns `STARTUP_COST` through `computeStartupLaunch`. The UI must not debit separately, and an existing founder must not relaunch or reset equity.
- **Military:** route enlistment through `enlistMilitary`, which sets the `soldier` career. Branch text is flavor.
- **Relationships:** use `normalizeRelationshipNpc` when adding dating NPCs, `markAsEx` for breakup/divorce, and `findSpouse` for a living current marriage.
- **Yearly activity limits:** special skills such as gym/run must consume the same tracker used by ordinary activities. Preserve `categoryId__itemText` IDs.
- **Investments:** purchases go through `prepareInvestmentPurchase`; normalize subtype aliases before mutation. Paper returns on investment belongings change asset value without also crediting bank.
- **Gambling:** use `computeGambleResult` so malformed amounts cannot corrupt bank state.
- **Wills:** validate with `prepareWillDraft`, persist through `draftWill`, and settle with `computeEstateDistribution`.

## Test design

- Test real helpers, commands, and components. Avoid local replicas of the implementation.
- Inject random values or random functions into pure calculations; keep the production order and number of random draws stable when extracting a tick.
- Use a bank inside a taxed wealth tier when testing income tax. A 0% tier cannot prove that a deduction happened.
- Test life-boundary replacement and account changes separately from ordinary mid-life saves.
- Test interaction locking across the asynchronous event request, not only the final rendered result.
- LLM tests that change environment variables must call `vi.resetModules()` and `vi.stubEnv()` before importing the client.
- [setup.js](../src/tests/setup.js) mocks Firebase and the LLM client by default. A passing mocked suite does not prove live cloud connectivity.

Commands, coverage locations, and browser verification belong in [development.md](./development.md).

## Action-tree audits

| Command | Skill under `.agents/skills/` | Coverage |
|---|---|---|
| `/audit-job-school` | `simlyfe-job-school` | Jobs, education, recruiting |
| `/audit-relationships` | `simlyfe-relationships` | Relationships, dating, NPC annual updates |
| `/audit-activities` | `simlyfe-activities` | Activity menus and special panels |
| `/audit-actions` | Orchestrating command | All three audits and combined findings |

Use these after sheet/engine changes or when hunting unwired actions. Audits are read-only unless the task also authorizes fixes. See [the documentation index](./README.md) for ownership and [operations](./operations.md) for live-service checks.
