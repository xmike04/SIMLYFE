# Data-safety and content declarations — owner review required

No Console form has been submitted. Compare these code-derived findings with SDK/provider terms before attesting.

| Data flow | Observed behavior | Draft declaration |
|---|---|---|
| Firebase Auth | Anonymous UID; optional Google name/email/photo or email/password authentication | Personal info: name, email, user IDs as applicable; account management |
| Firestore current life | Fictional character and gameplay history, choices, stats and portfolio | App activity / other user-generated content; app functionality |
| Supabase → OpenAI | Bounded game context and recent history; credentials excluded from provider prompt | Game content collected for functionality; sharing classification requires provider-contract review |
| Support inbox | Explicit event description/choices/reason/request ID or deletion-request metadata, under Firebase UID | Support content and user ID for developer review |
| Quota / diagnostics | HMAC-derived UID quota counters; sanitized server error metadata; provider infrastructure logs may include network metadata | Security/fraud prevention and diagnostics; verify SDK/infrastructure collection separately |

All application endpoints use HTTPS. Do not claim encryption at rest, exact provider retention, or no third-party sharing solely from HTTPS or source inspection. Provider processing may qualify for service-provider exceptions, but owner review is required.

No ad or billing SDK is present. Camera, microphone, contacts and precise-location permissions are absent. Character location/health/money are fictional, not measurements of the player; a typed name can still be personal information.

Account deletion is a request requiring operator fulfillment. The web and in-app controls do not prove fulfillment. Confirm response timing, data-retention policy and support contact, publish the privacy page, and test operator deletion of a disposable identity before claiming deletion availability in the Console.

Rating review: inspect the actual crime/violence, simulated gambling, alcohol/drugs, sexual references and language in game catalogs and generated narratives. Adults-only targeting does not confer an IARC rating. Preserve the mature game as instructed; resolve any distribution-policy incompatibility with the owner before changing content.
