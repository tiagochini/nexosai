Implemented the safe paid-media operational slice.

Changed files:
- lib/db/src/schema/paid-media.ts
- lib/db/drizzle/0018_paid_media_attribution.sql
- artifacts/api-server/src/modules/paid-media/attribution.service.ts
- artifacts/api-server/src/modules/paid-media/{paid-media.routes.ts,providers.ts,paid-media.domain.ts,proposals.service.ts,sync.service.ts}

Delivered:
- Tenant-scoped pixel/dataset registration with one-time opaque ingestion keys.
- Public keyed browser/server event receipt ingestion before auth, dataset-scoped dedupe, immutable receipt persistence, and diagnostics/match-rate reporting.
- Tenant-scoped, idempotent attribution touchpoint and CRM conversion ingestion.
- Consolidated reconciliation endpoint calculating CRM CPA/ROAS and provider CTR, including explicit unattributed conversion counts.
- CBO/ABO observed-state model and Meta campaign sync classification; read-only budget strategy route (no planning output is represented as executed).
- Provider capability-state API. Creative-status proposal validation is approval-gated and correctly refuses all providers until a verified provider-specific creative executor exists; no mock/provider-less mutation was added.
- Existing provider action boundaries remain proposal → approval → execute → provider verification/rollback.

Verification:
- `pnpm --filter @workspace/api-server exec tsx src/scripts/test-paid-media.ts` passed.
- Focused paid-media TypeScript error filter produced no errors. Full API typecheck remains blocked by pre-existing unrelated community/domains/native-media missing DB exports/type errors.

Provider-dependent blockers:
- Meta/TikTok CAPI/events transport and provider test-event diagnostics are not sent from receipt ingestion yet; that requires confirmed provider event API payload/consent and credential scopes.
- Creative-level pause remains explicitly unsupported in capabilities until a provider-confirmed creative mutation executor is implemented (especially TikTok).
- TikTok CBO/ABO is not classified because its current synced response has no verified canonical strategy field.