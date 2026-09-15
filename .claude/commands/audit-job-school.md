# /audit-job-school — Walk Job & Education action trees

Deep-walk every player-facing path under the **Job** sheet (careers, school, recruiter, special careers). Find wiring bugs, missing bank charges, wrong field names, broken eligibility, and missing tests. Read-only unless the user asks to fix.

## Scope (must cover all)

### UI trees
1. `src/components/sheets/JobSheet.jsx` — every `jobMenu` branch:
   - Root: Full-Time, Part-Time, Freelance, Military, Special Careers, Education, Recruiter
   - Full/Part-Time sectors → career list → `chooseCareer` / eligibility UI
   - Freelance gigs → `performGig`
   - Military branch → `enlistMilitary` → soldier career; generated enlistment context is flavor
   - Special careers from `src/config/specialCareers.js` (actions, costs, `specialAction`)
   - Education enroll / progress / trade school
   - Recruiter headhunter (`HEADHUNTER_COST`)
2. Under-18 school buttons in JobSheet (interact / admin / drop out) if present
3. `src/components/game/GameSheets.jsx` wiring of JobSheet props; MainGame owns visibility and locking

### Engine
- Commands in `src/engine/gameState.js`: `chooseCareer`, `enrollInDegree`, `studyHard`, `attendNetworkingEvent`, `performGig`, `startStartup`, `enlistMilitary`, `hireViaHeadhunter`
- Real helpers in `src/engine/mechanics/careers.js` and `src/engine/mechanics/education.js`: eligibility, enrollment, degree progression, career income, review
- Annual composition in `src/engine/annual/advanceLifeYear.js`: tuition, income, networking, and performance-review order
- `src/engine/careers.json` shape vs sheet assumptions
- Cloud: career/education/bank included in `persistLife` overrides

### Docs
- Align findings with `docs/game-mechanics.md` (careers, education, networking)

## Checklist per action

For each button / action, record:

| Field | Check |
|---|---|
| Wiring | onClick calls a real engine API (not a no-op / wrong handler) |
| Cost | UI cost matches bank deduction; affordability gate matches |
| State | Correct fields (`yearsInProgram` not `yearsCompleted`, etc.) |
| Lock | Blocked while `isAging` / `currentEvent` / dead when appropriate |
| Persist | Money/career/education changes reach `persistLife` with overrides |
| Event | LLM `context` string is specific if event-driven |
| Tests | Direct-export coverage in `src/tests/mechanics/` plus catalog checks; actual command/component tests establish charges and wiring |

## Output format

1. **Tree map** — indented list of every menu path reviewed
2. **Findings** — severity-ordered (Critical / High / Medium / Low), each with `file:line`, failure scenario, fix direction
3. **Coverage gaps** — actions with no tests
4. **Verdict** — Job/School: Healthy / Needs Attention / Broken paths

Do not implement fixes unless the user explicitly asks.
