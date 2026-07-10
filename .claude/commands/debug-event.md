# /debug-event — Diagnose the LLM Event Pipeline

Investigate why AI-generated events are failing or misbehaving in SIMLYFE without exposing player state, prompts, credentials, or provider bodies.

## Steps

1. Read `src/engine/llmService.js` and `src/engine/firebaseToken.js` in full. Confirm:
   - `VITE_SUPABASE_URL` and a publishable/legacy anon gateway key are present.
   - A Firebase ID-token provider was installed after anonymous sign-in.
   - `Authorization` carries the Firebase token and `apikey` carries only the Supabase public key.
   - The request contains only `{ state, actionContext, narrativeMode }` and stays within 16 KiB.
   - The 20-second budget covers token retrieval and fetch.

2. Read the lazy Firebase setup in `src/engine/gameState.js` and `src/config/firebase.js`. Check all six `VITE_FIREBASE_*` variables, anonymous-auth success, cancellation guards, and whether the token provider is cleared only during teardown.

3. Read `supabase/functions/generate-event/index.ts` and `contract.ts`. Check:
   - The deployed origin exactly matches `ALLOWED_ORIGINS`.
   - `FIREBASE_PROJECT_ID`, `RATE_LIMIT_HMAC_SECRET`, `OPENAI_API_KEY`, and Supabase runtime credentials exist server-side.
   - Firebase RS256 verification succeeds before quota/provider access.
   - The request passes type, size, and deadline validation.
   - The quota RPC is deployed and callable only through the service role.
   - OpenAI returns the strict schema and the edge normalizes it to `{ event, meta }`.

4. Trace both callers in `gameState.js`:
   - `ageUp()` must surface an error event, emit redacted diagnostics, and release `isAging` in `finally`.
   - `triggerActivityEvent()` must surface unexpected rejections and release its guard in `finally`.
   - `EventModal` must receive `{ description, choices: [{ text, effects }] }`.

5. Inspect only redacted operational evidence: request ID, safe error code, HTTP status, elapsed time, model, and normalized usage. Never copy raw provider responses, tokens, prompts, action context, names, history, or save data into logs or an issue.

6. Run the focused gates:

   ```bash
   npx vitest run src/tests/llmService.test.js src/tests/gameState.diagnostics.test.jsx supabase/functions/generate-event/contract.test.ts
   CI=1 npm run test:e2e -- --project=chromium
   npx -y deno@2.9.2 check --no-lock --node-modules-dir=none supabase/functions/generate-event/index.ts
   ```

7. Report:
   - Root cause in one sentence.
   - Affected file and line.
   - The redacted request/error code, if available.
   - A concrete fix.
   - The regression test to add or update.

## Common Failure Modes

- Firebase browser configuration is incomplete, so anonymous auth never installs a token provider.
- The Firebase project ID used by the frontend differs from the edge token audience.
- The frontend origin is absent from the exact edge allowlist.
- The Supabase key is incorrectly used as the bearer token instead of only as `apikey`.
- The rate-limit migration or service-role RPC access is missing.
- The user or project quota is exhausted (`429`).
- The provider times out, refuses, truncates, or returns output that fails strict validation.
- A preview deployment uses a new origin that was not added to `ALLOWED_ORIGINS`.

## When to Use

Run this whenever the game shows an authentication, timeout, rate-limit, service, or invalid-response event; a modal is blank; events stop firing; or the edge function/configuration changes.
