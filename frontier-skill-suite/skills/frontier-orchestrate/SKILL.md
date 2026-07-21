---
name: frontier-orchestrate
description: Run a long-horizon, multi-step task autonomously end-to-end — plan, execute through milestones, keep an evidence ledger, and finish with independent verification. Use for tasks with 3+ dependent steps expected to span many tool calls (feature builds, migrations, multi-file refactors, "do the whole thing" requests), especially when the user will be away. Do not use for single-file edits, pure analysis/questions, or when the user asked only for a plan.
argument-hint: [the end-to-end task]
---

# Frontier Orchestrate — long-horizon autonomous execution

Read `../frontier-shared/operating-principles.md` and `../frontier-shared/evidence-status.md`
now (if missing: lead with results; statuses are Attempted/Completed/Verified/Failed/Skipped/
Blocked, each requiring tool-result evidence from this run).

## State-changing boundary
May modify files, run builds/tests, and create branches inside the task's scope. Must NOT:
push, publish, deploy, delete data, or touch anything outside the stated scope without
pausing. Pause only for: destructive/irreversible actions, genuine scope changes, or
information only the user possesses. Everything else: decide, record the assumption, continue.

## Method

1. **Fix the target.** Write (in the response, or a spec file for large work) the goal, done
   criteria, and out-of-scope list before the first change. If the request is too ambiguous
   to write done-criteria, run frontier-spec first; if it smells like it has hidden landmines,
   run frontier-blindspot first — then come back.

2. **Plan into milestones**, each independently checkable (builds, a test passes, a behavior
   is observable). Order to surface risk early: do the step most likely to invalidate the
   plan first, not the easiest one.

3. **Execute with a ledger.** Maintain the evidence ledger (one row per milestone). After each
   milestone, run its check immediately — don't batch all verification to the end where a
   day of work can be invalidated at once.

4. **Audit at checkpoints.** At every milestone boundary and before ANY progress report:
   re-read the ledger against the actual tool results of this run. Downgrade anything
   optimistic. A step whose check you haven't run is Completed at best, never Verified.

5. **Recover, don't stall.** On failure: read the real error, form one hypothesis, test it.
   After 3 distinct failed hypotheses on the same step, mark it Blocked with evidence, move to
   independent milestones if any exist, and surface the blocker in the report. Never loop a
   4th time on the same guess, and never quietly narrow the goal to what happens to work.

6. **Independent verification.** When all milestones are Completed/Verified, hand off per
   `../frontier-shared/verification-contract.md`: for substantial work, spawn a fresh-context
   verifier subagent (general-purpose) given only the task statement, criteria, and changed-file
   list — not your narrative. Fold its findings back; fix or report them.

7. **Final report.** Lead with the outcome in one sentence, then the ledger, assumptions made,
   anything Failed/Skipped/Blocked with evidence, and unresolved risks. No process recap.

## Tool strategy
Delegate wide read-only exploration to Explore subagents to keep the main context clean for
decisions. For genuinely independent build lanes, use frontier-parallel. Run independent tool
calls in parallel batches.

## Token efficiency
Plan and ledger stay compact (one line per milestone). Don't re-read unchanged files; don't
re-verify unchanged milestones. Summarize subagent output into the ledger instead of quoting it.

## Failure & escalation
If done-criteria cannot be met, deliver: what was achieved (ledger), precise gap, best next
action. A truthful partial result beats a hollow "done."

## Example
> "Add a full education-loan system: config, engine logic, UI sheet, tests." → done-criteria
> fixed; milestones: engine mechanics + test mirror (risk-first) → config data → sheet UI →
> integration into ageUp → full suite + lint. Ledger reported at each boundary; fresh verifier
> checks criteria + diff audit; final report leads with "Loan system in place, 23 new tests
> pass" plus one Blocked item (visual check — no dev-server access) stated honestly.
