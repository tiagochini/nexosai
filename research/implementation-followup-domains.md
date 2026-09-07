Completed the migration and focused DB test deliverables.

Added:
- `lib/db/drizzle/0019_domains_landing_publication.sql`
  - Repeat-safe enum creation.
  - `domains` lifecycle/registrar/renewal columns.
  - `pages.lead_capture_sequence_id` FK.
  - Domain operation/DNS and landing revision/deployment tables and unique idempotency indexes.
  - Database trigger enforcing immutable revision content while allowing lifecycle status changes.
  - Validated by executing it twice inside one SQL transaction, then rollback; both passes completed successfully.
- `artifacts/api-server/src/scripts/test-domains-landing-foundations.ts`
  - Minimal isolated workspace fixtures, avoiding unrelated E2E fixture schema dependencies.
  - Covers workspace ownership denial, one durable operation per workspace/key, capability_blocked without registrar, capture binding, DB-enforced immutable revision contents, capability_blocked deployment retaining preview status, and deployment idempotency.
- `artifacts/api-server/package.json`: `test:domains-landing-foundations` script.

Focused test result: `pnpm --filter @workspace/api-server run test:domains-landing-foundations` passed.

Focused typecheck result: DB typecheck passed; no diagnostics for the domain/landing/whitelabel modules or new test from the API typecheck filter.

The test intentionally does not simulate or call a provider. Provider-confirmed publication remains dependent on a configured real deployment sandbox (`LANDING_DEPLOYMENT_URL` and token); absent that it is verified fail-closed and cannot transition a page to published.