---
name: frontier-debug-review
description: Root-cause debugging and high-recall code review backed by repository-history forensics (git log -S, blame, bisect). Use when something is broken with an unclear cause, when behavior regressed ("worked yesterday", "broke after deploy"), when asked why code is the way it is, or when asked to review a diff/PR/branch for bugs. Do not use for known-cause quick fixes the user already diagnosed, for style-only formatting passes, or for writing new features.
argument-hint: [bug symptom or diff/branch to review]
allowed-tools: Read, Grep, Glob, Bash
---

# Frontier Debug-Review — root cause and high-recall review

**Boundary:** diagnosis and review change no source. Run commands, add temporary
instrumentation only if reverted before finishing. Apply a fix only when the user asked for a
fix — and then the minimal one, at the root cause, never at the symptom.

## Debug method

1. **Reproduce first.** A bug you can't trigger, you can't verify fixed. Get the exact error,
   the input, the command. If it can't be reproduced, say so and pivot to log/trace forensics.
2. **Interrogate history before code.** Regressions are usually introduced, not emergent:
   `git log --oneline -- <file>`, `git log -S "<symbol>"`, `git blame`, and diff of the last
   known-good ref. Commit messages of past fixes in the same area (`git log --grep=fix`)
   encode prior failure modes. Cheat sheet: `references/git-forensics.md`.
3. **Localize by halving** the search space (bisect over commits; binary-search over the data
   or code path with targeted probes) instead of staring at suspect code.
4. **One hypothesis at a time**, each with a discriminating test that could *disprove* it.
   Record: hypothesis → probe → result. After 3 disproven hypotheses, widen the frame
   (wrong layer? wrong assumption about the environment? stale build?) instead of hypothesis #4
   in the same frame.
5. **Root cause = the earliest wrong state**, not the crash site. Explain the full causal
   chain in the report; a fix that breaks the chain earlier than the crash is usually the
   right one. Distinguish confirmed cause (reproduced + explained) from plausible cause
   (evidence-consistent, not proven) — label which one you have.

## Review method (for diffs/PRs/branches)

1. Read the stated intent, then the full diff — plus the *unchanged* callers/consumers of
   changed code, where a high share of real bugs hide.
2. Sweep in passes, each with one lens: correctness & edge cases → state/concurrency/ordering →
   error paths & failure behavior → security at parse/inject/authz points → test adequacy
   (do tests pin the new behavior?) → convention drift (mirrors, docs, schemas not co-updated).
3. For each candidate finding, construct the concrete failure scenario (inputs/state → wrong
   outcome). No scenario constructible → it's a question or a nit, and is labeled as such.
4. Report findings ranked by severity, each with file:line, scenario, and suggested direction.
   State what you did NOT review (coverage honesty).

## Deliverable
Lead with the verdict: root cause (or top finding) in one sentence + confidence label.
Then evidence chain, remaining hypotheses if unproven, and — only if a fix was requested —
the minimal fix with its verification per `../frontier-shared/evidence-status.md`.

## Failure & escalation
Not reproducible and history is silent: report the boundary you narrowed it to, the
instrumentation that would catch it live, and rank remaining suspects. Never ship a
speculative fix labeled as a cure.

## Example
> "Events stopped generating after yesterday's deploy" → `git log --oneline` since last-good
> tag shows an edge-function fetch change; `git show` reveals a dropped header; reproduce with
> curl (401), confirm the header restores 200. Root cause: confirmed, one-line evidence chain,
> fix proposed but not applied (user asked "why").
