# Cloud Operations and Deployment

This runbook owns Firebase, Supabase, and Vercel setup plus deployment evidence. Runtime contracts are in [architecture](./architecture.md), and local commands are in [development](./development.md).

## Recorded production baseline

The following describes the completed connection rollout on **September 15, 2026**, before the large refactor. It is a dated verification record, not a claim that a later checkout or deployment has passed the same checks.

| Component | Verified baseline |
|---|---|
| Public app | [simlyfe.vercel.app](https://simlyfe.vercel.app), source commit `a49a1ca` |
| Vercel project | `xmike04s-projects/simlyfe` |
| Firebase project | `symlife-cd0b6`; anonymous, Google, and email/password providers enabled |
| Supabase project | `zfzepijfnldpqsyqyuhj`; restored and active |
| Event function | Authenticated `generate-event`, deployment version 12 |
| Database migration | `20260710000000_secure_generate_event_rate_limits.sql` applied |
| Browser evidence | Real anonymous authentication, generated event, save, and reload on the canonical public origin |
| Source gates | Lint, 1,337 Vitest tests in 19 files, production build, and one Playwright flow passed before refactoring |

The public JavaScript artifact was compared with the tested deployment output. Google and email/password were confirmed enabled; this record does not claim that every provider's interactive sign-in path was exercised. Refactor implementation, validation, and any later deployment status belong in [refactor-plan.md](./refactor-plan.md).

## Firebase

Register a web app in the intended Firebase project and copy its full public configuration into each required frontend environment. See the [browser environment table](./development.md#environment-variables).

- Enable anonymous sign-in for the guest flow.
- Enable Google and email/password for account upgrades and returning players.
- Add the exact frontend domains needed by Firebase Auth, including the production domain and authorized local/preview domains.
- Keep OAuth client secrets in provider configuration, not client environment variables.
- Create Firestore and deploy the checked-in owner-scoped rules before relying on cloud saves.

App Check is optional client wiring. `VITE_FIREBASE_APPCHECK_SITE_KEY` enables initialization with reCAPTCHA v3; registration and enforcement are separate Firebase console actions. At the recorded baseline, App Check enforcement was not enabled. Before changing enforcement, verify the intended clients and test environments can supply valid tokens.

### Firestore rules

[firestore.rules](../firestore.rules) and [firebase.json](../firebase.json) are the deploy inputs; [.firebaserc](../.firebaserc) selects the project. On qualifying pushes to `main`, the [rules workflow](../.github/workflows/deploy-firestore-rules.yml) runs the save-field drift test and deploys only if the `FIREBASE_SERVICE_ACCOUNT` repository secret exists. Manual dispatch is also supported.

The workflow can pass validation and **skip deployment** when the secret is absent. Inspect the deploy step before claiming a rules change is live.

The repository secret must contain the JSON key for a deploy service account with both roles:

| Role | Required operation |
|---|---|
| `roles/firebaserules.admin` | Test/create rulesets and update the rules release |
| `roles/serviceusage.serviceUsageConsumer` | Firebase CLI's pre-deploy service-enabled check |

Prefer a dedicated rules deployer. An Admin SDK account has broader privileges than this job requires. Keep keys in the repository secret or an ignored local credential file; never commit them.

With the intended project and credentials selected, manual deployment is:

```bash
npx vitest run src/tests/firestoreRules.test.js
npx -y firebase-tools@latest deploy --only firestore:rules
```

The drift test checks the source allowlist. It does not prove a Firestore deployment or emulate every authorization decision. Verify the deployed rules release separately.

### Catalog seeding

[scripts/migrateData.js](../scripts/migrateData.js) reads JSON catalogs and writes through the Admin SDK, which bypasses client rules. It expects the ignored `scripts/serviceAccountKey.json` and `firebase-admin`. This is a manual data operation: inspect the target project and collection writes before execution. Guest gameplay has a bundled career catalog available; seeding is not a prerequisite for local tests.

## Supabase event service

The deployed unit comprises all three of these inputs:

1. [generate-event/index.ts](../supabase/functions/generate-event/index.ts) and [contract.ts](../supabase/functions/generate-event/contract.ts).
2. The durable-quota [migration](../supabase/migrations/20260710000000_secure_generate_event_rate_limits.sql).
3. Server secrets and the exact frontend-origin allowlist.

[supabase/config.toml](../supabase/config.toml) sets `verify_jwt = false` for this function because the bearer token is issued by Firebase. The function itself verifies Firebase credentials before quota admission and provider access; disabling the gateway check does not make the function anonymous.

| Server setting | Purpose |
|---|---|
| `OPENAI_API_KEY` | Private OpenAI provider credential |
| `FIREBASE_PROJECT_ID` | Accepted Firebase audience and issuer |
| `ALLOWED_ORIGINS` | Comma-separated exact HTTP(S) origins; no paths or wildcard matching |
| `RATE_LIMIT_HMAC_SECRET` | Secret used to pseudonymize per-identity quota keys |
| `GENERATE_EVENT_GLOBAL_DAILY_LIMIT` | Daily project admission limit; defaults to 1,000, configurable from 100 to 100,000 |
| `OPENAI_MODEL` | Optional server-owned override; default `gpt-5-nano` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase runtime-provided database access settings |

Configure secrets in the Supabase dashboard or an ignored environment file passed to `supabase secrets set --env-file ...`. Do not put secret values in tracked files or command examples. Once authenticated and linked to the intended project, the source rollout sequence is:

```bash
supabase db push
supabase functions deploy generate-event
```

If the project was paused, wait for an active/healthy state before applying migrations and then verify the migration history. A restored dashboard alone does not establish a ready database or event function.

The quota layer allows a burst of two requests, sustains six per minute, and caps each identity at 100 requests per UTC day. A project-wide cap counts admissions, including requests whose later provider call fails. Inactive pseudonymous rows are pruned after seven days. The quota RPC is callable by the service role, not anonymous or authenticated browser roles.

Every request must carry an allowed `Origin`; even a valid Firebase bearer token without that header is rejected. Add a candidate deployment's exact origin before testing AI events there. A Vercel environment update alone does not alter the edge allowlist.

## Vercel frontend deployment

### Verified Git commits

The connected Vercel project requires commits that GitHub marks as verified. An unsigned branch head is automatically canceled before the build starts; the generic GitHub status can say "Canceled from the Vercel Dashboard" even when the deployment details identify an unverified signature. Check the deployment's reason and the commit's verification status before retrying.

Use a configured signing key for local commits, or GitHub's signed web/API commit path. The `createCommitOnBranch` API appends a signed commit as the authenticated user and checks the expected branch head. See [Vercel Git settings](https://vercel.com/docs/project-configuration/git-settings) and [GitHub commit signing through the API](https://docs.github.com/en/graphql/reference/commits#createcommitonbranch). A verified commit still needs successful build and application checks.

### Build and promote

Public browser configuration must exist in the intended Vercel environment before building. The build embeds these values; adding or correcting a value requires a new deployment. Preview and production scopes are independent.

After the [required source checks](./development.md#required-checks), inspect a candidate before promotion. The existing project supports building a production-configured candidate without immediately moving the canonical alias:

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod --skip-domain --yes
```

Record the returned deployment URL and ID. Add that exact origin to the Supabase allowlist, complete the verification below, then promote the reviewed deployment with `vercel promote <deployment-url> --yes` when deployment is in the task's authorized scope.

`--skip-domain` preserves the canonical production alias during candidate creation; other project aliases may still be assigned. Vercel access protection can serve a sign-in page with HTTP 200. A successful HTTP response or a title alone does not prove that the app is running.

## Verify a deployment

Use an authorized test identity and a clearly named test life. Record evidence for the exact deployment, then repeat the key flow on the canonical origin after promotion.

1. Open the application itself and confirm the expected build, rather than an access-protection page. When needed, compare the served JavaScript artifact with the tested output.
2. Confirm Firebase authentication finishes and the account UI identifies the session.
3. Create or load a test life, age once, and resolve a real generated event. Inspect failures rather than substituting static content.
4. Reload and confirm the saved character, age, and history return.
5. Exercise changed sheets and commands, including back/close behavior, at mobile and desktop sizes. Inspect browser errors.
6. Check that a disallowed origin is rejected, a request without valid authentication is rejected, and allowed preflight succeeds.
7. Verify the deployed function source/version, migration state, and Firestore rules release when those services changed.
8. Record the deployment ID, source revision, tested origin, check results, and any remaining limits. A preview pass does not establish canonical production acceptance.

## Troubleshooting by boundary

| Symptom | Inspect |
|---|---|
| No guest session | Firebase public config, enabled anonymous provider, browser Auth error |
| Google sign-in fails | Provider configuration and Firebase authorized domains |
| Proxy `ORIGIN_NOT_ALLOWED` | Exact `Origin` header against the server allowlist, including candidate URL |
| Proxy unauthorized | Fresh Firebase ID token, matching project ID, bearer/API-key separation |
| Proxy service or quota error | Active Supabase project, migration/RPC permissions, required server secrets, admission counters |
| Life disappears after reload | Auth UID continuity, save diagnostics, Firestore write result and rules |
| Old life returns after reset | Full replacement payload and late initial-load guard |
| Rules workflow passes but rules are stale | Credential presence and actual deployment step, not validation alone |

Diagnostics expose operational codes and field names. Keep credentials, complete saves, raw provider responses, and private account details out of shared logs and documentation.


## October 26, 2026 metadata inspection

This read-only inspection establishes deployment identity and configuration drift,
not a new production acceptance test. No service was restored or redeployed.

| Surface | Observed metadata |
| --- | --- |
| Canonical frontend | `simlyfe.vercel.app` resolves in Vercel deployment metadata to `dpl_DBDKqwsLnEymicPbRBrwyf9nC8xc`, state `READY`, source `e8617bbae81814da480ea28fc028bf8e4872a439` |
| Supabase project | `zfzepijfnldpqsyqyuhj` is reported `INACTIVE` by the management API |
| Event function | `generate-event` is listed `ACTIVE`, version `14`; bundle SHA-256 `899a7afc77fa3d617562d193a307133b374f3bbe9fe2e0f959767fab2f1e1ff8` |
| Source correspondence | Deployed `index.ts` and `contract.ts` differ from the pinned repository revision above in client-origin parsing |

The deployed version calls `parseClientOrigins`, combining the existing browser
origin parser with optional `ANDROID_ALLOWED_ORIGINS`. The pinned repository uses
`parseAllowedOrigins` for `ALLOWED_ORIGINS` alone. No origin values or credentials
were retrieved. The intended Android-origin policy needs owner confirmation before
backporting or redeploying either version.

The project's inactive status and the function's active listing are separate
management signals. Neither proves that a real authenticated event/quota/database
request succeeds. The September acceptance record covers the earlier frontend and
function version 12; it cannot establish acceptance of this refactor and version
14. A fresh canary still needs an authorized test identity, current service
availability, and a supported browser/runtime.

Required remaining checks: confirm service availability, authenticate a named test
life, generate and resolve one event, save/reload, verify persisted state, and record
the canonical deployment/function/rules versions. Record actual provider usage
before claiming per-event cost. Do not infer any of these outcomes from mocked CI.

## October 26, 2026 restoration and Android source follow-up

The owner confirmed the backend should be active. The existing project was
resumed and subsequently reported `ACTIVE_HEALTHY`; a read-only database query
returned PostgreSQL 17.6 successfully. These observations occurred after midnight
UTC on October 27 (October 26 in America/Chicago). No new project or paid plan was
created. This is service-restoration evidence, not completed application acceptance.

### Android origin explained and traced

The native branch
[`codex/android-mobile` at f04e56bf77443565c807adee851d793ebe5afb78](https://github.com/xmike04/SIMLYFE/tree/f04e56bf77443565c807adee851d793ebe5afb78)
resolves the earlier origin question:

- Its [Capacitor configuration](https://github.com/xmike04/SIMLYFE/blob/f04e56bf77443565c807adee851d793ebe5afb78/capacitor.config.json)
  sets hostname `localhost` and Android scheme `https`. Packaged web content
  therefore uses `https://localhost`.
- Its [Android runbook](https://github.com/xmike04/SIMLYFE/blob/f04e56bf77443565c807adee851d793ebe5afb78/docs/android.md#proxy-origin)
  documents optional `ANDROID_ALLOWED_ORIGINS=https://localhost`, preserving the
  existing browser allowlist.
- Both deployed version-14 files, `index.ts` and `contract.ts`, match that
  branch's file contents exactly. The deployed bundle hash remains
  `899a7afc77fa3d617562d193a307133b374f3bbe9fe2e0f959767fab2f1e1ff8`.
- The parser combines the two lists while requiring exact HTTP/HTTPS origins
  and rejecting wildcards. Firebase token verification and durable quota
  admission still precede generation.

An origin is the scheme, hostname and port identifying the caller's web context.
This setting lets the packaged Android app call the same backend as the website.
It does not grant an Android device a user identity or replace authentication.

The inspected main web revision lacks this optional Android helper; this is now
a traced branch/deployment difference, not unexplained source. Preserve or
integrate the reviewed native-origin helper before redeploying the function from
main. Do not replace the allowlist with a wildcard. Current secret values and
live preflight acceptance were not inspected in this follow-up, so the intended
native origin is source-backed but current allowlist behavior is not newly proved.
The Android branch's historical emulator evidence is separate from current web
acceptance.

### Post-restore database boundary

Read-only catalog checks confirmed both private quota tables have RLS enabled
and forced. `consume_generate_event_quota` is executable by `service_role` and
not by `anon` or `authenticated`; no quota row contents were read or modified.

The advisor reports INFO notices for the private tables' lack of client policies,
consistent with their server-only quota design. It also reports broad EXECUTE
grants on `public.rls_auto_enable()`:
[anonymous-role notice](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
and [authenticated-role notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
Inspection shows this function returns `event_trigger`, fixes its search path,
and matches Supabase's documented
[automatic-RLS event trigger](https://supabase.com/docs/guides/database/postgres/row-level-security#auto-enable-rls-for-new-tables).
This is distinct from the application's quota RPC; direct API exploitability
was not established. No trigger or permission change was made. Review the grants
separately before claiming a clean security audit.

### Current production canary status

A fresh browser reached the canonical application and created the synthetic
guest life **P1 Canary Oct26**, age 0. The Account interface displayed **Guest**.
This proves initial UI interaction only; it does not yet prove a successful
authenticated AI request or cloud save/reload.

Automatic approval review rejected clicking **+ Age** because the exact guest
identity and billable production event request require explicit user approval.
The action was not executed. Generation, event resolution and the final
save/reload acceptance remain pending that approval. Do not substitute static
content or infer success from service health, historical Android smoke or CI.

The service resume did not redeploy the frontend/function, change origin settings,
alter quotas, or change authentication. Record exact request/deployment/function
evidence after the approved one-event canary succeeds.

## October 26, 2026 approved single-event canary

**Result: AI generation failed; same-browser reload persistence was observed.**
The owner explicitly approved one real event request for Guest life
**P1 Canary Oct26**, followed by resolution and save/reload. Exactly one event
POST was issued; the OPTIONS preflight and server quota RPC are separate
non-generation operations. There was no retry.

The request started at 02:32:24.915 UTC October 27, or 9:32:24.915 p.m. October 26
in America/Chicago. The browser used Quick mode at
`https://simlyfe.vercel.app/`.

| Boundary | Observation |
| --- | --- |
| Web preflight | OPTIONS returned 204 |
| Quota RPC | POST consume_generate_event_quota returned 200 |
| Event function | Version 14 returned HTTP 502; reported execution duration 2,556 ms |
| Application error log | UPSTREAM_ERROR; request ID 8709799a-cd3c-4421-b54f-e0c38a44ae08 |
| Visible result | “LLM ERROR: Event generation failed. Please try again.” |
| Acknowledgment | Clicked Understood; the game returned to its ordinary controls |
| Reload | Same Guest life returned at age 1 with the error acknowledgment in history |

The deployed handler maps `UPSTREAM_ERROR` specifically to an unsuccessful HTTP
response from `https://api.openai.com/v1/chat/completions`. Its origin, Firebase
token and request validation precede quota admission and that provider call.
This supports acceptance of this Guest request through those gates; it does not
test rejection of invalid identities or other origins.

OpenAI's original HTTP status, error body, configured runtime model and billable
usage are absent from the retained diagnostics. Do not attribute the failure to
billing, credentials, a model setting, response validation or a provider outage
without further evidence. The next diagnosis needs the provider's actual error
details or a reviewed improvement to sanitized upstream-status logging before
another separately authorized generation attempt.

The life advanced from age 0 to 1, and acknowledging the error recorded it in
history. Reload returned that exact age/history. This is a same-browser
persistence observation; it does not independently verify a cloud write
acknowledgment or cross-device recovery. No genuine generated event or narrative
quality was available to assess, so full current AI production acceptance fails.

[Machine-readable receipt](./evidence/production-canary-2026-10-26.json) retains
the selected HTTP observations, error classification, source identity and limits.
No credentials, tokens, real-person data, account UID or raw save is included.

Function metadata remained version 14 with the previously recorded bundle hash,
matching the Android source. During this canary, fresh Vercel deployment lookups
returned not-found and the scoped project search found no accessible match.
The earlier frontend commit mapping remains historical; the observed deployed
module is `/assets/index-CWUz-w8k.js`. No current commit attribution is invented.

This record supersedes the previous pending-approval status: approval was received
and the single attempt completed with failure. The source/function/origin policy
was not changed in response, and no second provider request was made.

## October 27, 2026 OpenAI replacement preparation

The owner selected `gpt-5-nano` after comparing it with `gpt-6-luna`.
OpenAI's [model reference](https://developers.openai.com/api/docs/models/gpt-5-nano)
lists Standard rates of $0.05 per million input tokens, $0.005 per million
cached input tokens, and $0.40 per million output tokens. These are unit prices,
not measured SIMLYFE event costs. Reasoning tokens also consume the completion
budget and are billed as output. The [deprecation schedule](https://developers.openai.com/api/docs/deprecations)
sets December 11, 2026 as its shutdown date; migrate again before that date.

The source default previously used `gpt-4.1-nano`, whose documented shutdown
date is October 23, 2026. That could explain the failed canary if no runtime
override was configured. The deployed model override and upstream HTTP error
were not observed, so this is a hypothesis rather than a confirmed key failure.

[buildProviderRequest](../supabase/functions/generate-event/contract.ts) now
selects `reasoning_effort: "minimal"` and omits `temperature` for the nano
alias and its dated snapshot. OpenAI's [compatibility guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2)
says the original GPT-5 models reject explicit sampling parameters.
An explicit legacy model override retains the prior request parameters.

The existing total completion caps remain 200 tokens in Quick mode and 400 in
Narrative mode. These caps include reasoning: they have **not** been calibrated
against a real GPT-5 Nano event. A live response can still be incomplete at
these limits. The service rejects incomplete output and does not retry
automatically. Increase a cap only after recording a justified response and
cost budget. Mocked or local compatibility tests do not establish live quality,
latency, model access, key validity, or successful save/reload.

The same source change carries forward the deployed Android-origin helper
unchanged from the inspected native branch, so a future function deployment
does not lose its optional native allowlist. Earlier source/deployment
observations above remain historical records.

To complete the replacement:

1. Create a project-scoped OpenAI API key in the intended funded API project.
   A ChatGPT subscription does not provide API credit.
2. Deploy the tested compatible function before activating the new model
   setting. Keep Firebase authentication, quota settings, web origins, and
   Android origins unchanged.
3. In Supabase project `zfzepijfnldpqsyqyuhj`, enter the new value directly in
   Edge Function Secrets as `OPENAI_API_KEY`. Set `OPENAI_MODEL=gpt-5-nano`
   to replace any stale override. Never paste the key into chat, GitHub, browser
   application configuration, or a tracked environment file.
4. Obtain a fresh, bounded real-canary authorization; the prior single-request
   approval has already been used. Record the actual model, usage, valid event,
   resolution, and reload result. Confirm other consumers before revoking the
   previous key.

At preparation time, no replacement key had been supplied or installed, no
new provider request had been made, and the production model had not been
changed. The source patch is a reviewable draft, not a completed live migration.

## October 27, 2026 compatible function deployed

After the owner reported saving the replacement `OPENAI_API_KEY`, the compatible
function from commit `220b580b5f6c404b59186e366b4bc9aafd486547` was deployed
as version **16**. The source commit had passed all 789 tests, lint, build,
documentation checks and controlled desktop/mobile smoke tests. The preceding
function version was 15 with the unchanged older source bundle.

Readback confirmed an active function with both deployed files matching the
tested source exactly. Bundle SHA-256:
`948ed7c6b9ddb8fdb117330f1135731cc23d73e759e8ade420fd42d730283f98`.
Firebase verification remains inside the handler, with the existing gateway
`verify_jwt = false` configuration. Quotas, timeouts and origin parsing remain
intact.

Four live boundary probes passed without reaching the provider: browser and
Android preflights returned 204 with their matching allowed origins; a web-origin
POST without authentication returned 401 `UNAUTHENTICATED`; an unlisted origin
returned 403 `ORIGIN_NOT_ALLOWED`. These establish the checked access boundaries,
not a complete authentication/security audit or live AI acceptance.

The owner-reported key save was not independently validated against OpenAI,
and no secret value was read. The source default is now `gpt-5-nano`, but the
effective model remains unknown until the optional `OPENAI_MODEL` override is
confirmed or a successful real response reports it. Set or confirm
`OPENAI_MODEL=gpt-5-nano` in the same server Secrets page after this deployment.

No provider request was made in this follow-up. A newly authorized bounded
canary is still needed for actual model access, complete structured output,
usage, event resolution and reload. The [deployment receipt](./evidence/openai-nano-deployment-2026-10-27.json)
records these observations and limits. The frontend was not redeployed and the
draft source branch was not merged.

## October 26, 2026 replacement-key canary

**Result: one generated event, resolution and same-browser reload passed.**
After reporting the new key and `OPENAI_MODEL=gpt-5-nano` saved, the owner
explicitly approved one new canary on Guest **P1 Canary Oct26**. One **+ Age**
click was made in Quick mode at 10:52:34.482 p.m. CDT October 26
(03:52:34.482 UTC October 27). There was no retry.

The function was active as version **17**, with the same reviewed bundle hash
as version 16. Readback again matched both tested source files at
`220b580b5f6c404b59186e366b4bc9aafd486547` exactly. The canonical browser still
loaded `/assets/index-CWUz-w8k.js`; fresh frontend commit attribution remains
unavailable.

The UI displayed a genuine short event with two choices. Selecting the
comforting stuffed-bear/mother choice closed the event, added the selected
outcome to history, and changed happiness from 90% to 95%. Reload briefly
showed character creation while authentication/save hydration ran, then
restored the same character at **age 2**, **95% happiness**, with the new event
and selected outcome intact. The earlier failed-event history remains.

The quota RPC returned 200 at 03:52:35.209 UTC. Function-edge rows were not
available in the two bounded reads, and browser diagnostic objects did not
expose their metadata values through the available console view. Actual
API-reported model, request ID, tokens, billed cost and server latency therefore
remain unobserved. The model setting is owner-reported and matches the source
default; it is not presented as independently read from a provider response.

This is one successful current application journey, not a reliability/quality
benchmark or independent proof of cloud acknowledgment, cross-device recovery,
all native behavior, or Firestore rules. It does not prove which old key/model
setting caused the earlier failure. Historical failed and deployment receipts
remain intact. The [new canary receipt](./evidence/production-nano-canary-2026-10-26.json)
records the successful observations and remaining limits.
