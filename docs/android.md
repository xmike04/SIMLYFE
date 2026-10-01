# Android development and delivery

The Android app packages the existing React game in Capacitor 8. Web assets live
inside the APK and load at `https://localhost`. The shared engine, Firebase save
schema, mature gameplay, and authenticated event proxy keep their contracts.
The [plan and evidence](./android-plan.md) records the rollout.

## Build and install

Use Node 22.12+ or Node 24, JDK 21, and Android SDK platform 36. Set `JAVA_HOME`
and `ANDROID_HOME` explicitly when required. The script detects the Apple Silicon
Homebrew SDK/JDK paths locally; CI supplies standard environment variables.
Android Studio is optional for command-line builds. Configure the public browser
variables in `.env.local` as described in [development](./development.md).

On this Apple Silicon Mac, direct SDK/emulator commands can use:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
```

```bash
sdkmanager 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
npm ci
npm run android:doctor
npm run android:build
adb install -r artifacts/android/SIMLYFE-debug.apk
```

The app uses `com.simlyfe.app`, min SDK 24, target/compile SDK 36 and the checked-in
Gradle wrapper. `npm run android:sync` builds/copies web assets and native plugins;
`npm run android:lint` runs Android lint; `npm run android:install` builds/installs
on the connected ADB device. `npm run android:bundle` compiles an **unsigned**
release AAB. Rebuild after configuration changes.

Ignored `artifacts/android/` contains `SIMLYFE-debug.apk`, its SHA-256/build
receipt, smoke evidence, and `SIMLYFE-release-unsigned.aab` when requested.
The build script forces developer tools off. During sync it selects plugins
based on registered native Google configuration, then restores the source JSON.
Missing Google configuration excludes native Firebase authentication and gives
a clear unavailable message; guest/email flows still use Firebase JS.

## Google sign-in and identity

Register the Android package in the **same** Firebase project as the web app.
Add SHA-1 and SHA-256 fingerprints for the key signing the installed APK and
download `android/app/google-services.json` (ignored). It must include the
matching Android client and web OAuth client (`client_type: 3`). The build script
derives `VITE_ANDROID_GOOGLE_AUTH_ENABLED`; do not set that flag manually.

```bash
npx --yes firebase-tools login
npx --yes firebase-tools apps:list --project symlife-cd0b6
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
# Use the Firebase app ID returned by apps:list, not the package name.
npx --yes firebase-tools apps:android:sha:create ANDROID_FIREBASE_APP_ID SHA_FINGERPRINT --project symlife-cd0b6
npx --yes firebase-tools apps:sdkconfig ANDROID ANDROID_FIREBASE_APP_ID --out android/app/google-services.json --project symlife-cd0b6
npm run android:build
```

Registered locally September 30, 2026:
`1:559895580884:android:cbce52e696d60d3d7ceb41`, including both fingerprints of this
Mac's debug key. The CI debug and release upload fingerprints were subsequently
registered and recorded in `android/signing-certificates.json`. Other machines
and Play app-signing keys need their own fingerprints. A differently signed APK
cannot update an existing installation in place.

The native plugin obtains Google credentials with `skipNativeAuth: true`.
`useCloudAccount` links the credential to the existing JS guest user. A collision
explicitly switches account and loads its save. Firestore and the AI token
provider use that same JS user. Email, cancellation, sign-out and complete life
replacement retain their existing contracts.

Android uses IndexedDB Auth persistence and a persistent Firestore cache.
AI generation requires connectivity. Do not ship web App Check debug tokens.
This build does not add native Play Integrity/App Check; if App Check enforcement
is introduced, implement and test the native attestation path before rollout.

## Proxy origin

The event function combines existing `ALLOWED_ORIGINS` with optional
`ANDROID_ALLOWED_ORIGINS`, using the same strict parser. Set the Android setting
to exactly `https://localhost` and preserve the web setting. Wildcards, paths,
and unsupported schemes are rejected. Native calls use the same fetch/CORS
route. Firebase verification, provider keys, prompts and quotas remain owned
by the server.

```bash
npx --yes supabase secrets set ANDROID_ALLOWED_ORIGINS=https://localhost --project-ref zfzepijfnldpqsyqyuhj
npx --yes supabase functions deploy generate-event --project-ref zfzepijfnldpqsyqyuhj --no-verify-jwt
```

Gateway `verify_jwt=false` is intentional: the function verifies Firebase token
signature, issuer, audience, expiry and subject before generation. The gateway
cannot validate those Firebase tokens itself.

## Emulator verification

```bash
sdkmanager 'emulator' 'system-images;android-36;google_apis;arm64-v8a'
avdmanager create avd --name SIMLYFE_API_36 --package 'system-images;android-36;google_apis;arm64-v8a' --device pixel_7
emulator -avd SIMLYFE_API_36 -no-snapshot
adb install -r artifacts/android/SIMLYFE-debug.apk
npm run android:smoke
```

