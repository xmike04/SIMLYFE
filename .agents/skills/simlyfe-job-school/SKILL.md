---
name: simlyfe-job-school
description: >-
  Audit SIMLYFE Job & School action trees (JobSheet, careers, education, recruiter).
  Use when reviewing job/school wiring, tuition, eligibility, or /audit-job-school.
---

# SIMLYFE Job & School Agent

Follow the full checklist in [`.claude/commands/audit-job-school.md`](../../../.claude/commands/audit-job-school.md).

Read first: `docs/architecture.md`, `docs/game-mechanics.md`, `docs/agent-guide.md`.

Primary files: `src/components/sheets/JobSheet.jsx`, `src/config/specialCareers.js`, `src/engine/careers.json`, career/education helpers in `src/engine/gameState.js`.

Return the command’s Output format. Read-only unless asked to fix.
