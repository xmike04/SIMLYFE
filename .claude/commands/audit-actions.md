# /audit-actions — Orchestrate Job, Relationships, Activities agents

Fan out three independent read-only audits of SIMLYFE’s main action surfaces, then synthesize one report.

## Procedure

1. Confirm slices are independent (no shared edits). Launch **three** concurrent agents:

| Agent | Command / skill | Focus |
|---|---|---|
| Job & School | Follow `.claude/commands/audit-job-school.md` | JobSheet + careers + education |
| Relationships | Follow `.claude/commands/audit-relationships.md` | RelationshipsSheet + dating + ageUp NPC |
| Activities | Follow `.claude/commands/audit-activities.md` | activities.js + MainGame routing + special sheets |

2. Brief each agent with:
   - Repo root: this project
   - Read `docs/architecture.md`, `docs/game-mechanics.md`, `docs/agent-guide.md` first
   - Exact output contract from that command’s “Output format”
   - Read-only; no code changes

3. When all three return, **reconcile** (do not concatenate dumps):
   - Merge findings; dedupe cross-cutting issues (e.g. `persistLife`, `isActionLocked`)
   - Rank global top issues by severity
   - Note conflicts between agents and resolve with evidence

## Final output

```markdown
# SIMLYFE Action Audit

## Top issues (global)
1. …

## By domain
### Job & School — Verdict
…
### Relationships — Verdict
…
### Activities — Verdict
…

## Shared / cross-cutting
…

## Suggested fix order
…
```

## When to use
After large `gameState` / sheet changes, before a release, or when hunting “button does nothing” bugs across the three main tabs.
