---
name: simlyfe-job-school
description: >-
  Audit SIMLYFE Job & School action trees (JobSheet, careers, education, recruiter).
  Use when reviewing job/school wiring, tuition, eligibility, or /audit-job-school.
---

# SIMLYFE Job & School Agent

Follow the full checklist in [`.claude/commands/audit-job-school.md`](../../../.claude/commands/audit-job-school.md).

Read first: `docs/architecture.md`, `docs/game-mechanics.md`, `docs/agent-guide.md`.

Primary files:

- `src/components/sheets/JobSheet.jsx`: job, education, military, and recruiter trees
- `src/components/game/GameSheets.jsx`: JobSheet engine prop bindings
- `src/config/specialCareers.js` and `src/engine/careers.json`: career catalogs
- `src/engine/gameState.js`: enrollment, hiring, startup, military, and recruiter commands
- `src/engine/mechanics/careers.js` and `src/engine/mechanics/education.js`: eligibility, tuition, income, and review helpers
- `src/engine/annual/advanceLifeYear.js`: annual education/career composition
- `src/tests/mechanics/`: tests importing the actual calculations; inspect real hook/UI coverage for charges and persistence

Return the command’s Output format. Read-only unless asked to fix.
