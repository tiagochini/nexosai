Extended dossier enforcement across paid-media and social provider mutation boundaries.

Changed files:
- artifacts/api-server/src/modules/masterplan/masterplan.service.ts
- artifacts/api-server/src/modules/paid-media/proposals.service.ts
- artifacts/api-server/src/modules/paid-media/actions.service.ts
- artifacts/api-server/src/modules/social/social.service.ts
- artifacts/api-server/src/modules/social/social.autopost.service.ts (type shape updated for new bound fields)
- artifacts/api-server/src/scripts/test-masterplan-unit.ts
- artifacts/api-server/src/scripts/test-social-post-ownership.ts
- lib/db/src/schema/execution-evidence.ts
- lib/db/src/schema/index.ts
- lib/db/src/schema/paid-media.ts
- lib/db/src/schema/social-posts.ts
- lib/db/drizzle/0019_execution_evidence.sql

Behavior:
- Added shared fail-closed `matchesApprovedDossier` predicate and focused tests for missing, superseded, and fingerprint-stale bindings.
- Paid-media proposals may be planned before approval, but provider execution now requires a campaign, approved dossier version, and exact current fingerprint. It preserves existing approval/autonomy/pause gates.
- Paid-media records append-only planned evidence at proposal creation, attempted evidence immediately before provider mutation, and provider_confirmed only after provider verification succeeds. Failures cannot emit provider_confirmed.
- Social post creation resolves and persists the current approved dossier when present; publishing requires that binding still match. It records planned, attempted, and provider_confirmed evidence only after a successful provider result. Missing/stale bindings fail before integration/provider access.
- Updated social ownership regression to assert a locally owned but unbound post makes zero Graph calls and has zero provider_confirmed evidence.

Validation:
- Passed: full API `tsc --noEmit`; `test:masterplan-unit`; `git diff --check`.
- Attempted `test:social-post-ownership`; it is blocked before test execution because the current test DB has not applied migration 0019 (`paid_media_proposals.campaign_id` missing). No provider request was reached. Apply `0019_execution_evidence.sql`, then rerun that focused test.

Provider-dependent boundary remains intentional: provider_confirmed is written only from actual successful provider receipt/verification paths; no planning or failed provider path is marked confirmed.