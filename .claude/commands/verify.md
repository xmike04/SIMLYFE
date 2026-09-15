# /verify — Run the Verification Pipeline

Run the full verification pipeline in the repository's required order:

1. `npm run lint`
2. `npm test`
3. `npm run build`

Report failures with the exact error. Do not fix anything; this command only runs checks and reports results. For browser-flow changes, include `npm run test:e2e` and distinguish mocked browser results from live-service verification. See [development](../../docs/development.md#required-checks).
