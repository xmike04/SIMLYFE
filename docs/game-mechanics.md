# SIMLYFE Game Mechanics

> **Source of truth #2 of 3.** Implemented gameplay rules and catalog ownership.
> See [architecture](./architecture.md) for state boundaries and the [agent guide](./agent-guide.md) for contribution rules.

The engine orchestrates player actions in [gameState.js](../src/engine/gameState.js), calculates domain outcomes in `src/engine/mechanics/`, and composes annual changes in [advanceLifeYear.js](../src/engine/annual/advanceLifeYear.js). Values below describe game rules, including preserved legacy behavior.

## Core loop

1. The player selects **+Age**. Mutating actions and sheets lock while the transition runs.
2. The annual calculation advances grades and economy, grants the high-school diploma when due, charges degree tuition, applies aging, income, lifestyle costs, and career review, then processes assets, family obligations, pets, and relationships.
3. The engine commits the calculated life state and checks death.
4. A surviving life requests one dynamic event. The player chooses, `handleChoice` applies effects, and the history/save update.
5. Annual activity counters reset for the new year. An open event continues to lock other mutations until resolved.

Calculation order affects outcomes. For example, tuition changes the balance before income tax is calculated; income changes the balance before lifestyle costs are chosen. This order is part of the current behavior.

## Annual event pacing

The server-owned [age guidance](../supabase/functions/generate-event/contract.ts) supplies the prompt contract:

- Age 0 is the birth history entry; character creation does not request an event.
- Each surviving age transition requests at most one dynamic event.
- Ages 1–2 use mild, plausible events around milestones, attachment, illness, siblings, or family changes, with limited child agency.
- Ages 3–5 introduce distinct choices around preschool, friends, imagination, mischief, fears, talents, accidents, and family changes.
- Ages 6–12 use school, friendship, rivalry, talent, family, moral dilemmas, and risky opportunities.
- Teen and adult events increase agency and stakes according to the current life.
- From age 3, prompts require tension, surprise, opportunity, discovery, or relationship change and discourage routine recaps or repeats of recent history.

These are generation instructions, not a guarantee that every model response satisfies the intended pacing. Requests and effect envelopes are validated; narrative quality still needs playtesting. Service failure surfaces a visible error event instead of a silent static substitute.

## Stats and death

| Rule | Implemented behavior |
|---|---|
| Aging at next age 31–50 | Health −1 per year |
| Aging at next age 51+ | Health −3 total per year: the existing −1 plus another −2; looks −1 |
| Grades at ages 5–22 inclusive | Smarts >70: +2; smarts <40: −5; otherwise −1 |
| Missing grades | Default to 70; an earned zero stays zero |
| Health death | Health ≤0 at a death check |
| Age death | From age 60, probability `(age - 60) / 40`; zero at 60, guaranteed at 100 |

Event effects clamp supported stats to 0–100. Careers, education, assets, pets, relationships, and direct activities also affect stats; aging is only one source of change.

