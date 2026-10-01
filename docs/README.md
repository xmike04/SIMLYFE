# SIMLYFE Documentation

## Read first

These three canonical references are the entry point for contributors and coding agents. They own different facts and should not duplicate one another.

| Order | Document | Owns |
|---|---|---|
| 1 | [Architecture](./architecture.md) | Runtime modules, state ownership, account transitions, save boundaries, event contract |
| 2 | [Game mechanics](./game-mechanics.md) | Implemented rules, formulas, timing, catalog locations, preserved legacy behavior |
| 3 | [Agent guide](./agent-guide.md) | Contribution constraints, extension patterns, invariants, test design, action audits |

## Runbooks and evidence

| Document | Owns |
|---|---|
| [Development](./development.md) | Local setup, environment table, executable checks, test boundaries, manual tools |
| [Operations](./operations.md) | Firebase/Supabase/Vercel setup, deployment procedure, dated production baseline |
| [Android](./android.md) | Native builds, Firebase registration, emulator QA, CI and release gates |
| [Android plan](./android-plan.md) | Android scope, installed toolkit, execution evidence |
| [Refactor plan](./refactor-plan.md) | Refactor scope, phases, implementation and verification ledger |
| [Case study](./case-study.md) | Portfolio narrative, screenshots, engineering tradeoffs, evidence limits |

The root [README](../README.md) is the product overview and quick start. [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md) stay short. Update the owning document when a fact changes; link to a runbook instead of copying its commands elsewhere.

## Action-tree audits

| Command | Skill under `.agents/skills/` | Walks |
|---|---|---|
| `/audit-job-school` | `simlyfe-job-school` | Jobs, education, recruiting |
| `/audit-relationships` | `simlyfe-relationships` | Relationships, dating, NPC annual changes |
| `/audit-activities` | `simlyfe-activities` | Activity menus and special sheets |
| `/audit-actions` | Orchestrating command | All three audits and a combined report |

The [agent guide](./agent-guide.md#action-tree-audits) explains when to use these audits. Their purpose is to trace visible actions to actual state changes.

## Documentation review

- Check local links and referenced code paths after moving modules.
- Read formulas and defaults from implementation, not old prose or mirrored tests.
- Keep dates, source revisions, and verification boundaries with deployment claims.
- Record current refactor results in its ledger; a historical production pass does not verify new code.
- Never include private credentials, whole player saves, or raw provider errors.
