# Frontier Skill Suite

Ten installable Claude Code skills that externalize the operating methods behind a strong
agentic model's most transferable behaviors: blind-spot discovery, spec extraction,
long-horizon orchestration, first-pass implementation quality, parallel delegation,
independent verification, root-cause debugging, persistent memory, multi-source analysis,
and visual QA.

## What this suite preserves — and what it cannot

**Preserved (externalizable):** procedures, decision rules, checklists, evidence standards,
delegation patterns, verification contracts, memory structures, and stop conditions. These
measurably shift how a capable model works: what it reads before writing, when it asks vs
investigates, how it reports, and when it refuses to claim success.

**Not preserved (model-native):** raw reasoning depth, taste in edge-case anticipation,
long-context recall quality, and judgment under ambiguity. A skill can force a weaker model
to *check* the right things; it cannot make it *notice* what it can't see. The MANIFEST is
honest about which skills scaffold vs merely remind.

## Installation

```bash
cd frontier-skill-suite
./install.sh            # user-level → ~/.claude/skills/
./install.sh --project  # project-level → ./.claude/skills/ (run from the project root)
./install.sh --force    # replace existing frontier-* skills (backs them up first)
```

The installer refuses to overwrite existing same-name skills unless `--force`, and always
backs up before replacing (`<name>.backup.<timestamp>`). It also installs `frontier-shared/`
(three common references the skills load on demand). Exit code is nonzero on any failure.

## Uninstallation

```bash
./uninstall.sh [--project|--target DIR] [--yes]
```

Removes only the ten suite skills plus `frontier-shared`. Backups and unrelated skills are
never touched.

## The 10 skills

| Command | Use for |
|---|---|
| `/frontier-blindspot` | surfacing unknown-unknowns before committing to a plan |
| `/frontier-spec` | turning a vague ask into an executable spec with testable criteria |
| `/frontier-orchestrate` | long multi-step tasks run autonomously end-to-end |
| `/frontier-one-shot` | well-scoped implementations that must land right first pass |
| `/frontier-parallel` | decomposing independent work across subagents and synthesizing |
| `/frontier-verify` | independent PASS/FAIL verification of "done" work (forked context) |
| `/frontier-debug-review` | root-cause debugging, git forensics, high-recall diff review |
| `/frontier-memory` | capturing corrections/lessons as durable per-file notes |
| `/frontier-analyst` | multi-document/spreadsheet research with recomputed numbers |
| `/frontier-visual-qa` | building to a screenshot target and verifying visual fidelity |

All ten are also model-invocable: Claude triggers them from the description when the task
matches.

### Example invocations

```
/frontier-blindspot adding real-time multiplayer to the game
/frontier-spec "make saves more reliable"
/frontier-orchestrate implement everything in SPEC-loans.md
/frontier-one-shot add a Sommelier career following existing conventions
/frontier-parallel audit all nine sheets for stat-clamping bugs
/frontier-verify the pet feature, criteria in SPEC-pets.md
/frontier-debug-review events stopped generating after yesterday's deploy
/frontier-memory never silently fall back to static events — surface LLM errors
/frontier-analyst do the board deck, finance sheet, and CSV agree on growth?
/frontier-visual-qa build the stats panel to match designs/panel.png
```

### Stacking

The skills are designed to chain:

- **Big feature:** `frontier-blindspot` → `frontier-spec` → `frontier-orchestrate` (which
  invokes the verification contract, and `frontier-parallel` for independent lanes) →
  `frontier-verify` → `frontier-memory` for lessons learned.
- **UI from a mock:** `frontier-spec` (ambiguities) → `frontier-visual-qa` (build+compare) →
  `frontier-verify` (non-visual criteria).
- **Regression:** `frontier-debug-review` (root cause) → `frontier-one-shot` (minimal fix) →
  `frontier-memory` (record the failure mode).

## Permission implications

- Analysis skills (`blindspot`, `verify`, `debug-review`) declare restricted `allowed-tools`
  (read/search/git; `verify` and `debug-review` allow Bash to run tests). While a skill with
  `allowed-tools` runs, those tools are usable without prompts — review the frontmatter if
  your threat model differs.
- Builder skills (`orchestrate`, `one-shot`, `parallel`, `visual-qa`) inherit your session's
  normal permission mode; they add behavioral boundaries (scope, pause conditions) on top,
  not in place, of harness permissions.
- `frontier-memory` writes only inside its lessons directory; `frontier-spec` writes only
  the spec file.

## Customizing

Each skill is a plain directory: `SKILL.md` (method + frontmatter) with `references/` loaded
on demand. Edit installed copies under `~/.claude/skills/<name>/`, or edit the package and
re-run `./install.sh --force`. Shared behavior (status vocabulary, verification contract,
operating principles) lives once in `frontier-shared/` — edit there to change all skills.

## Updating without losing local modifications

`install.sh --force` backs up each replaced skill to `<name>.backup.<timestamp>`. To update:
run the new installer with `--force`, then diff your backup against the new version
(`diff -r ~/.claude/skills/frontier-spec.backup.<ts> ~/.claude/skills/frontier-spec`) and
re-apply your local edits. Keeping local changes as small patch files makes this mechanical.

## Running evaluations

Every skill ships `evals/evals.json` in the official skill-creator schema
(prompt / expected_output / expectations) plus `evals/non-trigger.md` (prompts that must NOT
activate the skill). With the skill-creator plugin installed, point its eval runner at a
skill directory to execute them; the grader checks each expectation against the transcript.
Manual alternative: run each prompt in a fresh session with and without the skill installed
and grade the expectations by hand — compare correctness, scope adherence, verification
quality, trigger accuracy, and token/time overhead.

## Model & effort selection

- **Cheap tasks** (memory capture, single-file one-shots, non-trigger checks): a fast model
  (e.g. Haiku-class) is fine; the skills' checklists carry more of the weight.
- **Normal tasks** (specs, reviews, analysis, visual QA): a mid/high-tier model
  (Sonnet/Opus-class) at default effort.
- **Difficult tasks** (orchestrate on large scope, blindspot on architecture decisions,
  high-recall review of big diffs): the strongest available model at high effort — these
  skills direct judgment; they don't replace it. When in doubt, spend model quality on
  `blindspot`/`spec`/`verify`: errors there are the expensive ones.