After death, **Live Again** resets to character creation and replaces the saved life. See the [death restart flow](./architecture.md#death-restart-flow).

### Wills and estate

Activities → Wills is available from age 18 with a bank balance of at least $200. That is a menu eligibility requirement; `draftWill` does not itself charge a $200 fee.

`prepareWillDraft` normalizes percentages to integers, rejects unknown/duplicate beneficiaries and allocations over 100%, and drops zero allocations. At death, `computeEstateDistribution` settles nonnegative whole-dollar net worth: cash plus property and belongings values.

- No will: the estate becomes the taxed/donated residue.
- A will with no positive allocations: split evenly across living relationships; whole-dollar rounding stays in the residue.
- A directed will: living, still-known beneficiaries receive their allocations. Dead or departed beneficiaries' shares lapse into the residue.
- Unallocated value becomes residue; payouts never exceed the estate.

## Economy and wealth

The economy cycles `normal` for three years → `boom` for two → `recession` for two → repeat. The next phase applies to that year's market and review calculations.

[wealthTiers.js](../src/config/wealthTiers.js) owns these thresholds:

| Tier | Minimum bank | Income tax | Capital gains tax | Annual lifestyle cost |
|---|---:|---:|---:|---:|
| Broke | −∞ | 0% | 0% | $0 |
| Struggling | $1,000 | 10% | 10% | $0 |
| Working Class | $10,000 | 15% | 15% | $500 |
| Middle Class | $50,000 | 22% | 20% | $3,000 |
| Upper Middle | $250,000 | 28% | 23% | $10,000 |
| Wealthy | $1,000,000 | 35% | 28% | $40,000 |
| Rich | $10,000,000 | 40% | 33% | $150,000 |
| Ultra-Wealthy | $100,000,000 | 45% | 37% | $1,000,000 |

Tier selection uses liquid bank balance, not salary or total asset value. It also controls gifts, date costs, romantic relationship decay, and lifestyle pressure. DeathScreen separately uses final net worth for its summary tier.

`computeCareerYearIncome` rounds salary × the city's `salaryMultiplier`, then deducts the current bank tier's income tax. A Broke player pays no income tax even on a large salary. The salary payment itself does not choose its own bracket.

`computeLifestyleCost` selects the tier after income and charges its lifestyle cost × the city's `colMultiplier`. A resulting negative balance applies that tier's happiness penalty. Cities and modifiers live in [cityData.js](../src/config/cityData.js).

## Careers and networking

Standard careers live in [careers.json](../src/engine/careers.json); special-career menu definitions live in [specialCareers.js](../src/config/specialCareers.js). Eligibility combines age, minimum completed degree, networking, and stat requirements.

- Networking is bounded to 0–100 and increases through jobs, conferences, mixers, and events.
- Catalog health/happiness effects are stress-intensity scores. Each nonzero effect is converted to `sign × max(1, ceil(abs(effect) / 8))` annual stat points.
- Military enlistment starts the `soldier` career and requires health 60 and athleticism 50. Branch names are history flavor.
- A recruiter charges $1,000 and selects the highest-salary eligible full-time career. The fee is charged even when there is no eligible placement.
- Startup launch charges $500 once and creates founder equity of $500. An existing founder cannot relaunch or reset equity.

Each employed non-founder year receives income before review. Review uses a deterministic score derived from smarts, health, karma, networking, PIP, financial stress, and economy phase; it does not draw a random number.

| Review outcome | Effect |
|---|---|
| Promoted | Resolve the next career tier if promotion requirements are met; otherwise treat as a raise |
| Raise | Round salary ×1.05 |
| No change | Keep compensation |
| PIP | Set the PIP flag and lose 10 happiness; later reviews include its penalty |
| Fired | Clear career, lose 30 happiness, and enable two years of unemployment benefits |

Unemployment benefits pay $4,000 in each eligible later unemployed year. Founder years use the separate equity process:

| Chance | Equity outcome |
|---|---|
| 20% | Bankruptcy; career ends and happiness falls by 30 |
| 30% | Equity ×0.8 |
| 30% | Equity ×1.5 |
| 20% | Equity ×3 |

A surviving startup pays a dividend of 10% of its new equity, rounded down, and records that amount as its salary.

## Education

High school is granted automatically at age 18 or the next annual tick for an older life missing the diploma. The higher-degree prerequisites form two branches after high school; an associate degree is not required before a bachelor degree.

| Degree | Required completion | Program years | Annual tuition | Completion smarts bonus |
|---|---|---:|---:|---:|
| Associate | High school | 2 | $10,000 | +3 |
| Bachelor | High school | 4 | $20,000 | +10 |
| Master | Bachelor | 2 | $30,000 | +5 |
| PhD | Master | 4 | $0 | +3 |

Enrollment charges the first year's tuition and initializes `yearsInProgram` to 1. Subsequent ticks charge and increment until `totalYears`; an N-year program costs exactly N annual payments. The paid-year counter means completion can occur after N−1 subsequent age clicks. Legacy saves at counter zero advance to one without paying the already-prepaid first year again.

Completion adds 3 happiness as well as the smarts bonus. PhD study deducts 20 happiness on each enrolled annual tick. Career degree requirements use minimum rank, so higher completed degrees satisfy lower requirements; enrollment prerequisites use the specific prerequisite flags in [education.js](../src/engine/mechanics/education.js).

## Assets and markets

[assetCatalog.js](../src/config/assetCatalog.js) defines appreciation/depreciation, upkeep, and passive stat effects. [storeCatalog.js](../src/config/storeCatalog.js) supplies tier-gated listings. Individual catalog rates take precedence over general category expectations.

- Properties follow a 5% annual crash roll (−30%). If there is no crash, a separate 10% boom roll applies (+30%): the unconditional boom chance is 9.5%.
- Otherwise, properties use catalog appreciation or a default 2–5% gain.
- Non-investment belongings use their catalog rate; legacy luxury/heirloom/jewelry items without one gain 2.5%, and other legacy belongings lose 15%.
- Upkeep reduces bank. Going into debt from upkeep costs 20 happiness.

Saved investment subtype IDs are `crypto`, `stock`, `penny_stock`, `bond`, and `fund`. Legacy aliases are normalized before purchase and annual processing. Invalid instruments, unknown subtypes, and non-finite amounts are rejected before purchase mutation.

| Investment | Annual behavior |
|---|---|
| Crypto | Volatility/trend and economy swings; high-volatility assets can crash or moonshot, including 50×–1000× for volatility ≥1.5 |
| Stock | Base return plus a volatility swing, adjusted by economy phase |
| Penny stock | 12% bankruptcy; next 10% gain 2×–6×; otherwise a −31.5% to +38.5% swing |
| Bond | Pay annual coupon, return principal at maturity, then remove the holding |
| Fund | Apply its return profile to current value as a paper gain/loss |

Modern investment belongings credit cash through coupons, maturity, or sale. Paper value changes do not also credit bank. The preserved legacy property-backed investment path reports its return as cash as well as changing property value; it is distinct from the modern belongings path.

On sale, non-bond investments pay capital gains tax only on positive realized gains. Early bond sales return principal without gains tax. [investmentMarket.js](../src/config/investmentMarket.js) owns instrument lists and the Bullish/Mixed/Bearish market-health display.

## Mini-games

| Mechanic | Implemented odds |
|---|---|
| Lottery | $5 per ticket; each ticket has a 0.001% chance of a $10 million jackpot |
| Casino | 45% double-stake payout, 25% half-stake payout, 30% loss; UI stakes range from $100 to $10,000 |
| Day trading | Wager a selected percentage of bank: 40% total loss, 20% half back, 20% 1.5× payout, 15% 2×, 5% 5× |

Payout multipliers include the stake. For example, a 2× payout is a profit equal to one stake.

## Relationships and pets

Living relationships age each year. If not interacted with, base relation decay is family 1, dating 3, married 2, and friend 2. Romantic decay is multiplied by the player's wealth-tier factor and rounded up. Dating/married relationships below 20 dissolve through `markAsEx`; current spouse lookup requires living `status: 'married'`.

Family-status elders have a death roll from age 70, rising to certainty at 130. Multiple simultaneous romantic partners cost 5 happiness per year. NPC autonomy can add jobs, marriage, illness, and child milestones. Child-support obligations are charged during the annual tick.

Dating-app additions are normalized with `status: 'dating'` and `isAlive: true`. Explicit and automatic breakup both clear the romantic type/status so an ex cannot remain the current spouse in UI summaries.

Living pets age, charge the species' annual upkeep, and grant its happiness bonus. Death chance begins rising at the minimum lifespan and is certain at the maximum; each pet death costs 5 happiness. Species rules live in [petCatalog.js](../src/config/petCatalog.js).

## Activity limits and content

[activities.js](../src/config/activities.js) owns menu categories, age/bank gates, special actions, and yearly limits. Limited activities share tracker IDs `categoryId__itemText`. Gym/run consume that tracker before training and show “Done this year” after use.

Yearly counters are transient and reset on annual progression; they are not written in the current cloud-save payload. The refactor preserves that persistence behavior.

The game intentionally includes mature themes such as crime, violence, adult relationships, and drugs. Do not sanitize them without an explicit instruction.
