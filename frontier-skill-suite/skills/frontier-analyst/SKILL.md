---
name: frontier-analyst
description: Rigorous multi-source research and analysis across documents, PDFs, spreadsheets, CSVs, tables, charts, and source material — per-source extraction with citations, cross-referencing, discrepancy hunting, recomputed numbers, and a synthesis with confidence levels. Use when a question spans multiple documents or data files, when asked to analyze/compare/summarize source material, reconcile figures, or produce an evidence-backed report. Do not use for single-file quick lookups, for writing code, or for opinion questions with no source material.
argument-hint: [question + the sources to analyze]
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Agent
---

# Frontier Analyst — evidence-grounded research

Read-only toward the sources; the only writes are the deliverable file(s) the user asked for.
Method details: `references/extraction-method.md` (load when sources exceed 2 or include
spreadsheets/charts).

## Method

1. **Fix the question first.** Write the exact question(s) and what a decision-ready answer
   looks like. Analysis without a fixed question drifts into summarization.

2. **Inventory sources** — for each: type, span (pages/sheets/rows), apparent authority
   (primary data vs derived commentary), and date. Note sources you were NOT given that the
   question seems to need; ask only if their absence blocks the answer.

3. **Extract per source, with citations.** Every extracted claim carries its locator
   (file + page / sheet + cell / table row / URL + section). Extract numbers as numbers, with
   units and period. For big source sets, delegate per-source extraction to parallel Explore
   subagents with a fixed output schema, then treat their tables as the working data.

4. **Recompute, never trust prose arithmetic.** Totals, growth rates, percentages, and
   chart-derived figures get recomputed from the underlying data (Bash/python over the CSV,
   cell-level reads of the sheet). A document's own summary of its numbers is a claim, not
   evidence. For charts with no underlying data, record read-off values as `approx` and say so.

5. **Cross-reference and hunt discrepancies.** Build the comparison across sources; where two
   sources disagree, that disagreement is a first-class finding — investigate (different
   period? definition? revision?) and report the resolution or the open conflict. Distinguish
   what sources *state* from what you *infer*; inferences are labeled as yours.

6. **Synthesize with confidence levels.** Answer the fixed question directly, each key claim
   tagged high / medium / low confidence with its citation. State the limits: what the sources
   cannot answer, and what additional data would raise confidence.

## Deliverable
Lead with the answer to the question in 1–3 sentences. Then the evidence table
(claim | value | source locator | confidence), discrepancies found, and limits. Long-form
report only when requested — then as a file, with the chat summary still leading.

## Failure & escalation
Unreadable/corrupt source → report it, proceed with the rest, and mark every conclusion that
now rests on partial coverage. Sources fundamentally insufficient for the question → say so
before delivering a hedged non-answer.

## Token efficiency
Read large documents by targeted section, not linearly. Push bulk extraction into subagents;
keep only their structured tables in main context. Never quote pages when a locator suffices.

## Example
> "Do the Q3 board deck, the finance CSV, and the analytics export agree on user growth?" →
> per-source extraction tables; growth recomputed from the CSV (deck's 41% is actually 38.6%
> — discrepancy traced to the deck using a July 1 baseline); answer leads with the
> reconciliation, each figure cited to sheet+cell / slide, confidence tagged.
