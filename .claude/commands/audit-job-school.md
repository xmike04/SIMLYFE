# /audit-job-school — Walk Job & Education action trees

Deep-walk every player-facing path under the **Job** sheet (careers, school, recruiter, special careers). Find wiring bugs, missing bank charges, wrong field names, broken eligibility, and missing tests. Read-only unless the user asks to fix.

## Scope (must cover all)

### UI trees
1. `src/components/sheets/JobSheet.jsx` — every `jobMenu` branch:
   - Root: Full-Time, Part-Time, Freelance, Military, Special Careers, Education, Recruiter
   - Full/Part-Time sectors → career list → `chooseCareer` / eligibility UI
   - Freelance gigs → `performGig`
   - Military enlist contexts → `triggerActivityEvent`
   - Special careers from `src/config/specialCareers.js` (actions, costs, `specialAction`)
   - Education enroll / progress / trade school
   - Recruiter headhunter (`HEADHUNTER_COST`)
2. Under-18 school buttons in JobSheet (interact / admin / drop out) if present
3. `MainGame.jsx` wiring of JobSheet props

### Engine
- `chooseCareer`, `checkCareerEligibility`, `enrollDegree` / `enrollInDegree`, `advanceDegreeYear` (via `ageUp`), `studyHard`, `attendNetworkingEvent`, `performGig`, `startStartup`, `runPerformanceReview`
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
| Tests | Covered by real helper tests or catalog shape tests |

## Output format

1. **Tree map** — indented list of every menu path reviewed
2. **Findings** — severity-ordered (Critical / High / Medium / Low), each with `file:line`, failure scenario, fix direction
3. **Coverage gaps** — actions with no tests
4. **Verdict** — Job/School: Healthy / Needs Attention / Broken paths

Do not implement fixes unless the user explicitly asks.
