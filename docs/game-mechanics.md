# SIMLYFE Game Mechanics

> **Source of truth #2 of 3.** Gameplay rules and systems.
> Also see [architecture.md](./architecture.md) and [agent-guide.md](./agent-guide.md).

Implementation lives primarily in `src/engine/gameState.js` and catalogs under `src/config/`.

## Core loop

1. Player clicks **+Age**.
2. `ageUp()` applies degradation, economy tick, income, investments, performance review, death check, then LLM event generation.
3. If an event fires, `currentEvent` is set and `EventModal` renders.
4. Player chooses; `handleChoice()` applies effects and appends history.

## Annual event pacing

- Age 0 is the birth history entry; no event modal is generated at character creation.
- Each surviving `ageUp()` requests at most one dynamic event.
- Ages 1-2 use small, plausible events such as illness, first milestones, attachment, a new sibling, or a family change. Choices reflect a very young child's limited agency and keep consequences mild.
- Ages 3-5 shift to lively early-childhood situations with distinct, age-plausible choices around preschool, friends, imagination, mischief, fears, talents, accidents, and family changes.
- Ages 6-12 use memorable school, friendship, rivalry, talent, family, moral-dilemma, and risky-opportunity hooks.
- Teen and adult events continue increasing agency and stakes according to the character's current life.
- From age 3 onward, annual events must include tension, surprise, opportunity, discovery, or relationship change. Routine recaps and lightly reworded recent events are disallowed by the LLM prompt.

## Stat degradation

- Health −1/year at age 30+, then −2/year at age 50+.
- Looks −1/year at age 50+.
- Grades (school ages 5–22) drift by smarts: +2/year above 70 smarts, −5/year below 40, else −1. Missing grades default to 70; an earned 0 stays 0.
- Other stats change only via events, activities, education, or assets.

## Death

