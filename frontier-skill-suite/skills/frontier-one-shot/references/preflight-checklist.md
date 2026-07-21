# Pre-write checklist

Answer each before writing code. Items you can't answer are your first tool calls.

1. **Exemplar** — which existing file does the same *kind* of thing? Read it. Match its
   naming, error handling, comment density, and test style.
2. **Instructions** — what do CLAUDE.md / contributing docs mandate for this area? (Style,
   forbidden libraries, required patterns, "add tests first" rules.)
3. **Blast radius** — grep every touched symbol repo-wide. Which tests, mirrors, schemas,
   scripts, and docs co-change? (Projects with test-mirror or schema-check patterns fail
   silently here.)
4. **Contracts** — exact input/output shapes at the boundary being touched. Read the caller
   and the callee; don't infer from names.
5. **Edge cases** — empty, null, zero, negative, huge, concurrent, unauthenticated, malformed.
   Which are in scope? Decide now, not when the review asks.
6. **Failure behavior** — what should happen when the dependency errors? Match how neighbors
   handle it (silent fallback vs surfaced error is a project-level decision — look it up).
7. **Validation plan** — which exact commands prove this works? (package.json scripts, test
   filter, lint.) If none exists for this behavior, a new test is part of the task.
8. **Definition of done** — restate the user's ask in one line. Anything you're adding that
   isn't in that line: delete it.
