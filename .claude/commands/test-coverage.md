# /test-coverage — Identify High-Value Coverage Gaps

Run `npm run test:coverage` and analyze the current report. Read-only: report recommendations without implementing tests.

List the five files with lowest measured coverage in `src/engine/` and `src/config/`, including extracted mechanics, annual, and cloud modules. For each, suggest the single highest-value test based on the production behavior at risk.

Prefer importing actual helpers from their owning modules into `src/tests/mechanics/`. Recommend real hook or component tests when the risk is command locking, async sequencing, persistence, or UI wiring. Use `src/tests/mechanics/README.md` to identify remaining copied-formula debt; a mirror is not production coverage.

Report any excluded or uninstrumented files separately rather than assuming they have zero or complete coverage.