- Health ≤ 0 → immediate death.
- Age 60+ → probability `(age - 60) / 40` (guaranteed by age 100).
- After death, **Live Again** → `resetLife()` → character creation → `startLife` (see [architecture.md](./architecture.md#death-restart-flow)).

### Wills & estate

- Activities → Wills (age 18+, min bank $200) drafts a will via `draftWill` → validated by `prepareWillDraft` (whole percents, known beneficiaries, no duplicates, total ≤ 100%) and persisted as `will`.
- Zero allocations = a standard will: even split among living relationships at death.
- On death, `DeathScreen` settles the estate with `computeEstateDistribution` over final net worth (cash + properties + belongings):
  - No will → the whole estate is taxed/donated ("unwilled").
  - Directed will → each living beneficiary receives their percentage; bequests to dead or departed beneficiaries lapse into the residue.
  - The unallocated residue is taxed/donated. Payouts never exceed the estate.

## Economy cycle

Phases with fixed durations: `normal` 3y → `boom` 2y → `recession` 2y → repeat. Affects investment returns and performance reviews.

## Wealth tiers

| Tier | Min Bank | Income Tax | CGT | Lifestyle Cost/yr |
|---|---:|---:|---:|---:|
| Broke | −∞ | 0% | 0% | $0 |
| Struggling | $1k | 10% | 10% | $0 |
| Working Class | $10k | 15% | 15% | $500 |
| Middle Class | $50k | 22% | 20% | $3,000 |
| Upper Middle | $250k | 28% | 23% | $10,000 |
| Wealthy | $1M | 35% | 28% | $40,000 |
| Rich | $10M | 40% | 33% | $150,000 |
| Ultra-Wealthy | $100M | 45% | 37% | $1,000,000 |

Tier affects gift amounts, date costs, relationship decay, and lifestyle pressure. Source: `src/config/wealthTiers.js`.

## Careers

- Standard ladder: `src/engine/careers.json` (`nextTierId`, `promotionRequirements`).
- Special careers: `src/config/specialCareers.js`.
- Each employed year runs `runPerformanceReview()`.
- Career `healthEffect` / `happinessEffect` values are stress-intensity scores. `normalizeCareerEffect()` converts every non-zero 8 points of intensity into roughly 1 annual stat point, preserving job differences without making ordinary careers lethal by age 40.
- **Military enlist:** Job → Military enlists into the `soldier` career (`MILITARY_ENLIST_CAREER_ID`) with Health 60+ / Athleticism 50+. Branch (Army/Navy/etc.) is history flavor; all start the same track.
- **Headhunter:** Job → Recruiter charges `HEADHUNTER_COST` ($1000) via `hireViaHeadhunter` and places into the highest-salary eligible `full_time` career (`pickHeadhunterPlacement`). Fee is charged even if no match is found.
- **Startup launch:** `startStartup` charges `STARTUP_COST` once. Re-launching while already a founder is blocked and does not reset equity or charge cash.

| Outcome | Effect |
|---|---|
| `promoted` | Next tier if requirements met; else treated as raise |
| `raise` | Salary × 1.05 |
| `no_change` | No effect |
| `pip` | PIP flag; next review penalized |
| `fired` | Career null, 2 years unemployment, happiness −30 |

Review roll uses smarts, health, karma, networking, PIP, financial stress, economy phase.

## Networking

Score 0–100 from mixers, conferences, jobs, events. Some tracks require a minimum.

## Education

`DEGREE_CONFIG` pipeline: `highSchool` → `associate` → `bachelor` → `master` → `phd`.

- **Tuition:** Year 1 is charged at enroll; `yearsInProgram` starts at `1`. Each later `ageUp` charges the next year’s tuition until completion. An N-year degree costs exactly N × annual tuition (not N+1).
- Progress field is `yearsInProgram` (not `yearsCompleted`).
- Completion unlocks careers and grants smarts/happiness bonuses.
- Career requirements are minimum education levels: bachelor and above satisfy an associate requirement; master and PhD satisfy lower-degree requirements.

## Assets

`src/config/assetCatalog.js`:

| Category | Behavior |
|---|---|
| `realEstate` | ~3–6%/yr appreciation; market-sensitive |
| `vehicles` | ~8–20%/yr depreciation (exceptions exist) |
| `luxury` | Slow hold/gain ~2–8%/yr |
| `investments` | `returnProfile` + economy phase |

Stores: `src/config/storeCatalog.js` (tier-gated listings).

## Investment market

| Sub-type | Key mechanic |
|---|---|
| `crypto` | High volatility; ≥1.5 vol can moonshot 50×–1000× |
| `stocks` | Drift + volatility; sector tags |
| `penny` | 12% bankrupt, 10% moonshot, else ±50% |
| `bonds` | Coupon/year; matures after N years |
| `funds` | `returnProfile` annual **paper** return (mark-to-market on `currentValue` only; not also paid as cash) |

`getMarketHealth()` → Bullish / Mixed / Bearish by sub-type and phase (`src/config/investmentMarket.js`).

Saved investment sub-types are canonical singular IDs: `crypto`, `stock`, `penny_stock`, `bond`, and `fund`. Legacy plural UI/save values are normalized before purchase and annual processing. Invalid instruments, sub-types, and non-finite amounts are rejected without mutating life state.

## Legacy mini-games

| Mechanic | Details |
|---|---|
| Lottery | $5/ticket, 0.001% win, $10M jackpot |
| Gambling | $100 bet, 45% win, 2× return |
| Day trading | $1000; 40% lose all, 20% half, 20% +50%, 15% +100%, 5% +400% |
| Startup equity | 20% bankrupt, 30% ×0.8, 30% steady, 20% ×3 |
| Real estate legacy | 5% crash, 10% boom/year |

## Relationships & pets

- Relationships age and decay if ignored; romance can auto-break; elders can die; jealousy with multiple partners.
- **Dating App / `addRelationship`:** NPCs are normalized with `status: 'dating'` and `isAlive: true` via `normalizeRelationshipNpc` so Date / Propose / Child / Break Up unlock.
- **Divorce / breakup:** `breakUp` and auto-break use `markAsEx` → `status: 'ex'`, `type: 'Ex'` so leftover `type: 'Spouse'` cannot keep romance UI or death-summary spouse display.
- **Spouse display:** `findSpouse` matches `status === 'married'` (alive), not leftover `type: 'Spouse'` after divorce.
- Pets age, cost upkeep, grant happiness; can die.

## Activities

- Catalog: `src/config/activities.js`. Items with `yearlyLimit` share track ids `categoryId__itemText` via `yearlyActivityTrackId`.
- Gym / Run (`specialAction` gym/run) call `consumeYearlyActivity` before training; UI locks with “Done this year” after use.
- Other limited activities go through `performActivity`, which uses the same track helpers.

## Content tone

Intentionally mature themes (crime, violence, adult relationships, drugs). Do not sanitize without explicit instruction.
