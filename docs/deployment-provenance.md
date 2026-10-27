# Deployment provenance

The frontend production bundle includes `/build-info.json`:

```json
{"schemaVersion":1,"commitSha":"<40 lowercase hexadecimal characters or null>"}
```

The build reads only the public `VERCEL_GIT_COMMIT_SHA` input, or `GITHUB_SHA`
when Vercel's input is absent. A missing or malformed value produces `null`.
The manifest asserts the input used by the build, not a signed attestation.
It does not include runtime environment values, configuration, or credentials.

To record an exact release:

1. Identify the reviewed repository commit and its passing application checks.
2. Confirm the hosting deployment completed for that commit and intended environment.
3. Fetch the deployment's `build-info.json` and compare its SHA with the deployment metadata.
4. Record the deployment URL, observed asset paths, UTC verification time, and the bounds of the browser checks.

A canceled preview is not a successful deployment. Local or CI desktop/mobile
smoke checks use controlled service responses; they do not prove a deployed
backend, paid model behavior, or cloud persistence. Keep prior successful
same-browser production canaries separate from a new release's checks.
