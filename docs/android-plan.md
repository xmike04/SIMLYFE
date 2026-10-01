# Android implementation plan and evidence

Date: September 30, 2026. This ledger separates implementation, local verification,
live service verification, and distribution readiness.

## Scope and architecture decision

Deliver an installable Android development APK using Capacitor 8 around the
existing React 19 / Vite 8 application. Keep JavaScript/JSX, pure CSS, one
`useGameState` owner, Firebase identities and life saves, and the authenticated
Supabase event proxy. Package web assets locally; do not point the release app
at a development server or replace the app with a hosted website.

Use `com.simlyfe.app` as the initial Android application ID and SIMLYFE as the
display name. Confirm the permanent ID before the first Play Store publication.
Public store publication and release signing require separate distribution
configuration; a development APK is the first deliverable.

## Phases and acceptance criteria

1. **Toolkit and toolchain.** Install the nine researched skills, verify current
   Capacitor versions, and prepare JDK/Android SDK tooling. Keep skill packages
   outside the game's runtime dependencies. Supabase integration already exists.
2. **Native shell.** Add pinned Capacitor dependencies, JSON configuration,
   generated Android sources, application branding, build/sync scripts, and
   build automation. Release settings prohibit cleartext and debugging.
3. **Runtime integration.** Support Android Back, keyboard and system insets,
   Firebase session persistence, and native Google credentials linked through
   the existing JavaScript Auth instance. Preserve guest linking, account
   switching, explicit life replacement, and the existing AI failure behavior.
4. **Verification.** Run lint, real-export tests, production build, documentation
   checks, and browser E2E. Build the APK; install and exercise it on an Android
   emulator when possible. Verify real guest authentication, save/relaunch,
   and an authenticated generated event separately from mocked tests.
5. **Delivery.** Record artifact paths and hashes, screenshots and evidence,
   repeatable commands, installed skill receipt, and remaining release gates.

## Required invariants

- `startLife` / `resetLife` keep full `buildLifeSave` replacement; Live Again
  still calls `resetLife()`.
- The JavaScript Firebase user remains the identity used for Firestore and the
  AI bearer token. Native Google login obtains credentials, not a second owner
  of the current life.
- Keep prompts, model settings, provider keys and quotas server-owned.
- Preserve exact origin validation; native API calls must not bypass it.
- Do not write passwords, ID tokens, private provider keys, keystores, or service
  accounts into tracked source or build evidence.
- Gameplay and mature content stay governed by the existing canonical docs.

## Toolkit receipt

Installed into `/Users/eric/.codex/skills/`:

- `capacitor-best-practices`
- `framework-to-capacitor`
- `firebase-auth-basics`
- `firebase-firestore` (current publisher name)
- `capacitor-testing`
- `safe-area-handling`
- `capacitor-security`
- `capacitor-ci-cd`
- `vercel-react-best-practices`

Reused: installed Supabase plugin/skill. Source guidance is adapted to project
conventions and current official docs; older version numbers, TypeScript
templates, and unrelated hosted-update products are not copied into the app.

## Execution ledger

- Toolkit installation: complete; all nine installer calls confirmed success.
- Initial checkout: clean; Android sources were absent.
- Initial local tools: Node 24.18.0, SDK API 34, no attached device/emulator.
  Installed JDK 21, SDK/API 36, build tools 36, platform-tools, emulator and Google
  APIs ARM64 image. Created an isolated Pixel 7 Android 36 AVD.
- Public browser configuration copied from the primary SIMLYFE checkout to an
  ignored `.env.local`, excluding private variables and developer tools.
- Supabase was initially `INACTIVE`; restored and verified `ACTIVE_HEALTHY`.
  Event function version 14 adds optional `ANDROID_ALLOWED_ORIGINS` without
  replacing the web allowlist. Set it to exactly `https://localhost`. Live
  preflights: native/web 204, unlisted origin 403; unauthenticated native POST 401.
- User completed Firebase authorization. Registered `com.simlyfe.app` in
  `symlife-cd0b6` as `1:559895580884:android:cbce52e696d60d3d7ceb41`, added both
  debug fingerprints and downloaded ignored native config with Android/web
  OAuth clients. Native picker opened and cancellation preserved the guest.
  Successful interactive Google linking remains a physical-device check.
