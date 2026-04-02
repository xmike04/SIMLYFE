# /debug-event — Diagnose the LLM Event Pipeline

Investigate why AI-generated events are failing or misbehaving in SIMLYFE.

## Steps

1. Read `src/engine/llmService.js` in full. Identify which path is active (Supabase proxy vs direct OpenAI fallback) based on the env vars present.

2. Read `supabase/functions/generate-event/index.ts`. Check:
   - Is `OPENAI_API_KEY` read from env correctly?
   - Is the `apikey` header being sent in the fetch to OpenAI?
   - Does the response parsing handle streamed vs non-streamed responses?
   - Is CORS configured correctly for the deployed origin?

3. Read the last 20 lines of `src/engine/llmService.js`. Check that:
   - Markdown code fences are stripped before `JSON.parse()`
   - The error path returns a valid event object (not null/undefined)
   - The schema returned matches `{ description, choices: [{ text, effects }] }`

4. Scan `src/components/MainGame.jsx` for how `currentEvent` is consumed. Confirm `EventModal` receives a well-formed event before rendering.

5. Check `src/tests/llmService.test.js` — do existing tests cover the failure case being investigated? If not, note the gap.

6. Output a diagnosis:
   - Root cause (one sentence)
   - Affected file:line
   - Recommended fix (concrete, not vague)
   - Whether a test should be added

## When to use
Run this whenever the game shows an error event, a blank event modal, or events stop firing entirely. Also useful after deploying a new version of the Supabase edge function.

## Tips & tricks
- Check Supabase edge function logs in the dashboard first — they show the raw OpenAI response and any thrown errors before they reach the client.
- The most common failure modes: (1) missing `apikey` header, (2) OpenAI rate limit surfacing as malformed JSON, (3) markdown fences not stripped.
- If `VITE_SUPABASE_URL` is set but `VITE_SUPABASE_ANON_KEY` is missing, the proxy call silently uses `undefined` as the key — this looks like an auth error in the logs.
- Run with `/debug-event` any time you change `llmService.js` or redeploy the edge function.
