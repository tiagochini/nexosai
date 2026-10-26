# P3 — local validation and external staging preparation

Authorized scope: local mocked providers and preparation for external staging.
No live publication, payment or email was sent. See the detailed
[Portuguese runbook](./P3_CLOSEOUT.md) and [results](./P3_VALIDATION_RESULTS.json).

Delivered locally:

- Connected registration/workspace creation, campaign/content fixtures, explicit
  publication preview, mocked Meta receipt/readback, consented HTTP lead capture,
  mocked Asaas checkout and concurrent idempotent attribution. One BRL25 sale
  and conversion; foreign workspace references and payment amount mismatches fail.
- Academy funnel, access outbox and delivery-intent regressions cover concurrency,
  recovery and ambiguous-outcome quarantine. Provider acceptance does not certify
  inbox delivery; uncertain sends are not blindly retried.
- One-use signed object grants bind workspace/worker/job/lease/method/object and
  input hash. TTL is at most 60 seconds and never exceeds the lease; atomic nonce
  consumption blocks replay/races. Worker downloads verify SHA-256. Deploy the
  API and worker together; old workers cannot transfer without grants.
- Native media control and FFmpeg/ffprobe streaming tests use CPU fixtures;
  workers without CUDA refuse GPU inference. Supported paid-media contract and
  conditional execution tests use mocked providers. GPU/model certification and
  actual Meta staging remain pending. Google/TikTok launch is still unsupported.
- Versioned five-artifact AI screening, minimum 85/100, prompt/model/content
  regression checks and artifact-bound human review format. Synthetic references
  cannot certify real-model quality. The evaluator validates metadata, not reviewer
  identity or actual model invocation. Its report is advisory and cannot authorize
  publishing/spending. Full protocol: [AI_QUALITY_EVALUATION.md](./AI_QUALITY_EVALUATION.md).

Run `pnpm run test:p3-local`. Disposable PostgreSQL/Redis are on an internal
Docker network without public ports. Only explicit fixture credentials are used;
the runner does not load `.env`. Results are emitted only after all checks pass.
CI job `p3-product-local` is configured; remote execution remains unverified.

All workspace typechecks/builds passed sequentially after parallel execution
exhausted memory. Secret/logging guards, migration policy/checksums and AI
regressions passed. Existing sourcemap/chunk-size warnings remain. A temporary
local Docker interruption was not treated as successful validation; the complete
suite was rerun.

Fresh-database testing discovered procedural triggers and scoped foreign keys
missing from the historical table snapshot. Temporary publish staging is now off
(`PUBLISH_STAGE_ONE=false`). Forward migration `0068_restore_bootstrap_integrity.sql` restores
canonical landing, approval/SLA, conditional/evidence, realization, Council and
social-report protections (18 triggers and 37 missing foreign keys), including
the latest immutable-policy function, without rewriting data or historical migrations.
Verification rejects absent/disabled triggers and absent/unvalidated scoped keys.
Tests cover repeat application, missing-key/disabled-trigger detection and atomic
bootstrap rollback. Invalid legacy bindings make the whole migration fail;
investigate and repair with evidence before retrying instead of dropping protection.

Existing databases: back up, run `pnpm --filter @workspace/db migrate:tracked`,
then `verify`. New databases: explicit bootstrap, seed and verify. Rollback:
pause dispatch, revert API and worker together, retain integrity protections;
restore a verified backup into another database if schema compatibility requires
it. Never edit checksums or drop protection triggers to permit old writes.

External staging still requires HTTPS and external verified-TLS PostgreSQL,
backup/restore, owned test accounts and explicit consent, real provider
receipts/readback, host/database interruption drills, private CUDA GPU and approved
weights with verified provenance, real Meta bounded-budget execution/recovery,
real model outputs and human reviews, remote CI and remaining P0/P1 release gates.
Google/TikTok launch needs additional implementation. Local P3 is delivered;
full executor/model certification is open and M11/M12 maturity is unchanged.
