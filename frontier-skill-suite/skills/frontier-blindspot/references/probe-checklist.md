# Probe checklist — assumption categories

For each category: what does the plan silently assume, and what's the cheapest probe?

**Data & state** — shape, size, nullability, encoding, serializability, migrations needed,
who else reads/writes it. Probe: read the schema/state module; grep for writers.

**Scale & performance** — expected volume ×10, payload sizes, rate limits, cold starts,
token/cost budgets for LLM calls. Probe: find existing limits in config; check provider docs.

**Environment & deployment** — env vars, secrets location, build targets, browser/OS matrix,
CI steps that must keep passing. Probe: read .env.example, CI config, package.json scripts.

**Users & actors** — who triggers this besides the happy-path user? Concurrent sessions,
anonymous vs authed, admin paths, abuse (unauthenticated endpoints, replay). Probe: grep auth
checks around the touched surface.

**Failure modes** — what happens when the network call fails, the response is malformed, the
disk is full, the user double-clicks? Is failure silent today? Probe: read the error paths of
neighboring code; git log for past "fix:" commits in this area (past failures predict future ones).

**Integration points** — every boundary crossed (API, DB, edge function, third-party SDK).
Version pinning, breaking-change exposure, sandbox vs prod endpoints. Probe: lockfile + docs.

**Time & money** — timezones, DST, leap years, currency precision, billing-relevant loops
(anything that can call a paid API unboundedly). Probe: grep for Date/interval/retry logic.

**Security & privacy** — keys in client bundles, PII in logs, injection at every parse,
permissions of created files. Probe: grep for key names; check what ships to the client.

**Reversibility** — can this be rolled back? Data written in new formats old code can't read?
Probe: check what persists and who consumes it.

**Hidden stakeholders** — tests that encode old behavior, docs/CLAUDE.md that would go stale,
scripts and cron jobs that consume the thing being changed. Probe: grep the symbol across the
whole repo including tests, scripts, and docs.
