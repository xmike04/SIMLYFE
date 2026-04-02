# /changelog — Generate a Formatted Changelog

Produce a clean, grouped changelog from recent git history.

## Steps

1. Run: `git log --oneline --no-merges -50`

2. Group commits by conventional type prefix:
   - `feat:` / `feature:` → Features
   - `fix:` → Bug Fixes
   - `perf:` → Performance
   - `refactor:` → Refactoring
   - `test:` → Tests
   - `chore:` / `docs:` / `style:` → Maintenance
   - Unprefixed commits → Uncategorized (flag these)

3. For each commit, rewrite the message as a plain-English bullet point (not raw commit syntax). Use present tense, keep it under one line.

4. If a commit affects a specific subsystem, tag it:
   - `[LLM]` — llmService.js or edge function
   - `[Career]` — career system, specialCareers, careers.json
   - `[Economy]` — economy cycle, wealth tiers, investments
   - `[UI]` — components or CSS
   - `[Tests]` — test files only
   - `[Data]` — events.json, careers.json, config files

5. Output the changelog in this format:

```
## [Unreleased]

### Features
- ...

### Bug Fixes
- ...

### Refactoring
- ...

### Maintenance
- ...

### Uncategorized (consider adding conventional prefixes)
- ...
```

6. After the changelog, note:
   - How many commits lack a conventional prefix (and suggest adding one)
   - Any commit that looks like it touches multiple subsystems (potential split candidate)

## When to use
Run before tagging a release, writing release notes, or sharing a progress update. Run after a heavy coding session to get a clean summary of what changed. Also useful for writing PR descriptions.

## Tips & tricks
- The `--no-merges` flag keeps merge commits out of the log — they add noise without content.
- If you want a specific range (e.g., since last tag), note that in your message when invoking: `/changelog since v1.2.0`.
- Uncategorized commits are the most valuable thing to flag — they're the ones that get lost when reviewing history six months later.
- This command reads git history, not files — it's fast and safe to run anytime.
- Pair with `/review-pr` before committing a batch of changes to ensure the log will be clean.
