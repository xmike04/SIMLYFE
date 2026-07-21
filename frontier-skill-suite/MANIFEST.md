# MANIFEST — capability → skill mapping

Honesty note up front: none of these skills replicates model-native capability. Each row
states whether the skill **transfers a procedure** (a weaker model following it gets most of
the benefit) or **scaffolds native behavior** (the skill reminds/forces checks, but outcome
quality still tracks the model). Personalization basis: this project had no prior memory
files, so the suite encodes methods evidenced by the repository's own history (e.g. the
silent-LLM-fallback correction, the stale-closure ordering fix, test-mirror drift) and
general operating doctrine, rather than a long per-user correction log.

Common infrastructure: all skills share `frontier-shared/` (operating principles, evidence
statuses, verification contract) rather than duplicating it. Verification is deliberately
shared between areas 3, 4, 5, 6 via the contract file; spec/blindspot share the
four-quadrant uncertainty taxonomy but remain separate because their deliverables differ
(risk report vs executable spec).

---

## frontier-blindspot
- **Source capability:** blind-spot discovery, unknown-unknown identification
- **Transferable behavior:** forced category-walk assumption inventory; four-quadrant
  classification; probe-before-ask; impact-ranked questions capped at 5
- **Triggers:** "what am I missing", pre-commitment plan review, "should be easy", plans with
  zero open questions
- **Non-trigger:** typo fixes, factual questions, specs with existing risk registers
- **Agent/context:** inline; read-only toolset
- **Tools:** Read, Grep, Glob, git-read Bash, WebSearch/WebFetch
- **Verification:** every resolved item must carry a citation; all-clear must be substantiated
- **Benefit:** converts "didn't think to ask" failures into checklist hits — largely
  procedure-transferable
- **Token overhead:** ~1.4k words when triggered (SKILL + checklist reference)
- **Limitation:** the checklist finds category-shaped blind spots; truly novel ones remain
  model-native

## frontier-spec
- **Source capability:** ambiguity reduction, requirements extraction, executable specs
- **Transferable behavior:** verbatim-quote ambiguity capture; investigate-before-interview;
  every criterion mapped to a concrete check; defaults documented as reversible assumptions
- **Triggers:** vague/expensive-if-wrong requests; explicit "spec/requirements/criteria" asks
- **Non-trigger:** unambiguous edits, pure questions, existing adequate specs
- **Agent/context:** inline; writes only the spec file
- **Tools:** read/search/git + Write + AskUserQuestion + web
- **Verification:** placement self-check (every requirement in exactly one bucket)
- **Benefit:** high — the template and placement rule transfer almost fully
- **Token overhead:** ~1.2k words + template on demand
- **Limitation:** criterion *quality* (testability judgment) still tracks the model

## frontier-orchestrate
- **Source capability:** long-horizon planning, autonomous end-to-end execution
- **Transferable behavior:** done-criteria before first change; risk-first milestone order;
  per-milestone checks; ledger auditing against tool results; 3-hypothesis stall rule;
  fresh-verifier handoff