The smoke script uses [Playwright Android WebView support](https://playwright.dev/docs/api/class-android)
on an isolated emulator. It starts/advances a disposable `SIMLYFE QA Android`
guest life and makes up to four real AI requests to unlock Activities at age 4
(one request when already past that age), respecting the live burst quota. It never clears app data or replaces
an unrelated life, and refuses physical devices. It checks origin, real Firebase
initialization, creation, hardware Back, keyboard/account layout, authenticated
generation, pending-choice protection, acknowledged writes, backgrounding and
force-stop recovery. Redacted diagnostics/screenshots go to `artifacts/android/`.
It compares the installed APK hash with the delivered artifact. Android's two
instrumentation tests can also be run with `./gradlew :app:connectedDebugAndroidTest`
from `android/` using JDK 21 and an isolated emulator. Instrumentation may reset
its test installation; run it before smoke QA and reinstall the delivered APK.

Physical-device QA must still exercise Google selection/linking, email upgrade,
relaunch, keyboard, gesture/three-button Back, rotation and a real event.
Guest/emulator evidence does not prove interactive Google login on a device.

## CI and release

[Android workflow](../.github/workflows/android-build.yml) installs Node 24, Java
21 and SDK 36 on Ubuntu 24.04, runs frontend/documentation and browser checks,
builds/lints, then uploads the debug APK/receipt. Set public `VITE_FIREBASE_*`, `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE` as GitHub repository variables; provide native config
as `ANDROID_GOOGLE_SERVICES_JSON`. `ANDROID_CI_DEBUG_KEYSTORE_B64` supplies a
stable CI debug key, separate from this Mac's debug key and the release upload
key. Gradle reads the explicit temporary CI key path; the build verifies the
resulting APK signer against the registered public certificate and fails on a
mismatch. Actions are pinned to verified release commit hashes. Register both
fingerprints of each installed build's signer in Firebase.
Fork PRs do not receive these secrets; they build with native Google disabled.

Signed builds use `npm run android:release` (AAB) and
`npm run android:release:apk` (APK). They require all four variables:
`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
`ANDROID_KEY_PASSWORD`. Partial configuration or a missing key fails before
the build. Locally these can be loaded from
`~/.config/simlyfe/android-signing/release.json`, or the file named by
`ANDROID_SIGNING_CONFIG`. This private file and key are outside Git. Back up the
encrypted upload key and its password configuration securely before distribution;
GitHub secrets cannot be read back as a recovery mechanism.

The manual Android workflow's `signed_release` input runs the signed job after
the debug checks pass. It reads `ANDROID_UPLOAD_KEYSTORE_B64`,
`ANDROID_UPLOAD_STORE_PASSWORD`, and `ANDROID_UPLOAD_KEY_PASSWORD`; alias is
`simlyfe-upload`. It verifies signatures, uploads only APK/AAB and public
receipts, then removes the temporary key. Release secrets are never used by the
PR job. Once GitHub registers the workflow, dispatch a review-branch build with
`gh workflow run android-build.yml --ref codex/android-mobile -f signed_release=true`.
This command was accepted before default-branch integration. Select the intended
reviewed ref for later releases. This workflow builds artifacts; it does not publish
to a store.

The unsigned `android:bundle` command strips signing variables so its receipt
cannot mislabel a signed bundle. Signed outputs are `SIMLYFE-release.aab` and
`SIMLYFE-release.apk`, with independent hash receipts. Upload-key signatures
do not establish Play app-signing fingerprints; add those from Play Console
when enrolling in [Play App Signing](https://developer.android.com/studio/publish/app-signing).
`npm run android:verify:release` checks both cryptographic signatures against
the public upload-certificate fingerprint in `android/signing-certificates.json`
and verifies release manifest identity, SDK, debugging, backup and cleartext flags.
Its public `release-verification.json` receipt contains hashes and no credentials.

The lockfile uses targeted gRPC/UUID overrides for
[the upstream gRPC advisories](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
and [UUID bounds-check advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
Remove the overrides when upstream dependencies adopt patched compatible versions.

Before Play distribution: confirm the permanent application ID, securely back up
the provisioned upload key, register Play app-signing fingerprints, increment
version code/name, complete device QA, prepare store assets/privacy/data-safety/
content disclosures, and verify current Play requirements. Publication is a
separate release action. Current deliverables include a CI development APK and
signed release APK/AAB; signing and emulator verification do not establish store
publication or physical-device Google login.

## Distribution preparation

Follow [the distribution steps](./android-distribution.md) for owner decisions,
key recovery, support operations, listing disclosures and Play enrollment.
`npm run test:rules` exercises the real Firestore rules against a demo emulator.
CI now includes those tests as well as the web deletion page on desktop/mobile.
`ANDROID_SMOKE_SUPPORT_CHECKS=true npm run android:smoke` adds live reporting and
deletion-request checks to the disposable emulator fixture. These requests
require developer review; an acknowledgment does not establish data deletion.
