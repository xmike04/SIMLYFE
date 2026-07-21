---
name: frontier-blindspot
description: Surface unknown-unknowns, hidden assumptions, and unasked questions before committing to a plan or implementation. Use before starting any non-trivial feature, migration, architecture decision, or estimate — especially when the request sounds simple, when the user says "should be easy/quick", or when a plan has zero open questions. Do not use for routine small edits, for answering direct factual questions, or when a completed spec already lists risks.
argument-hint: [task or plan to stress-test]
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git show:*), Bash(git blame:*), Bash(ls:*), WebSearch, WebFetch
---

# Frontier Blindspot — unknown-unknown discovery

Read-only. This skill changes no system state; it produces a risk analysis.

## Method

1. **Restate the goal in one sentence** including the implied definition of "done." If you
   cannot, that is finding #1.

2. **Build an assumption inventory.** Walk `references/probe-checklist.md` and write down, per
   category, what the plan silently assumes. Force at least one entry per applicable category —
   the discipline of filling categories you'd skip is where unknown-unknowns surface.

3. **Classify every item** into the four quadrants:
   - **Known knowns** — confirmed by evidence; cite it. Drop from the report.
   - **Known unknowns** — recognized open questions.
   - **Unknown knowns** — answers already in the repo/docs/history that nobody looked up.
     Resolve these NOW with Read/Grep/git; each resolved item cites file:line or a commit.
   - **Unknown unknowns** — categories where you couldn't even form the question. Name the
     category and the cheapest probe (a grep, a prototype, a log inspection) that would
     illuminate it.

4. **Probe before asking.** For every open item, attempt the cheapest self-serve resolution
   first: repository inspection, git history (`git log -S`, blame), config files, docs, a
   web search for the external dependency. Only items that survive probing may become
   user questions.

5. **Rank by architectural impact.** An item that could change the data model or invalidate
   the approach outranks ten polish items.

## Deliverable

A report leading with the single highest-impact blind spot, then:
- **Top risks** (max 7) — each with quadrant, impact, and the probe or question that retires it
- **Questions for the user** (max 5, ranked) — only those that survived step 4 and could
  materially alter scope, architecture, risk, or acceptance criteria
- **Resolved en route** — one line each, with evidence citation

No endless interview. If nothing material survives probing, say so plainly: "No blocking
unknowns found; proceed" is a valid and valuable output.

## Failure & escalation

If the repo is unreadable or the task too vague to probe, report which probes failed and fall
back to the checklist-driven question list. Never fabricate risks to appear thorough — padding
the list buries the real one.

## Example

> User: "Add multiplayer to the life sim — should be quick, just sync state."
> Skill probes state shape (finds a 1,600-line hook with nonserializable closures), save
> layer (Firestore merge-on-every-change), and randomness (Math.random throughout → divergent
> simulations). Reports: top blind spot is nondeterministic simulation, two ranked questions
> (authoritative-server vs lockstep; concurrent-save semantics), three items resolved from the
> repo with citations.
