# /audit-activities — Walk Activities action trees

Deep-walk every player-facing path under **Activities** (categories, menus, special sheets). Find unwired `specialAction`s, cost/baseEffects mismatches, missing age/bank gates, and missing tests. Read-only unless the user asks to fix.

## Scope (must cover all)

### Catalog
1. `src/config/activities.js`
   - Every `ACTIVITY_CATEGORIES` entry (age, `minBank`, `isSpecial`)
   - Every `ACTIVITY_MENUS` item (`text`, `context`, `cost`, `yearlyLimit`, `statGuard`, `baseEffects`, `specialAction`)
2. Cross-check: every category `id` (non-special) has a matching `ACTIVITY_MENUS` key
3. Special categories: `doctor`, `lottery`, `casino` → sheet routing in `MainGame.jsx`

### UI / routing
1. `MainGame.jsx` activities sheet — category open, item click, `performActivity`, `handleSpecialSkill`, sheet redirects (`open_wills_ui`, `open_dating_ui`, `open_pets_ui`, doctor/lottery/casino)
2. Sheets: `DoctorSheet`, `LotterySheet`, `CasinoSheet`, `WillsSheet`, `PetsSheet`, emigrate city picker if any
3. Crime / rehab / lawsuit / licenses / nightclub / vacation / etc. — confirm `context` + `performActivity` path

### Engine
- `performActivity` (cost, baseEffects, yearlyLimit, locks, `persistLife`)
- `triggerActivityEvent`, `playLottery`, `goGamble`, `visitDoctor`, `adoptPet`, `visitVet`, `emigrate`, `trainHiddenSkill`
- Wills: confirm flavor-only vs estate (document, don’t “fix” without ask)

### Docs
- Align with `docs/agent-guide.md` (adding activities) and `docs/game-mechanics.md`

## Checklist per action

| Field | Check |
|---|---|
| Catalog shape | Required fields present; `specialAction` handled in MainGame |
| Cost | `cost` deducted once; UI label matches |
| Guards | `minAge` / `minBank` / `statGuard` / `yearlyLimit` enforced |
| Effects | `baseEffects` applied and persisted before LLM |
| Lock | No spend while `isAging` / event |
| Event | Non-special items have a descriptive `context` |
| Tests | `config.data.test.js` + mechanic coverage for money paths |

## Output format

1. **Tree map** — categories → items (flag specials)
2. **Findings** — severity-ordered with `file:line`, scenario, fix direction
3. **Orphans** — menu items with unwired `specialAction`, or categories without menus
4. **Coverage gaps**
5. **Verdict** — Activities: Healthy / Needs Attention / Broken paths

Do not implement fixes unless the user explicitly asks.