- Implemented packaged assets, native Google credentials, Android Back,
  session/cache persistence, safe areas/keyboard, branded icon/splash, dark
  system bars, readable buttons, accessible closes and navigation label sizing.
  The frontend remains JavaScript/JSX and pure CSS with one shared engine.
- Added repeatable native build/sync/install/lint/smoke commands and GitHub
  workflow. Hosted CI verification was completed in the next phase below.
- Safe dependency patch updates and targeted `@grpc/grpc-js` 1.14.5 and xcode
  `uuid` 11.1.1 overrides eliminated reported audit findings. Verified xcode
  CommonJS UUID-call compatibility. Final `npm audit`: zero vulnerabilities.
- Initial development frontend: lint passed; **799 tests across 39 files** passed; production
  build and docs checks passed; desktop/mobile browser E2E both passed.
- Native: APK and unsigned release AAB compiled; Android lint passed. Two
  instrumented identity/backup/cleartext tests passed. An instrumentation-only
  Kotlin BOM resolves duplicate stdlib classes in the generated test graph.
- Live emulator smoke passed nine checks against the **delivered APK hash**:
  installed binary match, HTTPS/auth, guest life, account keyboard, real AI/choice,
  submenu/sheet Back, acknowledged saves, root backgrounding and force-stop
  recovery. Final run received four real HTTP 200 events from `gpt-4.1-nano`
  and restored the age-4 life. Evidence excludes tokens and raw save documents.

## Initial development artifacts

Initial development evidence preserved in `artifacts/android/phase1-development/`.
Current outputs use `artifacts/android/`; each later phase has its own evidence folder.

| Artifact | Evidence |
|---|---|
| `SIMLYFE-debug.apk` | Installable debug-signed APK, approximately 8.9 MiB |
| `SIMLYFE-debug.apk.receipt.json` | Build configuration and hash |
| `SIMLYFE-release-unsigned.aab` | Release compilation proof, approximately 4.9 MiB; unsigned |
| `SIMLYFE-release-unsigned.aab.receipt.json` | Release build and hash |
| `smoke-receipt.json` | Nine passed live checks, installed hash and request IDs |
| `google-probe.json` | Native picker/cancellation, guest preserved; login unverified |
| `gameplay.png`, `event.png`, `account.png`, `relaunch.png` | Live device captures |

APK SHA-256: `e65269aa505f7ace6a3941672f4be740e581689341124a60c4020d2492c56e6e`.

AAB SHA-256: `ab763d49d46341647b9706655bb82b7216bc73d0f5da04e2ec5b059cee29e758`.

The development artifacts above were built locally. The public web frontend was
not redeployed; the event proxy's native-origin update was deployed. Source review
and release preparation are recorded in the next-phase ledger below.

## Remaining distribution checks

- Physical Android Google linking/email flows and vendor keyboard/rotation/back.
  Native-link/collision/cancellation tests do not replace interactive device login.
- Securely back up the upload key; register Play signing fingerprints, confirm permanent ID/version,
  store assets/disclosures and publication, following [the runbook](./android.md).
- Native attestation if introducing App Check enforcement; this build has no
  native Play Integrity/App Check integration.

## Next phase: CI and release preparation

User authorized CI and release preparation; no physical phone is available.
Keep Google account linking and vendor-device QA explicitly pending.

- Add environment-only release signing, separate stable CI debug and upload keys,
  fail-fast credential checks, and signed APK/AAB commands.
- Configure the eight public GitHub build variables and native/signing secrets.
  Register CI/upload fingerprints in Firebase and refresh native configuration.
- Run required frontend checks and signed artifact signature verification.
- Preserve the complete Android implementation in a draft PR; verify the hosted
  PR build and download its artifacts. Do not merge or publish as part of this phase.
- Record final run links, hashes, release limits and key backup instructions.

Preparation completed September 30, 2026:

- Separate RSA 3072 CI-debug and upload certificates provisioned outside Git.
  Public fingerprints are in `android/signing-certificates.json`; all four new
  fingerprints were registered with the existing Firebase Android app.
- Eight public GitHub variables and five Android secrets configured, including
  refreshed native Firebase config. Existing service-account secret preserved.
- Signed APK and AAB built as version 1.0.0/code 1; both signature verifications
  passed and match the upload certificate. APK manifest confirms debugging,
  backup and cleartext disabled. No Play upload occurred.
