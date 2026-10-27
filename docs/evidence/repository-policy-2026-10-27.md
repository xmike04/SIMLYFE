# Repository policy and bounded security evidence — October 27, 2026

This checkpoint supports inspectable engineering evidence. It is not a complete
security audit, penetration test, or certification.

## Database helper: verified least-privilege repair

At 16:20 UTC, `public.rls_auto_enable()` returned `event_trigger`, used
`SECURITY DEFINER` with fixed `search_path=pg_catalog`, and was attached to
the enabled `ensure_rls` `ddl_command_end` trigger for CREATE TABLE,
CREATE TABLE AS, and SELECT INTO. Its body matched Supabase's documented
automatic-RLS helper. This is an event-trigger handler, not an application RPC;
no working RPC exploit was demonstrated.

Its original ACL granted EXECUTE to PUBLIC, postgres, anon, authenticated,
and service_role. A transaction first rehearsed the narrower grants and
asserted that creation of a public probe table still automatically enabled RLS;
the transaction rolled back.

The [bounded maintenance SQL](./rls-helper-privileges-2026-10-27.sql) then revoked
EXECUTE from PUBLIC, anon, authenticated, and service_role. Readback returned:

| Check | Result |
| --- | --- |
| Remaining helper ACL | `{postgres=X/postgres}` |
| anon / authenticated / service_role EXECUTE | false / false / false |
| postgres EXECUTE | true |
| ensure_rls trigger enabled | true |
| New public probe table automatically enables RLS | assertion passed |
| Probe absent after rollback | true |
| Both private quota tables still have forced RLS | true |
| consume_generate_event_quota callable by anon / authenticated | false / false |
| consume_generate_event_quota callable by service_role | true |

At 16:22 UTC, security advisors returned no WARN findings. Two INFO notices
remain for the private quota tables having RLS without policies; those tables
are intentionally accessed through the service-role-only quota function.
The helper's previous broad-EXECUTE warnings disappeared. No other function,
quota, identity, or gameplay permission was changed.

References:
[Supabase automatic RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#auto-enable-rls-for-new-tables),
[PostgreSQL event triggers](https://www.postgresql.org/docs/current/event-trigger-definition.html),
[Supabase advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Selected tracked-file scan

The [machine-readable manifest](./selected-tracked-file-scan-2026-10-27.json)
records 60 selected tracked files (50 SIMLYFE, one RAGOps, nine portfolio),
their immutable source snapshots, and the result of four high-signal literal
patterns: PEM private-key headers, OpenAI key-like strings, GitHub token
prefixes, and AWS AKIA access-key IDs. The selection covers tracked .agents,
.playtest-reports, evidence/report directories and .env examples under 256 KiB.
All 60 reads succeeded; those patterns had zero matches. No secret values were
printed or retained.

This is deliberately narrower than a full scanner. It does not rule out
unrecognized secret formats, custom credentials, binaries, encoded material,
other source files, prior Git history, deleted commits, or deployed settings.
Generated-agent provenance was retained rather than removed to conceal it.
GitHub secret-scanning, dependency and code-scanning alert counts were not
accessible through the current connector or signed-out browser, and are not
reported as zero.

## CI enforcement: concrete configuration, access gate still open

A passing workflow is evidence that checks ran; it is not proof of enforced
merge blocking. The SIMLYFE rulesets API returned an empty array. The current
GitHub connector exposes no administration writer. The supported browser reached
the [repository rules page](https://github.com/xmike04/SIMLYFE/settings/rules)
signed out (Sign in in the header), so no protection was created and no security
alerts or About metadata were changed.

The intended main-branch policy is ready for the repository owner/admin:
require a pull request, require these two checks, require the branch to be
up to date, block force pushes and branch deletion, and apply the rule without
an administrator bypass. A minimum reviewer count is not required for a
single-maintainer project.

- `Lint, unit tests, build, docs`
- `Desktop and mobile browser smoke`

Do not add the Vercel canceled-preview status as a unit/browser-quality check.
Successful deployment verification is a separately recorded release gate.
After saving the policy, verify the branch/ruleset readback and an ordinary
PR's merge requirements. Those administration checks remain unverified here.

RAGOps' corresponding four quality checks are `Backend quality`,
`Frontend quality`, `Retrieval benchmark integrity`, and
`Container configuration`; its optional Pages deploy job is not a required
quality check.

SIMLYFE's About description still contains the historical “350+ Vitest
assertions” wording. A count-free replacement is prepared:
“AI-assisted life simulator with deterministic game logic, authenticated OpenAI
events, Firebase cloud saves, and automated Vitest/browser checks.”
Saving that metadata also requires authenticated repository administration.

## Source availability

See [licensing status](../licensing.md). The public repository is described as
publicly viewable source. This work adds no open-source license or broader reuse
grant. A future license choice can be made separately without blocking accurate
presentation now.
