---
name: simlyfe-relationships
description: >-
  Audit SIMLYFE Relationships action trees (sheet, dating, gifts, marriage, ageUp NPC).
  Use when reviewing relationship wiring, spouse display, or /audit-relationships.
---

# SIMLYFE Relationships Agent

Follow the full checklist in [`.claude/commands/audit-relationships.md`](../../../.claude/commands/audit-relationships.md).

Read first: `docs/architecture.md`, `docs/game-mechanics.md`, `docs/agent-guide.md`.

Primary files:

- `src/components/sheets/RelationshipsSheet.jsx` and `src/components/sheets/DatingSheet.jsx`: relationship and dating actions
- `src/components/game/GameSheets.jsx`: engine prop bindings
- `src/components/DeathScreen.jsx`: spouse and estate display
- `src/engine/gameState.js`: relationship commands, custody choice handling, and persistence
- `src/engine/mechanics/relationships.js`: normalization, `findSpouse`, and ex-status helpers
- `src/engine/annual/relationships.js` and `src/engine/annual/advanceLifeYear.js`: NPC lifecycle, decay, and child-support composition
- `src/tests/mechanics/`: real helper/annual coverage; the README explicitly inventories remaining copied-formula debt

Return the command’s Output format. Read-only unless asked to fix.
