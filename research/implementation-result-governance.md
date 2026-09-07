Implemented the focused governance/video execution boundary.

Changed files:
- lib/db/src/schema/native-media.ts
- lib/db/drizzle/0009_masterplan_video_evidence.sql
- artifacts/api-server/src/modules/video-production/native-media-engine.service.ts
- artifacts/api-server/src/modules/video-production/native-media.routes.ts
- artifacts/api-server/src/scripts/test-native-media-control-plane.ts
- artifacts/api-server/src/scripts/test-native-media-http.ts
- services/native-media-worker/worker.py

Delivered:
- Campaign-bound native video jobs now fail closed without an approved masterplan and persist the resolved approved masterplan ID/context fingerprint; supplied stale/mismatched bindings are rejected.
- Idempotency keys are validated, persisted, uniquely indexed per workspace/project, and return the existing job on retry.
- Append-only job evidence explicitly records planned, attempted, and artifact_qc states. Successful local rendering explicitly records QC as not_run and never implies provider_confirmed.
- Provenance API now returns evidence lineage in addition to provenance/usage.
- Completion telemetry requires CPU/GPU backend truth. GPU claims require an advertised CUDA worker and positive GPU seconds; CPU claims require zero GPU seconds. Server-stored provenance/usage contains backend truth and server output-verification evidence.
- Reference worker reports deterministic ffmpeg operations as CPU even when hosted on CUDA; only CUDA-gated inference operations report GPU duration.
- Added regression assertions for GPU-claim rejection, evidence lineage, and idempotent submission.

Validation:
- Passed: test:masterplan-unit, Python worker syntax compilation, git diff --check.
- Full API TypeScript check reached unrelated concurrent changes and failed only in domains/landing-publication/lifecycle files; no errors reported in these changed files.

Remaining provider-dependent blockers:
- A provider adapter must write provider_confirmed only after a verifiable provider receipt; native completion intentionally does not do so.
- Migration 0009 must be applied before native DB integration tests/use.
- Broader non-video provider mutations and legacy agent entry points still need equivalent mandatory approved-dossier/context enforcement; this change covers the native video execution boundary without treating planning as execution.