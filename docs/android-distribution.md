# Android distribution steps and handoff

Owner requested completion in steps on September 30, 2026. Builds and signed
release CI already passed; store publication requires the remaining external
account, identity, contact, backup and device evidence below.

## Step 1: identity and key recovery

Confirm `com.simlyfe.app` as the permanent package, free pricing, an adults-only
target audience and internal testing before production. These are proposals,
not submitted Play settings. The actual content rating comes from IARC.

The signed-in Play account currently shows developer-account registration,
not an active developer account. Choose an existing account or complete the
personal/organization registration with accurate owner information. Do not
accept agreements or pay a fee by inference.

The upload and CI-debug keys remain outside Git in the private signing folder.
`npm run android:backup -- ENCRYPTED_DESTINATION RECOVERY_KEY_FILE` encrypts
both keys and their private configuration with AES-256-GCM and a random recovery
key. It checks exact decryption before and after writing, refuses overwrites,
and prints paths and a ciphertext hash only. Store the encrypted archive off
this Mac and the recovery secret separately in a password manager or another
secure location. Destination selection is pending; a script is not a completed
backup. On restoration, update the private configuration's key path to its new
location and compare certificates before building. Never upload the archive,
recovery secret, passwords or private configuration to the public repository.

## Step 2: privacy and support

The app adds an explicit deletion-request control in Account, a web flow at
`/delete-account`, and in-app AI-event reporting. These submit immutable requests
under `users/{uid}/supportRequests/{requestId}`. They do not modify life state,
resolve an event, sign out, or immediately delete data. The shared Firebase
identity scopes requests; clients can get their own request but cannot list,
update or delete the inbox. Only an authorized Firebase operator/Admin SDK can
review and fulfill requests. Repeated submissions preserve the first request.

The policy source is [privacy.html](../public/privacy.html). It deliberately
remains labeled as a draft until the publisher/contact and operational handling
are confirmed. Before external distribution:

1. Provide a monitored support address and publisher name.
2. Confirm who reviews the Firestore inbox, fulfillment timing and retention.
3. Exercise a disposable deletion request through operator fulfillment: verify
   identity, remove the Firebase user's life and support subcollections, then
   remove the Auth user. Auth deletion alone does not remove Firestore data.
4. Retain security quota/provider records only as disclosed; verify provider
   retention terms rather than promising immediate erasure from every provider.
5. Publish and verify the policy and web deletion URLs without authentication.
   The deletion page may require sign-in to identify the account to be deleted.

Do not mark a request as fulfilled until data removal is verified. Never purge
an unrelated real account as a test. New support rules must pass emulator tests
and be deployed before distributing a build that uses these controls.

## Step 3: listing, disclosures and rating

Prepared listing material belongs in `distribution/android/`. Exported images
and validation receipts belong in ignored `artifacts/android/distribution/`.
Use real gameplay screenshots, a 512×512 icon and 1024×500 feature graphic.
Phone screenshots must satisfy the current aspect-ratio and size requirements.

Data-safety answers must include the Firebase identity/account and saved-game
content, game context sent through Supabase/OpenAI, support reports, and relevant
SDK/provider data practices. A fictional character's health or bank balance is
not automatically the player's real health or financial information. A player
can enter a real name, so do not claim the name field never contains personal
information. Collection/sharing declarations need owner review of provider terms.

The rating questionnaire must disclose the mature fictional themes actually
present, including simulated gambling, crime/violence, alcohol/drugs and sexual
references where applicable. An 18+ target audience does not itself assign an
IARC rating or exempt the app from content policies. Do not sanitize gameplay
or claim compliance without completing that review.

## Step 4: Play enrollment and internal release

After account verification, create the game using the approved package/name,
language, pricing and audience settings. Enroll in Play App Signing, obtain the
Play app-signing SHA-1/SHA-256 certificate and register both in the existing
Firebase Android app. The upload certificate is already registered and is a
different identity. Refresh native config and rebuild if required.

Verify the release AAB hash/signature, manifest security flags, version code,
policy URLs and release notes. Upload the exact approved bundle to internal
testing. Provide reviewer instructions for guest access and real event
generation. Do not invent tester emails, invite anyone, accept agreements, or
start a rollout without the specific required information/authorization.

## Step 5: device and closed-test evidence

No phone was available in the previous phase. Emulator checks do not prove
physical Google linking, vendor keyboards, rotation or hardware navigation.
Use an internal tester's compatible Android device for those checks and record
results against the Play-installed binary and signing certificate.

New personal developer accounts need a closed test with at least 12 testers
continuously opted in for 14 days before applying for production access.
Internal testing does not replace that requirement. Record genuine feedback,
fixes and dates; do not fabricate elapsed time or tester participation.

## Step 6: production review

Finish the content/data disclosures, policy verification, secure backup,
physical-device evidence and applicable closed testing. Prepare a reviewable
release with exact version/hash, audience, countries, listing and rollout scope,
then obtain final publication approval. Keep the [Android ledger](./android-plan.md)
and [runbook](./android.md) aligned with actual Console receipts.

## Primary references checked for this phase

- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Developer registration](https://support.google.com/googleplay/android-developer/answer/6112435)
- [Personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Store graphics](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Developer content policies](https://support.google.com/googleplay/android-developer/answer/18258653)
- [Play App Signing](https://developer.android.com/studio/publish/app-signing)
- [Firestore rule testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
