# GitHub administration without Cloud Browser

Use this owner-run fallback when ChatGPT cannot reach GitHub administration.
It runs on your computer with the official GitHub CLI, not inside ChatGPT.
Do not send passwords, device codes, personal access tokens, or raw secret
scanning responses to chat.

## Run

Install GitHub CLI using its [official installation instructions](https://cli.github.com/).
On a Mac with Homebrew, run `brew install gh` if it is not installed.

From a downloaded copy or checkout, inspect without changing settings:

```sh
bash scripts/p1-github-admin.sh --check
```

To apply the already specified P1 policy and About correction:

```sh
bash scripts/p1-github-admin.sh --apply
```

If needed, the script opens GitHub CLI's normal web sign-in on your computer.
Use the repository owner account `xmike04`. The script checks that exact account
and administrator permissions on both repositories before any write. The sign-in
output is not written to its report. It does not request extra OAuth scopes,
extract a token, alter SSH keys, or log credential values.

The script writes a private `p1-github-report.*` text file in the current directory.
Share that report for readback and alert triage. Alert metadata includes IDs,
types, severity, package names, and links; it excludes secret values and source
snippets. Missing access or a disabled feature is recorded as unavailable,
never as zero findings. Nonempty alerts still require review.

## Exact changes

For `xmike04/SIMLYFE` and `xmike04/RAG_OPS`, add an active branch ruleset named
`P1 main quality gates`, targeting only `refs/heads/main`:

- Require a pull request, with zero mandatory reviewers for the solo maintainer.
- Require the branch to be up to date and its named quality checks to pass.
- Bind checks to GitHub Actions, whose app ID 15368 was verified in both
  repositories' current check-run records.
- Block branch deletion and force pushes. Configure no bypass actors, including
  no administrator bypass.

SIMLYFE requires `Lint, unit tests, build, docs` and
`Desktop and mobile browser smoke`. RAG_OPS requires `Backend quality`,
`Frontend quality`, `Retrieval benchmark integrity`, and
`Container configuration`. Optional Pages deployment is excluded.

The script checks successful GitHub Actions runs on each current main head
before applying anything. It verifies every saved ruleset. An existing matching
P1 ruleset is left unchanged; an existing differing P1 ruleset causes a stop.
Other policies are neither overwritten nor removed. A partial failure leaves
successful protection changes in place, records the stop, and does not weaken
security to recover. Rerunning verifies existing matching rules before proceeding.

SIMLYFE's stale About text is replaced with:

> Life simulator with deterministic gameplay, authenticated AI events, and automated Vitest/browser checks.

The script stops if the owner has replaced the old About text with different
wording since this review. It reads open Dependabot, code-scanning, and
secret-scanning alert metadata for SIMLYFE, RAG_OPS, the portfolio repository,
and the profile repository. It never dismisses or modifies alerts.

This is not proof of a rejected merge, a complete security audit, cross-device
save behavior, or completion of every P1 acceptance gate. After execution,
verify the public ruleset and branch readback, inspect an ordinary PR's merge
requirements, review accessible alerts, and reconcile the P1 ledger.

## Local verification

The test suite uses a stateful CLI double and real jq; no network requests or
GitHub writes occur during tests. Python 3 and jq are needed for tests only.

```sh
bash -n scripts/p1-github-admin.sh
python3 scripts/test_p1_github_admin.py
```

Nine tests exercise the exact policies, read-only mode, rerun idempotence,
preservation of conflicting rules, wrong-account refusal, failed CI or missing
admin access, changed About text, failed readback, and unavailable alert access.
The report test includes a fake secret value and verifies it is excluded.

References: [GitHub CLI login](https://cli.github.com/manual/gh_auth_login),
[GitHub CLI API](https://cli.github.com/manual/gh_api),
[repository rules API](https://docs.github.com/en/rest/repos/rules).
