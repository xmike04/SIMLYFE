# /stat-audit — Validate All Stat Effect Objects

Scan every place in the codebase that produces stat effects and verify the values are in-bounds, correctly typed, and use valid stat keys.

## Steps

1. Define the valid stat keys and their ranges:
   - `health`: 0–100
   - `happiness`: 0–100
   - `smarts`: 0–100
   - `looks`: 0–100
   - `grades`: 0–100
   - `athleticism`: 0–100
   - `karma`: 0–100
   - `bank`: any number (dollars, no hard cap — but flag if a single effect exceeds ±$10M)
   - Hidden stats (valid but not displayed): `acting`, `voice`, `modeling` (0–100)
   - Invalid: anything else (typos like `"hapiness"`, `"luck"`, `"charisma"`, `"intelligence"`)

2. Collect all `effects` objects from:
   - `src/engine/events.json` — every choice's `effects`
   - `src/engine/careers.json` — `happinessEffect`, `healthEffect` per job
   - `src/config/assetCatalog.js` — `statEffects` per asset
   - `src/config/petCatalog.js` — happiness bonuses and lifecycle costs
   - `src/config/wealthTiers.js` — `happinessPenalty` per tier
   - `src/engine/gameState.js` — command-level state changes in `handleChoice` and activity handlers
   - `src/engine/mechanics/` and `src/engine/annual/` — real stat-effect helpers and annual calculations

3. For each collected effect, check:
   - **Invalid key**: is the key name one of the valid stat keys above?
   - **Out of range**: would this effect push a clamped stat (0–100) to a value that makes clamping necessary more than once per choice? (A value of ±50 on a 0–100 stat is a balance concern even if technically valid.)
   - **Wrong type**: is the value a number, not a string or boolean?
   - **Sign consistency**: karma effects for crime-related events should be negative (karma goes down for bad acts) — flag positive karma from obviously criminal contexts.

4. Output a stat audit table:

   | File | Location | Key | Value | Issue |
   |------|----------|-----|-------|-------|
   | events.json | event id "mugging", choice 0 | "hapiness" | 10 | Invalid key (typo) |
   | ... | ... | ... | ... | ... |

5. Summarize:
   - Total effects scanned
   - Invalid key count (must be 0)
   - Out-of-range count
   - Sign inconsistency count

## When to use
Run after editing `events.json`, `careers.json`, or any config file that contains stat effects. Run whenever a player reports that a choice "did nothing" — a typo in a key is the most common cause. Also run as part of any content review pass.

## Tips & tricks
- This is the fastest way to catch typos in stat keys. The game ignores unknown keys silently — there's no runtime error, the effect just doesn't apply.
- Valid but extreme values (e.g., `"health": -40`) are a balance issue, not a bug — flag them but don't auto-fix.
- `careers.json` uses `happinessEffect` and `healthEffect` as top-level keys, not inside an `effects` object — don't confuse the schema with event choice effects.
- Report invalid keys and propose a direct-export regression test in `src/tests/mechanics/`. If fixes are authorized, correct the production source and run `/balance-check`; do not add a copied test formula.
- Generated-event effects also have strict server bounds in `supabase/functions/generate-event/contract.ts`; distinguish those deltas from the 0–100 state range.
- Run this before every content release — it takes seconds and catches the most embarrassing bugs.
