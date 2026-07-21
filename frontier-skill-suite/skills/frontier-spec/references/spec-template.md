# Spec template

```markdown
# Spec: <title>
Status: draft | agreed    Date: <yyyy-mm-dd>    Request: "<user's words, quoted>"

## Goal
One paragraph. What exists when this is done, and for whom.

## Non-goals
Explicitly out of scope. Anything a reasonable reader might assume is included but isn't.

## Acceptance criteria
| # | Criterion | How to check |
|---|-----------|--------------|
| A1 | <observable behavior> | <test file / command / manual step with expected observation> |

## Interfaces & data
Touched modules, schemas, endpoints, env vars. New surface area listed exactly.

## Edge cases in scope
Enumerated, each mapped to a criterion or explicitly deferred to non-goals.

## Assumptions (decided on user's behalf — all reversible)
| Assumption | Basis | Evidence |
|------------|-------|----------|
| <default chosen> | repo convention / cheapest reversible | <file:line or "default"> |

## Open questions (ranked by architectural impact)
| # | Question | Why it matters | Default if unanswered |

## Risks
Top items only; link to frontier-blindspot output if one was run.
```

Rules: keep it under ~2 pages; a spec nobody reads verifies nothing. Every row in
"Acceptance criteria" must be executable by someone with no conversation context.
