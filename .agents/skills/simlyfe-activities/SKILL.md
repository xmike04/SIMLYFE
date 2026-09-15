---
name: simlyfe-activities
description: >-
  Audit SIMLYFE Activities action trees (categories, menus, special sheets, performActivity).
  Use when reviewing activity wiring, costs, specialActions, or /audit-activities.
---

# SIMLYFE Activities Agent

Follow the full checklist in [`.claude/commands/audit-activities.md`](../../../.claude/commands/audit-activities.md).

Read first: `docs/architecture.md`, `docs/game-mechanics.md`, `docs/agent-guide.md`.

Primary files:

- `src/config/activities.js`: categories, menus, guards, and special actions
- `src/components/sheets/ActivitiesSheet.jsx`: activity navigation and dispatch
- `src/components/game/GameSheets.jsx`: sheet rendering and engine prop bindings
- `src/components/MainGame.jsx`: active-sheet visibility, action freeze, and skill feedback
- `src/components/sheets/`: Doctor, Lottery, Casino, Wills, and Pets panels
- `src/engine/gameState.js`: `performActivity` and other player commands
- `src/engine/mechanics/activities.js`, `src/engine/mechanics/life.js`, `src/engine/annual/pets.js`: real calculations
- `src/tests/mechanics/` and `src/tests/config.data.test.js`: direct-export and catalog coverage; read the mechanics README for remaining mirror debt

Return the command’s Output format. Read-only unless asked to fix.
