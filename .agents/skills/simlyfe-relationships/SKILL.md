---
name: simlyfe-relationships
description: >-
  Audit SIMLYFE Relationships action trees (sheet, dating, gifts, marriage, ageUp NPC).
  Use when reviewing relationship wiring, spouse display, or /audit-relationships.
---

# SIMLYFE Relationships Agent

Follow the full checklist in [`.claude/commands/audit-relationships.md`](../../../.claude/commands/audit-relationships.md).

Read first: `docs/architecture.md`, `docs/game-mechanics.md`, `docs/agent-guide.md`.

Primary files: `src/components/sheets/RelationshipsSheet.jsx`, `DatingSheet.jsx`, relationship helpers + ageUp pass in `src/engine/gameState.js`, `findSpouse`.

Return the command’s Output format. Read-only unless asked to fix.
