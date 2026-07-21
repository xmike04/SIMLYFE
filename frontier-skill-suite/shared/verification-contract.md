# Verification Contract (shared)

What "verified" means for substantial work. Used by frontier-verify, and by
frontier-orchestrate / frontier-one-shot / frontier-parallel when they hand off to a verifier.

## Verification sources — check ALL that exist

1. **Original request** — the user's literal words. Verify the thing asked for, not the thing built.
2. **Written specification** — if a spec/acceptance file exists (e.g. from frontier-spec), every criterion gets a line in the verdict.
3. **Acceptance criteria** — each must map to a concrete check: a test, a command, a runtime observation, or a visual comparison.
4. **Tests** — run the project's real suite (discover the command from package.json / Makefile / CI config; don't guess). New behavior needs new or updated tests unless the user excluded them.
5. **Runtime behavior** — exercise the real boundary at least once: launch the app, hit the endpoint, run the CLI. Static reading is not runtime verification.
6. **Repository conventions** — lint passes; code matches neighboring idiom; nothing violates CLAUDE.md / contributing docs.
7. **Visual target** — when a screenshot/mock exists, compare rendered output region-by-region (see frontier-visual-qa rubric).
8. **Changed-file audit** — `git diff --stat` (or equivalent). Every changed file must be explainable by the task. Unexplained changes are findings, not noise.

## Independence requirement

Self-critique by the builder is insufficient for major work. Prefer, in order:
1. A fresh-context verifier subagent that receives only: the task statement, the spec/criteria, and pointers to the changed files — **not** the builder's narrative of success.
2. A forked-context verification pass that ignores conversational claims and re-derives status from disk and tool output.
3. (Minor changes only) builder self-check against this contract, labeled as such in the report.

## Verdict format

One line per criterion: `PASS | FAIL | NOT-CHECKED` + the evidence (command + result, file:line,
or screenshot reference). NOT-CHECKED items must say why. An overall "verified" claim is
permitted only when every criterion is PASS and no unexplained diff remains.

## Verifier boundaries

The verifier reports; it does not fix. Fixes go back to the builder (or to the user's
decision) so the verification stays independent.
