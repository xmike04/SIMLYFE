# /balance-check — Game Balance Audit

Scan all stat effect sources across the entire codebase and flag values that are outliers, broken, or unintentionally dominant.

## Steps

1. Read these files in full:
   - `src/engine/events.json` — all static events and their choice effects
   - `src/engine/careers.json` — per-career stat effects applied annually
   - `src/config/activities.js` — deterministic `baseEffects`, costs, guards, and descriptive contexts
   - `src/config/specialCareers.js` — special career action costs and contexts
   - `src/config/wealthTiers.js` — lifestyle costs and wealth tier thresholds
   - `src/config/assetCatalog.js` — upkeep costs and stat effects per asset
   - `src/config/petCatalog.js` — pet stat effects

2. For every `effects` object found, collect all numeric values per stat key (health, happiness, smarts, looks, athleticism, karma, bank).

3. Report:
   - **Outliers**: any single effect more than ±30 on a non-bank stat (these can one-shot a character or max out a stat instantly)
   - **Bank outliers**: any single bank effect more than ±$500,000 from a non-investment source
   - **Missing effects**: events with choices that have no effects at all (dead choices)
   - **Karma conflicts**: events that reward crime (negative karma source) but also give positive karma effects — contradictory
   - **Stat floor/ceiling risk**: any chain of effects that could push a stat to 0 or 100 in a single year

4. Check real calculations in `src/engine/mechanics/life.js`, `src/engine/mechanics/careers.js`, and `src/engine/annual/advanceLifeYear.js` against `docs/game-mechanics.md`:
   - Aging uses next age: health -1 after 30; another -2 after 50 (-3 total), and looks -1 after 50
   - Grades, careers, education, assets, pets, and relationships can also change stats
   - Career catalog stress intensity is normalized before annual stat application; do not treat raw catalog values as yearly deltas

5. Output a balance report:
   - List each outlier with file:line, the problematic value, and a suggested correction
   - List dead choices (no effects) with file:line
   - Give an overall balance verdict: Balanced / Minor Issues / Needs Attention

## When to use
Run after adding new events, activities, or careers. Run before any major content update. Good to run monthly as a sanity check if content is being actively added.

## Tips & tricks
- Bank effects from investments (assetCatalog, investmentMarket) intentionally have large ranges — these are expected. Focus on event `choices` for bank outliers.
- A karma effect of ±20 in a single event is already large. ±30 is a red flag.
- "Dead choices" (no effects object) in events.json are often left as placeholders — confirm with the game designer before deleting.
- Cross-reference generated effects against the server prompt/schema in `supabase/functions/generate-event/contract.ts` and the client validator in `src/engine/llmService.js`. The static event catalog is validated content, not a silent fallback for failed AI calls.
- Use direct-export tests in `src/tests/mechanics/` when checking a formula. This audit reports balance findings; do not rebalance content without authorization.