- Release APK SHA-256: `a04d7502c8cd6cd14704338113929c9b8843020ccab69804460bb78a341dd1a9`.
- Release AAB SHA-256: `2de092652e1b10eb04542609b0571d71a3fb55d425aa1bb6e95154b65702c750`.
- Public `artifacts/android/phase2-release-preparation/release-verification.json` records signature/manifest
  checks. Key passwords and private key files are excluded from artifacts/source.
- Fixed a startup persistence race: life snapshots submitted before Firebase
  bootstrap are queued and flushed when ready, retaining full replacement at
  start/reset boundaries. Explicit account switching discards the boot queue.
  Two real-hook tests cover a new life followed by an action and a reset during
  deferred bootstrap; no save schema or game-state owner changed.
- Final frontend checks passed: lint, **805 tests across 40 files**, build, docs
  and two browser tests. The [hosted PR run](https://github.com/xmike04/SIMLYFE/actions/runs/36807299745)
  passed on attempt 2 at source `fc2efa9962abc420ee2350b641b59bd5f049595b`,
  including native compile/lint. Attempt 1 stalled installing browser OS packages;
  a fresh runner completed that same source.
- Downloaded hosted APK hash and signature verified against its receipt and the
  registered CI certificate. SHA-256:
  `4ad14301773d09ed9afa41dbd6dae3b989a46543dd4c3d9a5f7f3ee8aaff2e83`.
  Evidence lives in `artifacts/android/ci-runs/36807299745/ci-verification.json`.
- That exact downloaded CI APK passed all nine live smoke checks in an isolated
  API 36 emulator, including four real HTTP 200 `gpt-4.1-nano` events, acknowledged
  Firestore writes and restored age-4 life after force-stop. Its separate
  `ci-runs/36807299745/live/smoke-receipt.json` and screenshots preserve the hash
  relationship without overwriting the first-phase development evidence.
- The exact signed production APK passed six emulator runtime checks with
  WebView debugging disabled: binary identity, restored guest, real generated
  event, pending-choice Back protection, resolution and restored age/history
  after force-stop. `phase2-release-preparation/release-runtime.json` records the checks; HTTP trace evidence
  comes from the separate debug smoke, not this production run.
- The [manual signed workflow](https://github.com/xmike04/SIMLYFE/actions/runs/36808511007)
  passed both jobs on that same source before default-branch integration.
  Independently verified all downloaded artifact hashes and certificates against
  the registered identities, plus the release manifest security flags. Its debug
  APK is byte-identical to the nine-check live-tested CI APK above.
- Hosted release APK SHA-256:
  `78e6d3aafce8733377e1f1ce1efd7e6402aa0de0e90649fcc6add42d9423a0e5`.
  Hosted release AAB SHA-256:
  `498ee567de87cd5c846c82d34c7148a1c6eeed2508cb0c22400ed951b6a95d1e`.
  Downloaded files and independent verification are preserved under
  `artifacts/android/ci-runs/36808511007/`. Local production runtime proof refers
  to the local release APK hash above; the hosted release outputs received
  cryptographic/manifest verification, not a separate interactive runtime test.
- Review source is preserved in [draft PR #10](https://github.com/xmike04/SIMLYFE/pull/10).
  The public frontend preview was canceled from the Vercel Dashboard; it was
  not redeployed for this phase. Main remains unchanged; no store upload occurred.

## Distribution preparation

See [the six-step distribution handoff](./android-distribution.md). This phase
adds in-app reporting, owner-scoped deletion requests, an external web request
page and a draft privacy policy. It prepares store graphics, real screenshots,
listing/disclosure drafts and tested encryption tooling for key recovery.
Current verification and the exact release packet are recorded in that handoff.
Store registration, policy publication, operational fulfillment, off-Mac backup
and physical/closed-test evidence remain external release gates.

## Primary references

- [Capacitor installation](https://capacitorjs.com/docs/getting-started)
- [Capacitor configuration](https://capacitorjs.com/docs/config)
- [Capacitor App plugin](https://capacitorjs.com/docs/apis/app)
- [Native Google credentials with Firebase JS](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/authentication/docs)
- [Firebase Android authentication](https://firebase.google.com/docs/auth/android/google-signin)

Related canonical docs: [architecture](./architecture.md),
[development](./development.md), [operations](./operations.md), and
[agent guide](./agent-guide.md).
