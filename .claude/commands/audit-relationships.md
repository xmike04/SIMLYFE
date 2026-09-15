# /audit-relationships — Walk Relationships action trees

Deep-walk every player-facing path under **Relationships** (sheet + dating + ageUp NPC autonomy). Find wiring bugs, wrong spouse/type checks, missing bank sync, decay/breakup edge cases, and missing tests. Read-only unless the user asks to fix.

## Scope (must cover all)

### UI trees
1. `src/components/sheets/RelationshipsSheet.jsx` — list → selected NPC actions:
   - Bond / talk / hang out / argue / insult
   - Date (cost via wealth tier)
   - Gift / beg money
   - Propose / break up / have child
   - Meet friend
2. `src/components/sheets/DatingSheet.jsx` — app dating flow
3. Love / fertility / adoption activities that create or alter relationships (`src/config/activities.js`)
4. `DeathScreen` spouse display (`findSpouse`)
5. `src/components/game/GameSheets.jsx` RelationshipsSheet / DatingSheet props and ActivitiesSheet redirects

### Engine
- Commands in `src/engine/gameState.js`: `addRelationship`, `modifyRelationship`, `giftRelationship`, `proposeMarriage`, `breakUp`, `haveChild`, `meetFriend`
- `src/engine/mechanics/relationships.js`: normalization, spouse lookup, and ex status
- `src/engine/annual/relationships.js`: decay, auto-breakup, parent death, jealousy, NPC autonomy
- `src/engine/annual/advanceLifeYear.js`: composition and child-support charges
- Custody battle event path in `handleChoice`
- Cloud: relationships + bank in `persistLife` overrides

### Docs
- Align with `docs/game-mechanics.md` (relationships & pets section)

## Checklist per action

| Field | Check |
|---|---|
| Wiring | Handler exists and matches label (e.g. propose requires dating + relation ≥ 80) |
| Identity | Uses `type` / `status` correctly (not numeric `relation` as Spouse) |
| Cost | Gifts/dates/divorce deduct bank and persist it |
| Interaction | `rel_interact__{id}` / decay exemption when expected |
| Lock | Blocked while aging/event when appropriate |
| Persist | Relationship + bank/stats overrides on `persistLife` |
| Tests | Direct-export tests in `src/tests/mechanics/` and real command/UI coverage; copied formulas in its README inventory remain debt |

## Output format

1. **Tree map** — every relationship action path reviewed
2. **Findings** — severity-ordered with `file:line`, scenario, fix direction
3. **Coverage gaps**
4. **Verdict** — Relationships: Healthy / Needs Attention / Broken paths

Do not implement fixes unless the user explicitly asks.