- **Triggers:** 3+ dependent-step builds, "do the whole thing", user going away
- **Non-trigger:** single edits, plan-only requests, reviews
- **Agent/context:** inline main-context orchestrator; Explore for recon; verifier subagent at end
- **Tools:** unrestricted (inherits session permissions); behavioral boundaries instead
- **Verification:** shared verification-contract + evidence ledger
- **Benefit:** medium-high — the loop transfers; recovery judgment is partly native
- **Token overhead:** ~1.5k words + 2 shared files when running
- **Limitation:** scaffolds persistence; a model with weak long-context tracking will still
  degrade on very long runs (the ledger mitigates, doesn't cure)

## frontier-one-shot
- **Source capability:** high-quality first-pass implementation
- **Transferable behavior:** mandatory pre-read of exemplars/instructions; blast-radius grep
  (tests/mirrors/docs co-change); one-paragraph design gate; boundary validation
- **Triggers:** clear well-scoped implementation asks; "get it right in one pass"
- **Non-trigger:** ambiguous work, diagnosis, multi-milestone builds
- **Agent/context:** inline
- **Tools:** inherited; boundary = mapped blast radius only
- **Verification:** project's own test/lint commands; evidence-status report
- **Benefit:** high for convention-following and co-change completeness (the dominant
  first-pass failure); edge-case *anticipation* remains native
- **Token overhead:** ~1.1k words + preflight checklist
- **Limitation:** honest scaffold: checklist ensures the right things are read, not that the
  right conclusions are drawn

## frontier-parallel
- **Source capability:** parallel decomposition, delegation, monitoring, synthesis
- **Transferable behavior:** independence gate before spawning; narrow-brief template with
  output schema; conflict-as-finding rule; synthesis-not-concatenation; disjoint write scopes
- **Triggers:** 2+ independent units; explicit parallelize/subagent asks
- **Non-trigger:** sequential chains, small tasks, inline requests
- **Agent/context:** orchestrator inline; Explore/Plan/general-purpose lanes per type;
  fresh verifier for implementation lanes
- **Tools:** Agent + inherited
- **Verification:** lane-evidence check before Verified; independent verifier for builds
- **Benefit:** high — brief quality is the dominant delegation failure and it's fully
  proceduralizable
- **Token overhead:** ~1.3k words + brief template; spawn costs dominate in practice
- **Limitation:** drift *detection* needs judgment; the skill forces checkpoints, not insight

## frontier-verify
- **Source capability:** independent verification, evidence-grounded reporting
- **Transferable behavior:** criteria-before-implementation ordering; diff audit; execute
  don't infer; PASS/FAIL/NOT-CHECKED with evidence; report-only boundary
- **Triggers:** post-implementation "is it done/did it work", pre-merge checks
- **Non-trigger:** mid-build micro-checks, plan reviews
- **Agent/context:** `context: fork` — deliberately discards trust in conversational claims
- **Tools:** Read, Grep, Glob, Bash (restricted set)
- **Verification:** is itself the verification method; the fork provides independence
- **Benefit:** very high and near-fully transferable — this is the suite's keystone
- **Token overhead:** ~1.2k + contract file, but runs in a fork so main context stays clean
- **Limitation:** can only verify checkable criteria; unstated user intent stays unverified

## frontier-debug-review
- **Source capability:** root-cause debugging, repo-history investigation, high-recall review
- **Transferable behavior:** history-before-code; hypothesis-probe-result records; 3-strikes
  frame widening; earliest-wrong-state rule; multi-lens review passes incl. unchanged callers;
  scenario-or-nit finding gate
- **Triggers:** regressions, unknown-cause bugs, "why is this like this", diff/PR review
- **Non-trigger:** user-diagnosed quick fixes, style passes, feature work
- **Agent/context:** inline; read-only toward source (fix only on request)
- **Tools:** Read, Grep, Glob, Bash
- **Verification:** confirmed-vs-plausible labeling; repro re-run after any requested fix
- **Benefit:** high — git forensics and the review lenses transfer well
- **Token overhead:** ~1.4k words + forensics cheat sheet
- **Limitation:** recall breadth on huge diffs is partly native; lenses raise the floor, not
  the ceiling

## frontier-memory
- **Source capability:** persistent learning and correction capture
- **Transferable behavior:** qualify-dedupe-write-index loop; one lesson per file with
  standalone summary line; typed lessons; supersede/delete discipline; verify-before-acting
  recall rule
- **Triggers:** user corrections, hard-won discoveries, "remember this", session-end capture
- **Non-trigger:** repo-derivable facts, work logs, CLAUDE.md edits
- **Agent/context:** inline; writes only in the lessons directory
- **Tools:** Read/Write/Edit/Grep/Glob + ls/mkdir
- **Verification:** dedupe grep is mandatory pre-write; curation mode audits staleness
- **Benefit:** very high — this is pure infrastructure a model cannot have natively
- **Token overhead:** minimal per capture (~0.9k when triggered)
- **Limitation:** value accrues only if invoked; nothing forces capture (a Stop-hook reminder
  would enforce it — deliberately out of scope for a skills-only package)

## frontier-analyst
- **Source capability:** complex research/analysis across documents, sheets, charts, tables
- **Transferable behavior:** fixed-question-first; locator-cited extraction; recompute-never-
  trust arithmetic; discrepancy-as-finding; stated-vs-derived split; confidence-tagged synthesis
- **Triggers:** multi-source questions, reconciliations, evidence-backed reports
- **Non-trigger:** single-file lookups, code tasks, opinion questions
- **Agent/context:** inline orchestrator; Explore lanes for bulk extraction
- **Tools:** read/search + Bash (recompute) + web + Agent
- **Verification:** recomputation is the built-in check; locators make claims re-auditable
- **Benefit:** high — recompute + locator discipline catches the classic failure (trusting a
  slide's arithmetic)
- **Token overhead:** ~1.2k + method reference for large source sets
- **Limitation:** chart/scan reading quality is native (vision); the skill only forces the
  approx-labeling of it

## frontier-visual-qa
- **Source capability:** screenshot-driven implementation, visual comparison, visual QA
- **Transferable behavior:** capability check first; target inventory before coding;
  design-token mapping; region-by-region rubric; computed-style over pixel checks; bounded
  iteration with honest remaining-delta reporting
- **Triggers:** "make it look like this" + image; post-change visual regression passes
- **Non-trigger:** logic-only changes; sessions with no render capability (skill says so)
- **Agent/context:** inline (needs the session's browser/preview tooling)
- **Tools:** inherited — rendering toolset varies by environment, so none is hardcoded
- **Verification:** final-state capture required for any match claim
- **Benefit:** medium-high — the rubric prevents global-glance comparisons and unbounded
  polishing loops
- **Token overhead:** ~1.2k + rubric
- **Limitation:** visual perception quality is native; the rubric structures it but a model
  that can't see a 4px offset still won't

---

## Executed evaluation results (2026-07-10)

**frontier-verify — live with/without A/B** on a real repo case (verify CLAUDE.md's LLM
section against the implementation; 4 discrepancies pre-seeded by ground-truth inspection):
- *Correctness:* both agents found all 4 seeded discrepancies (docs said gpt-4o-mini /
  120-token cap / 20-word limit; code says gpt-4.1-nano / 200-400 / 35). The bare agent even
  found one extra (an unused-client claim) that the with-skill agent missed.
- *Verification quality:* only the with-skill agent executed checks — ran the relevant test
  file (53/53 pass), audited the diff, produced a per-criterion PASS/FAIL/NOT-CHECKED table,
  and disclosed the unchecked runtime path. The bare agent read two files and asserted.
- *Scope adherence:* both stayed read-only.
- *Overhead:* with-skill +8% subagent tokens, +34s wall time.
- *Honest takeaway:* on a strong model, the skill's measured value is evidence rigor and
  executable verification, not raw finding recall — consistent with the scaffold-vs-transfer
  labels above. On weaker models the recall gap is expected to widen in the skill's favor;
  that comparison was NOT run.

**frontier-spec / frontier-orchestrate — deep static review:** every eval expectation was
mapped to a mandating instruction present in the SKILL.md (17/17 after confirming two
line-wrap-induced false negatives in the mapping script). With/without execution comparison
was NOT run for these two.

**Trigger accuracy:** a lexical bag-of-words proxy scored 28/46 top-1 across all eval
prompts. This proxy is low-signal (real routing is semantic; several prompts intentionally
share no vocabulary with their description), so treat it as a floor, not a measurement.
Mutual-exclusion clauses ("Do not use … use frontier-X") were manually cross-checked across
all 10 descriptions. Live trigger testing in fresh sessions was NOT run.

## Behaviors deliberately NOT put in skills
- **Enforced capture/verification on every stop** → belongs in hooks (Stop hook), not skills.
- **Tool allowlists for safety** → belongs in permissions/settings.json.
- **Project facts** (commands, conventions) → belongs in CLAUDE.md / frontier-memory lessons,
  not skill bodies.
- **Raw reasoning depth, taste, long-context recall** → model-native; not reproducible by
  instructions, and no skill here claims otherwise.
