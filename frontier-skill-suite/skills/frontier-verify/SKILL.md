---
name: frontier-verify
description: Independently verify completed work against the original request, spec, acceptance criteria, tests, runtime behavior, conventions, and the actual diff — producing a per-criterion PASS/FAIL verdict with evidence. Use after any substantial implementation (yours or another agent's), before claiming "done", before a PR/merge, or when the user asks "did it actually work?" / "check this". Do not use mid-build for routine incremental checks, or for reviewing unimplemented plans.
argument-hint: [what to verify and where the criteria live]
context: fork
allowed-tools: Read, Grep, Glob, Bash
---

# Frontier Verify — independent verification

Runs in a forked context deliberately: **ignore all conversational claims of success.**
Re-derive every status from disk, tests, and runtime. The builder's narrative is not evidence.
Full contract: `../frontier-shared/verification-contract.md` (read it now).

## Boundary — report only
This skill fixes nothing. It may run tests, builds, linters, and launch the app read-only.
It must not edit source, amend commits, push, or "quickly patch" a failure it finds.
Findings go back to the builder or the user.

## Method

1. **Reconstruct the criteria** from primary sources in priority order: the user's original
   request (verbatim), any spec/acceptance file, then implied criteria (tests pass, lint
   clean, conventions in CLAUDE.md). Write the criteria list FIRST, before looking at the
   implementation, so the implementation can't anchor what you check.

2. **Audit the diff.** `git status` + `git diff --stat` (or the stated changed-file list).
   Every changed file must be explainable by the task; flag unexplained changes and files
   that should have changed but didn't (tests, docs, mirrors).

3. **Execute the checks.** For each criterion, run the concrete check: the project's real
   test command, lint, build, and at least one real runtime exercise of the changed behavior
   (launch, endpoint hit, CLI run) when the environment allows. Read the outputs; exit codes
   alone hide skipped suites.

4. **Hunt side effects.** Do the tests that existed before still pass? Did behavior adjacent
   to the change survive (one spot-check)? Any new warnings in build/lint output?

5. **Verdict.** One line per criterion: PASS / FAIL / NOT-CHECKED + evidence (command and
   result, file:line, or screenshot ref). NOT-CHECKED must say why. Overall verdict is
   "verified" only if all PASS and the diff audit is clean — otherwise state exactly what
   stands between the work and "verified."

## Deliverable
Lead with the overall verdict in one sentence, then the criterion table, unexplained-diff
findings, and side-effect observations. Statuses per `../frontier-shared/evidence-status.md`.

## Failure & escalation
Cannot run the checks (missing deps, no test command, sandboxed)? Report which checks were
impossible and downgrade the verdict accordingly — never substitute code-reading for an
executable check and still call it verified.

## Example
> After an agent reports a lottery-odds feature "done": fork verifies — criteria list built
> from the request; diff shows an unexplained edit to gameState.js death logic (finding);
> `npm test` 2 failures in engine.mechanics (FAIL with output); runtime launch not possible in
> sandbox (NOT-CHECKED, stated). Verdict: not verified, two blockers, evidence attached.
