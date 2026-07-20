# SIMLYFE docs

## Source of truth (read these first)

Any new model or contributor should start here. These three files are the **canonical** project references. Prefer updating them over duplicating facts in `CLAUDE.md` / `AGENTS.md`.

| # | File | Owns |
|---|---|---|
| 1 | [architecture.md](./architecture.md) | Stack, directory map, state, routing, LLM events, cloud saves / life reset |
| 2 | [game-mechanics.md](./game-mechanics.md) | Core loop, stats, death, economy, careers, education, assets, markets |
| 3 | [agent-guide.md](./agent-guide.md) | Conventions, how to extend features, env vars, tests, known issues, **action-audit agents** |

## Action-tree audit agents

Connected entry points (slash command ↔ skill ↔ docs):

| Slash command | Skill (`.agents/skills/`) | Walks |
|---|---|---|
| `/audit-job-school` | `simlyfe-job-school` | Job / school / recruiter |
| `/audit-relationships` | `simlyfe-relationships` | Relationships / dating / ageUp NPC |
| `/audit-activities` | `simlyfe-activities` | Activities menus + special sheets |
| `/audit-actions` | — | Orchestrates all three in parallel |

Also linked from root [`AGENTS.md`](../AGENTS.md) and [`docs/agent-guide.md`](./agent-guide.md).

## Other docs (not SOT)

| File | Purpose |
|---|---|
| [case-study.md](./case-study.md) | Portfolio write-up and screenshots |

Root entry points (`CLAUDE.md`, `AGENTS.md`, `README.md`) link here; they must not contradict these three files.
