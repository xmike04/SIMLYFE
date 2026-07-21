---
name: frontier-memory
description: Capture durable, selective project lessons — corrections received, approaches confirmed to work, approaches that failed and why, environment facts, and material user preferences — as one-lesson-per-file notes that future sessions can recall. Use immediately after the user corrects you, after a hard-won discovery (a fix that took real digging, a non-obvious command, a gotcha), when the user says "remember this" / "we learned", or at the end of a session with lessons worth keeping. Do not use for facts already in the repo or CLAUDE.md, for session-only trivia, or as a work log.
argument-hint: [the lesson to store — or review mode to curate]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(ls:*), Bash(mkdir:*)
---

# Frontier Memory — persistent learning

**Store location** (first that exists/applies): the harness-provided memory directory if the
session defines one; otherwise `./.claude/memory/lessons/` in the project. Index file
`INDEX.md` sits beside the lessons. State-changing boundary: writes only inside this
directory, plus the index.

## What qualifies (all must hold)
- It would change how a future session works — not just what happened today.
- It is NOT derivable from the repo, git history, or CLAUDE.md. (If it belongs in CLAUDE.md —
  a stable project convention — propose adding it there instead; memory is for the layer
  CLAUDE.md shouldn't carry: corrections, failures, preferences, volatile facts.)
- You can state *why* it's true and *how to apply* it.

## Capture procedure

1. **Dedupe first.** Grep the lessons directory for related terms. Existing lesson on the
   topic → update/sharpen it, never write a near-duplicate. Existing lesson now proven wrong
   → rewrite it with the correction and note what superseded it (or delete it if worthless).
2. **Write one lesson per file**, `<kebab-slug>.md`, using `references/lesson-template.md`.
   Line 1 is a complete one-line summary — recall decisions are made from that line alone.
   Type is one of: `correction` | `confirmed-approach` | `failed-approach` | `env-fact` |
   `preference`.
3. **Mark uncertainty.** Anything not directly verified carries `confidence: tentative` and
   what would confirm it. Convert relative dates to absolute.
4. **Index.** Add/refresh the one-line entry in `INDEX.md`. The index carries pointers only —
   never lesson bodies.

## Recall procedure (start of relevant work)
Read `INDEX.md`; open only lessons whose summary line touches the task. Before acting on a
recalled lesson, verify the file/flag/command it names still exists — lessons record the
past, and `failed-approach` lessons exist precisely so you don't retry them.

## Curation (`review` mode)
Walk all lessons: merge overlaps, delete session-trivia that leaked in, flag stale env-facts
against the current repo, report what changed. Curation may delete lesson files — list the
deletions in the report.

## Deliverable
One line per lesson written/updated/deleted, with its type. No ceremony.

## Failure & escalation
Not sure it qualifies? Ask what was non-obvious; if the answer is "nothing", don't store it.
When the user says "remember X" and X is already in the repo, store what's non-obvious *about*
it instead, and say so.

## Example
> User: "No — we deliberately surface LLM errors in-game, never silently fall back to static
> events." → grep finds no existing lesson → writes `llm-errors-surface-not-fallback.md`
> (type: correction, why: silent fallback masked a prod outage, how-to-apply: any LLM failure
> path must set the error into the visible event description) → index updated. One-line report.
