# Subagent brief template

```
DELIVERABLE (one sentence — what you return, not what you do):
<e.g. "A table of every call site of applyEffects outside the engine, with file:line and
the effect keys passed.">

CONTEXT YOU NEED (things you cannot discover cheaply):
- <project fact, decision already made, relevant convention, spec pointer>

SCOPE:
- Look at / modify ONLY: <paths>
- Do NOT touch: <paths>  |  Do NOT: install deps, change config, fix unrelated issues

OUTPUT FORMAT (exact):
<table columns / headings / max length. Force structure so synthesis is mechanical.>

EVIDENCE RULE:
Every claim carries file:line or the command + output that supports it. If you find nothing,
say "nothing found in <where you looked>" — an empty result with coverage stated is a valid
deliverable; a padded one is not.

STOP CONDITION:
<when the lane is done; time/scope cap; what to do if blocked — report, don't improvise>
```

Orchestrator checklist per returned lane: deliverable matches brief? format followed?
evidence present? scope respected (no unexpected file writes)? conflicts with other lanes?
