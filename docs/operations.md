# Cloud Operations and Deployment

This runbook owns Firebase, Supabase, and Vercel setup plus deployment evidence. Runtime contracts are in [architecture](./architecture.md), and local commands are in [development](./development.md).

## Recorded production baseline

For the September 30 Android rollout, see [Android execution evidence](./android-plan.md).
That rollout restored the paused Supabase project, deployed `generate-event`
version 14 with a separate native-origin allowlist, registered the Android
Firebase app/debug fingerprints, and verified real guest saves/events on Android.
The public web frontend deployment was not changed.

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
| `ANDROID_ALLOWED_ORIGINS` | Optional exact native origins, combined with the web allowlist; Android uses `https://localhost` |
| `RATE_LIMIT_HMAC_SECRET` | Secret used to pseudonymize per-identity quota keys |
| `GENERATE_EVENT_GLOBAL_DAILY_LIMIT` | Daily project admission limit; defaults to 1,000, configurable from 100 to 100,000 |
| `OPENAI_MODEL` | Optional server-owned override; default `gpt-4.1-nano` |
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
