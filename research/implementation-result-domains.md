Implemented domain and autonomous landing foundations.

Changed:
- `lib/db/src/schema/domains.ts`: lifecycle/registrar fields, durable idempotent domain operation records, DNS record storage.
- `lib/db/src/schema/pages.ts`: lead-capture sequence binding, immutable landing revisions, deployment records/statuses.
- `artifacts/api-server/src/modules/domains/{registrar.adapter,domains.service,domains.routes}.ts`: real HTTP registrar contract (availability/register/renew/DNS), tenant ownership checks, idempotency, audit event on registration, explicit `capability_blocked` when no registrar configuration, renewal-due scheduler entry point.
- `artifacts/api-server/src/modules/landing-publication/{landing-publication.service,landing-publication.routes}.ts`: validated/safely materialized generated landing revisions, capture binding, custom-domain binding, public host+slug resolver, deployment records, provider-confirmed publication only, and capability-blocked deployment behavior.
- `artifacts/api-server/src/modules/whitelabel/whitelabel.service.ts`: white-label custom-domain flow now creates/owns matching domain lifecycle record and marks it DNS-verified only after existing verification succeeds.
- `artifacts/api-server/src/routes/index.ts`, `artifacts/api-server/src/lib/env.ts`: mounted `/domains` and `/landings`; added registrar/deployment configuration boundaries.

Validation: `tsc -p lib/db/tsconfig.json --noEmit` passes. API typecheck has existing unrelated project errors, but after rebuilding DB declarations no errors were emitted for the new domains, landing-publication, or updated whitelabel modules.

Provider-dependent blockers: actual mutations remain deliberately blocked until `REGISTRAR_API_URL`, `REGISTRAR_API_KEY`, `REGISTRAR_PROVIDER`, and (for landing publication) `LANDING_DEPLOYMENT_URL` plus `LANDING_DEPLOYMENT_TOKEN` are configured. The HTTP registrar/deployment endpoint payload/response contracts must be implemented against the selected real providers; no mock success paths were introduced.