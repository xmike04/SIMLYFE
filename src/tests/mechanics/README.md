# Mechanics regression suites

The former `src/tests/engine.mechanics.test.js` is organized here by domain.
Run the complete group with `npx vitest run src/tests/mechanics`.

Production helpers are imported directly from `src/engine/mechanics/`,
`src/engine/annual/`, `src/engine/lifeSave.js`, and `src/engine/cloud/authHelpers.js`.
The existing global test setup remains in `src/tests/setup.js`.

| Suites | Responsibility |
|---|---|
| `life-state` | Effects, death, degradation, birth stats, save documents, grades |
| `career-income`, `career-review`, `startup` | Income, tax, lifestyle, city modifiers, economy phases, reviews, startup outcomes |
| `education-career-entry` | Tuition, degree completion, job requirements, headhunter placement, military entry |
| `activities`, `finance-games` | Yearly activity limits, effects, gambling, day trading, remaining activity mirrors |
| `relationships-core`, `relationships-annual` | NPC normalization, spouse lookup, annual decay, breakup, elders, jealousy, pets, NPC autonomy |
| `estate`, `account-input` | Will validation/distribution and sanitized account input/identity summaries |
| `property-market`, `investment-annual`, `investment-trading` | Asset valuation, bonds, stock/crypto/penny-stock annual processing, purchase validation, sale settlement |
| `wealth-tiers`, `asset-catalog`, `market-catalog` | Catalog shape, tier boundaries, market metadata |
| `economy-integration`, `portfolio-integration` | Interactions among tiers, assets, investments, cash, and relationships |

## Adapters and remaining mirrors

An adapter changes a test call's signature or reads a production result. It
does not repeat the rule being tested. For example, `processInvestmentYear`
wraps one instrument in a batch for `advanceBelongingsYear`; `calcCryptoYear`
supplies the production draw order: crash, moonshot, then branch-specific roll.
Fund return tests require paper gains/losses to change asset value with zero
cash income.

The following legacy mirrors remain because those calculations still live
inside hook actions or presentation components. Their tests are explicitly
labeled or commented as mirrors; passing them does **not** establish that the
production action is wired correctly. Prefer testing an exported rule or the
real hook when extending these areas.

| Location | Remaining copied calculations |
|---|---|
| `finance-games.test.js` | Lottery payout |
| `activities.test.js` | Activity guard, affordability, hidden-skill gain |
| `relationships-core.test.js` | Relation-score adjustment, dating probability |
| `relationships-annual.test.js` | Mood labels, marriage eligibility, custody result, child-support arithmetic |
| `investment-annual.test.js` | Bond/coupon history-string composition |
| `support/relationships.js` | Divorce cost, shared by existing formula tests |
| `support/investments.js` | Net-worth aggregation, shared by existing integration formula tests |

New annual tests exercise actual relationship, pet, and investment batch
outputs. They replace the old copied probability/decay implementations rather
than testing the copies alongside production code.
