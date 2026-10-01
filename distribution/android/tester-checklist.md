# Internal Android test checklist

Record device model, Android version, installation source, app version/code, signer and date. Use a disposable life and account; do not submit private credentials in bug reports.

1. Launch, create a life and receive a real AI event.
2. Press hardware/gesture Back while an event is pending; choose an option and verify history.
3. Open nested Activities; Back closes the submenu, then the sheet. Root Back backgrounds the app.
4. Exercise the account keyboard, landscape/portrait, and gesture/three-button navigation.
5. Link the guest with Google and verify UID/save continuity. Cancel a picker and verify the guest is preserved. Sign into an existing account and verify its own save loads.
6. Link/sign in with a disposable email account. Force-stop and reopen; verify the right life and provider.
7. Report an AI event; verify request acknowledgment without resolving the event or sending the full life.
8. Request deletion of the disposable account. Verify operator fulfillment removes Auth plus Firestore data; a receipt alone is not deletion.
9. Open the web deletion page without the Android app and request deletion of the disposable signed-in account.
10. Verify the public privacy/contact links and offline/error/quota messages.

Physical-device Google, keyboard/rotation and Play-installed signer checks remain pending. A new personal Play account needs the applicable 12-tester, 14-day closed test before production access. Internal testing alone does not satisfy that period. Tester invitations require explicit recipients and authorization.
