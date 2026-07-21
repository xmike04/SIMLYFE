---
name: frontier-visual-qa
description: Screenshot-driven implementation and visual verification — build UI to match a target image/mock, or compare rendered output against a reference, using a structured region-by-region rubric and computed-style checks rather than eyeballing. Use when given a screenshot/mock/design to implement ("make it look like this"), when checking visual fidelity after UI changes, or for responsive/dark-mode regression passes. Do not use for logic-only changes with no visual surface, or when no rendering/screenshot capability exists in the session (then say so instead of pretending).
argument-hint: [target image/mock + the UI to build or check]
---

# Frontier Visual-QA — implement to a visual target

Uses whatever rendering tools the session provides (browser preview tools, screenshot MCPs,
or a dev server + headless capture via Bash). **First step is always capability check**: if
nothing in the session can render and capture the UI, report that limitation and fall back to
static checks (computed values in CSS, structure) — never claim visual verification without
having seen pixels.

## State-changing boundary
Implementation mode edits only the UI files in scope. Comparison/QA mode edits nothing.
Starting a dev server is allowed; deploying/publishing is not.

## Method

1. **Decompose the target before coding.** From the reference image, write the inventory:
   layout structure (regions, grid/flex relationships), spacing rhythm, typography (sizes,
   weights, line-heights), colors (estimate hex; extract exactly if tooling allows), states
   shown (hover, empty, active), and what's ambiguous in the image (list it — don't invent).

2. **Map to the project's system.** Match inventory items to existing CSS variables, tokens,
   and components before writing new values; a pixel-perfect clone that bypasses the design
   system is a failure. New raw values only for things the system lacks.

3. **Implement** (per frontier-one-shot discipline if it's a build), then **render and
   capture** at the reference's viewport size.

4. **Compare region by region** with `references/comparison-rubric.md` — never one global
   glance. Verify colors, fonts, and spacing by **computed style / DOM inspection** where
   tools allow; screenshots alone mislead on exact values (compression, rendering variance).

5. **Iterate bounded.** Fix the worst region first; re-capture; max 5 comparison rounds.
   Diffs still shrinking at round 5 → report remaining deltas honestly instead of polishing
   forever. Also check at least one alternate state when the project supports it (mobile
   width, dark mode) — regressions hide in the state you didn't look at.

## Deliverable
Verdict first: match / near-match / mismatch, then the per-region table (region | target |
rendered | delta | fixed-or-remaining), capture evidence (screenshot paths), and the list of
ambiguities where you chose a rendering. Statuses per `../frontier-shared/evidence-status.md`
— "Verified" requires a capture of the final state, not the intention to match.

## Failure & escalation
Render fails → debug the server/console errors first (a blank screenshot is a finding, not a
comparison). Target image unreadable or contradicts itself → ask, listing the specific
ambiguity. Tooling absent → static-check fallback, clearly labeled "not visually verified."

## Example
> Given a mock of a stats panel: inventory finds 6 regions, 2 ambiguous (scroll behavior,
> pressed state); implementation maps colors to existing `--health-color`-style variables;
> capture at 375px; rubric finds header padding 12px vs target ~20px and wrong font weight;
> two fix rounds; final report: near-match, one remaining delta (custom font unavailable),
> screenshots attached.
