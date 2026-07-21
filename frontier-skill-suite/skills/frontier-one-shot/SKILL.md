---
name: frontier-one-shot
description: Produce a high-quality first-pass implementation that lands correctly without iteration — read conventions first, map the blast radius, write once, validate at real boundaries. Use for well-scoped implementation tasks where the requirement is clear (a function, component, endpoint, config change, focused feature). Do not use for exploratory/ambiguous work (run frontier-spec first), pure analysis, or long multi-milestone builds (use frontier-orchestrate).
argument-hint: [what to implement]
---

# Frontier One-Shot — right the first time

The quality of a first pass is decided **before writing**, by what you read, and **after
writing**, by where you validate. Follow `references/preflight-checklist.md` for the pre-read.

## State-changing boundary
Modify only files inside the mapped blast radius (step 2). No drive-by refactors, no
dependency additions without need, no formatting churn in untouched lines.

## Method

1. **Pre-read (never skip).** Before writing any code: the file(s) to change in full, one or
   two neighboring implementations of the same kind of thing (the strongest predictor of a
   review-clean diff is matching them), the relevant tests, and any project instructions
   (CLAUDE.md, contributing docs). Checklist in `references/preflight-checklist.md`.

2. **Map the blast radius.** Grep every symbol you will touch across the whole repo —
   including tests, scripts, and docs. List the files that must change together. A first pass
   fails most often by missing a co-changing site (the test mirror, the schema check, the doc
   table), not by wrong logic.

3. **Design in one paragraph.** State the approach, the edge cases handled, and what is
   deliberately NOT handled. If you can't write this paragraph, you're not ready to code.

4. **Write once, complete.** The full change in one coherent pass: implementation + the
   co-changing sites from step 2 + tests for new behavior (matching existing test idiom).
   No TODOs for things the task requires; no stubs presented as done.

5. **Validate at real boundaries.** Run, in the project's own commands: the relevant tests,
   the linter, and the build if cheap. For UI/runtime behavior, exercise it once for real
   when tooling allows. Self-reading your diff is step 0, not validation.

6. **Report** per `../frontier-shared/evidence-status.md`: what changed (files), what was
   validated (commands + results), edge cases covered, anything Skipped or not verifiable
   here — stated plainly.

## Failure & escalation
If validation fails: fix the actual error, max 3 hypothesis cycles, then report Failed with
the output rather than shipping "should work." If step 1 reveals the task is ambiguous or the
blast radius explodes, say so and recommend frontier-spec / frontier-orchestrate instead of
guessing.

## Token efficiency
Read neighbors selectively (one good exemplar beats five). Don't re-run the full validation
matrix after trivial follow-up edits — run only the checks the edit could affect.

## Example
> "Add a `sommelier` career." → pre-read careers.json entries + the schema test + CLAUDE.md
> career conventions; blast radius: careers.json, engine.mechanics test mirror if promotion
> tiers involved, docs table. One pass adds the entry matching existing shape; `npm test`
> passes including the auto schema checks; report lists files + test evidence.
