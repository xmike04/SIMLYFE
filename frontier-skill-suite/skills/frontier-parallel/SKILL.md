---
name: frontier-parallel
description: Decompose work into genuinely independent lanes, delegate to parallel subagents with narrow briefs, monitor for drift and conflicts, and synthesize results into one coherent deliverable. Use when a task contains 2+ independent units (multi-module search, several unrelated fixes, researching N alternatives, reviewing many files) or when the user asks to parallelize or use subagents. Do not use for sequentially dependent steps, small single-lane tasks where spawn overhead exceeds the work, or when the user asked you to do something inline.
argument-hint: [task to decompose and delegate]
---

# Frontier Parallel — decomposition, delegation, synthesis

Uses the Agent tool. Orchestrator keeps the main context clean: subagents absorb the bulk
reading; the orchestrator holds decisions, the lane table, and synthesis.

## Independence test (gate — apply before spawning anything)
Two units are parallelizable only if: neither needs the other's output, they touch disjoint
files (or are read-only), and their conclusions can't invalidate each other's premise. If a
shared decision underlies both, make that decision FIRST in the main context, then spawn.
When the test fails, do the work sequentially — that is a success of this skill, not a failure.

## Method

1. **Decompose** into lanes; record a lane table: lane, deliverable (one sentence), files/area,
   agent type, status.

2. **Brief narrowly.** Each subagent brief follows `references/task-brief-template.md`:
   exact deliverable, the context it cannot discover itself, explicit boundaries (files it must
   not touch), and a required output format. Subagents start cold — a vague brief re-derives
   context you already have, at full cost.

3. **Choose agent types deliberately.** Explore for read-only search/recon lanes; Plan for
   design lanes; general-purpose for lanes that modify files. Give write-lanes worktree
   isolation when available so they can't collide.

4. **Keep working.** While lanes run in the background, do the orchestrator-only work:
   remaining sequential steps, integration points, the synthesis skeleton. Don't idle-poll.

5. **Monitor and intervene.** As each lane reports: check the deliverable matches the brief.
   Drifted lane → one corrective SendMessage with the specific gap; still drifting → cut the
   lane and do it inline. Two lanes contradicting each other is a finding — resolve it
   yourself with a targeted check; never average contradictory answers.

6. **Synthesize, don't concatenate.** The deliverable is one coherent result: deduplicate,
   resolve conflicts, integrate into a single structure, and attribute evidence. Raw pasted
   subagent reports are a failure mode. Report per `../frontier-shared/evidence-status.md` —
   a lane's claim of success is Completed, not Verified, until its evidence is checked.

7. **Independent verification** for substantial implementation lanes: one additional
   fresh-context verifier subagent per `../frontier-shared/verification-contract.md`, briefed
   with criteria + changed files only, never with the builders' narratives.

## State-changing boundary
The orchestrator assigns disjoint write-scopes; overlapping writes are forbidden. Anything
destructive/irreversible stays in the main context under normal pause rules.

## Failure & escalation
Lane fails or times out → mark Failed/Blocked with its output, decide: retry with sharper
brief (once), do inline, or report the gap. Never silently drop a lane from the synthesis.

## Token efficiency
Spawn only when lane work meaningfully exceeds spawn cost (rule of thumb: the lane needs 10+
tool calls or bulk reading you don't want in main context). Cap briefs at what the lane needs.

## Example
> "Audit all 9 sheet components for stat-clamping bugs" → 3 Explore lanes × 3 sheets, each
> briefed with the clamping rule (0–100) and required output format (file:line + snippet per
> finding); orchestrator meanwhile derives the canonical clamp helper; synthesis: deduplicated
> findings table, one contradiction between lanes resolved by reading the disputed line directly.
