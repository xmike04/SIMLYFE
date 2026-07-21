---
name: frontier-spec
description: Convert a vague request into an executable specification with testable acceptance criteria. Use when a request is ambiguous, multi-interpretable, or large enough that building the wrong thing is expensive — "add auth", "make it faster", "build a dashboard" — or when the user explicitly asks for a spec, requirements, or acceptance criteria. Do not use for small unambiguous edits, pure questions, or when an adequate spec already exists (then verify against it instead).
argument-hint: [the request to specify]
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(ls:*), Write, AskUserQuestion, WebSearch, WebFetch
---

# Frontier Spec — requirements extraction

Produces a spec document. The only state change permitted is writing the spec file itself
(default `./SPEC-<slug>.md`, or a path the user names). No code changes.

## Method

1. **Extract every stated requirement** from the user's words — including throwaway phrases
   ("obviously it should still work offline"). Quote ambiguous phrases verbatim rather than
   paraphrasing away the ambiguity.

2. **Investigate before interviewing.** Resolve as much as possible from the repository:
   existing conventions, similar features already built, data models, test patterns, config.
   Every investigation-resolved decision goes in the spec as an assumption WITH its evidence
   (file:line). When a 10-minute prototype or repo inspection answers a question more cheaply
   than asking the user, do that first.

3. **Classify residual uncertainty** into known unknowns (list as open questions),
   unknown knowns (you just resolved them — record where), and suspected unknown-unknown
   territory (name the category; if serious, recommend running frontier-blindspot).

4. **Ask only material questions** — those whose answers change scope, architecture, risk, or
   acceptance. Rank by architectural impact, max 5, via AskUserQuestion when interactive.
   For everything else: pick the reasonable default, document it as a reversible decision.

5. **Write the spec** using `references/spec-template.md`. The heart is acceptance criteria:
   each one must be checkable by a named concrete action (a test to run, a command, a
   manual step with expected observation). "Works correctly" is not a criterion.

## Deliverable

The spec file, plus a 5-line summary in chat: goal, top 3 acceptance criteria, assumptions
made on the user's behalf, open questions (if any). Lead with the summary, not the process.

## Verification

Before finishing, self-check: every user-stated requirement appears in exactly one of
{criteria, non-goals, open questions}; every criterion has a concrete check; every assumption
has evidence or is marked as a default. Report any requirement you could not place.

## Failure & escalation

If the request is so underspecified that even a skeleton spec would be guesswork (no goal
statement derivable), stop and ask the top 3 ranked questions instead of writing fiction.

## Example

> "Make saves more reliable" → spec with: goal (no data loss on refresh mid-age-up); evidence
> that saves currently fire per state change (gameState.js:~200); criteria like "kill the tab
> during ageUp; reload; character age matches pre-kill state (manual step M1)"; non-goals
> (multi-device merge); one open question (is offline play in scope?) ranked and defaulted to no.
