Implemented real Meta Conversions API delivery on top of receipt tracking.

### Changed files
- `lib/db/src/schema/paid-media.ts`
- `lib/db/drizzle/0020_paid_media_capi_delivery.sql`
- `artifacts/api-server/src/modules/paid-media/providers.ts`
- `artifacts/api-server/src/modules/paid-media/attribution.service.ts`
- `artifacts/api-server/src/modules/paid-media/paid-media.routes.ts`
- `artifacts/api-server/src/scripts/test-paid-media.ts`

### Delivered
- Added receipt delivery lifecycle fields:
  - `pending`, `sent`, `failed`, `capability_blocked`, `consent_withheld`
  - provider attempt timestamp, response evidence, provider error code/message.
- Added real Meta CAPI transport to `/{pixel_id}/events`, using the existing Graph transport and connected paid-media credential.
- Ensured dataset → paid-media account → connected integration ownership is checked before Meta token use. It will not select an arbitrary Meta integration in the workspace.
- Added consent-safe Meta normalization:
  - requires explicit `payload.marketingConsent === true`;
  - hashes email, phone, and external ID before transport;
  - allows `fbp`/`fbc`;
  - strictly allowlists Meta custom data fields;
  - excludes arbitrary raw payload/match-key data.
- Added server-event delivery behavior:
  - browser receipts remain persisted as pending browser-side evidence;
  - only server events attempt CAPI delivery;
  - same dataset/event ID is deduplicated;
  - atomic pending receipt claim prevents concurrent duplicate provider requests.
- Missing consent, match keys, provider capability, dataset ID, credential, or provider scope fail closed into receipt states; no false provider success is returned.
- Extended diagnostics with sent, capability-blocked, and failed provider delivery counts.
- Added fake-HTTP adapter-boundary contract coverage for CAPI request URL/body, `event_id`, action source, hashing, and raw-PII exclusion. No global fetch or live provider is used in the test.

### Verification
- Passed: `pnpm --filter @workspace/api-server exec tsx src/scripts/test-paid-media.ts`
- Passed: `git diff --check`
- Focused paid-media TypeScript filtering did not show errors from the files changed in this slice. Existing concurrent paid-media proposal/action schema errors were present outside this implementation’s CAPI changes.

### Remaining provider-dependent blockers
- Meta CAPI runtime still requires a connected paid-media Meta integration with the required Events API scope and a registered non-empty Pixel/Dataset external ID; absent/rejected credentials/scopes are recorded as `capability_blocked`.
- TikTok Events API remains explicitly unsupported and is capability-blocked without making a provider request.