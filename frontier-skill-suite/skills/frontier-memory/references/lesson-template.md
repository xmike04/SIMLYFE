# Lesson file template

Filename: `<kebab-slug>.md` — slug names the lesson, not the date.

```markdown
<One-line summary that stands alone — recall is decided from this line.>

- type: correction | confirmed-approach | failed-approach | env-fact | preference
- date: <yyyy-mm-dd, absolute>
- confidence: verified | tentative (<what would confirm it>)

**Lesson:** <the fact or rule, 1–3 sentences>

**Why:** <what happened / why it's true — for failed-approach, why it failed>

**How to apply:** <the concrete behavioral change in a future session>

**Evidence:** <file:line, commit sha, command output, or "user statement <date>">
```

INDEX.md format — one line per lesson, grouped by type:

```markdown
# Lessons index
## corrections
- [llm-errors-surface-not-fallback](llm-errors-surface-not-fallback.md) — LLM failures must surface in-game, never silent static fallback
## env-facts
- ...
```
