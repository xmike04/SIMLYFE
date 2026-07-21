# Evidence Status Vocabulary (shared)

Every multi-step or long-running frontier skill reports progress with exactly these statuses.
A status may only be assigned when its evidence requirement is met **by a tool result from
the current run** — never from memory, expectation, or an earlier session.

| Status | Meaning | Required evidence |
|---|---|---|
| **Attempted** | Work was started; outcome not yet determined | Tool call issued in this run |
| **Completed** | The change/artifact exists as described | Tool result showing the artifact (file written, command exit 0) |
| **Verified** | Independently checked against its acceptance criterion | A *separate* check succeeded: test run, build, runtime probe, or fresh-context review — not the producing step itself |
| **Failed** | Attempted and did not succeed | The failing tool output, quoted or summarized accurately |
| **Skipped** | Deliberately not done | Stated reason at the moment of skipping |
| **Blocked** | Cannot proceed without something external | Named blocker and what would unblock it |

## Rules

1. **Completed ≠ Verified.** Writing a file completes it; only an independent check verifies it.
2. **No success claims without evidence.** If you cannot point to the tool result, the status
   is at most Attempted.
3. **Audit before reporting.** Before any progress report or final summary, re-scan the
   actual tool results of the current run and correct any status that drifted optimistic.
4. **Failures are load-bearing.** A Failed or Blocked item appears in the report at the same
   prominence as successes, with its evidence.
5. **Ledger format.** For tasks with 3+ steps, keep a compact ledger and include it in the
   final report:

```
| # | Step | Status | Evidence |
|---|------|--------|----------|
| 1 | Add tier gate to storeCatalog | Verified | market.test.js 14/14 pass |
| 2 | Update CLAUDE.md table | Completed | file written; not independently checked |
| 3 | E2E smoke | Blocked | dev server port 5173 in use |
```
