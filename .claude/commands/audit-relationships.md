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
5. `MainGame.jsx` RelationshipsSheet / DatingSheet props

### Engine
- `addRelationship`, `modifyRelationship`, `giftRelationship`, `proposeMarriage`, `breakUp`, `haveChild`, `meetFriend`
- `ageUp` relationship pass: decay, auto-breakup, parent death, jealousy, NPC autonomy, child support
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
| Tests | Real helpers or mirrors cover the path |

## Output format

1. **Tree map** — every relationship action path reviewed
2. **Findings** — severity-ordered with `file:line`, scenario, fix direction
3. **Coverage gaps**
4. **Verdict** — Relationships: Healthy / Needs Attention / Broken paths

Do not implement fixes unless the user explicitly asks.
