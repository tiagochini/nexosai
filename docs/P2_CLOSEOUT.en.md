# P2 — local infrastructure and recovery

Authorized scope on October 6, 2026: prepare and validate locally. Existing
computer services and production are untouched. Detailed evidence is in
[P2_VALIDATION_RESULTS.json](./P2_VALIDATION_RESULTS.json) and the
[Portuguese runbook](./P2_CLOSEOUT.md).

Redis 7.4 is a [supported security branch](https://github.com/redis/redis/security/policy).
The Compose service uses persistent storage, automatic restart, an external
password file, loopback binding, a 768 MiB container limit and 512 MiB noeviction
policy. Health checks cover authentication, AOF and snapshot health. AOF everysec
can lose the last second on host failure; see
[Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).

PostgreSQL acquisition is bounded and idle pool failures no longer crash the
API. Readiness requires PostgreSQL and Redis; liveness remains independent.
BullMQ producers bound command waiting and workers reconnect continuously.
Stable job IDs and reconciliation remain necessary for ambiguous writes.
QUEUE_PREFIX isolates environments. An inert worker tests the shared connection
configuration without enabling campaign, AI or message consumers.

The local runner dumps/restores the full schema and data into a new database,
compares every table's row count/hash, checks schema and preserves encrypted
integration rows. Redis RDB recovery checks key values, types, TTLs and delayed
jobs. Backup transport uses streaming AES-256-GCM with wrong-key/tamper rejection
and authenticated output publication. Keep real backup keys outside Git and
separate from both archives and integration keys. Test keys are ephemeral.

Real balance/debit HTTP bursts use 1/8/32 concurrent clients; a synthetic query
delay exercises pool saturation. The report records latency, throughput, errors,
pool waiting and container resources. Begin local staging with eight simultaneous
transactional requests and treat 32 as a spike test. These results do not measure
the complete AI/video journey or certify production capacity.

Failure drills cover Redis crash/prolonged outage/memory pressure, PostgreSQL
outage and loopback HTTP provider 429/503/malformed/timeout responses through
production payment verifiers. The runner removes only its own containers and
volumes. GitHub's Infrastructure recovery workflow repeats the drill and uploads
metrics only. No push was performed; remote execution remains unconfirmed.

Production activation still requires a host-specific checkpoint across database,
Redis and media, off-host encrypted retention, key recovery, object-storage
backup validation and restoration with consumers disabled until uncertain
deliveries are reconciled. Daily backups and monthly restore drills are proposed
operational parameters, not installed external automations. This change adds no
schema migration; preserve volumes/snapshots before image/configuration rollback.

Full build, typecheck, operational health, logging guard, secret scan, Academy
client protection and reachable-history audit passed. Backup authentication
tests cover empty/multi-chunk files, wrong keys, tampering and existing targets:
`node --test scripts/backup-crypto.test.mjs` (also configured in CI).
Redis ready checks verify the server before declaring recovery. Outage recovery
timings include the restart command and operational verification. Use inert test
configuration; do not point outage tests at existing services.
