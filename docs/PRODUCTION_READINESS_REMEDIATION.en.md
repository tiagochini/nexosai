# NexOS AI — Production readiness and remediation reference

Versão em português: [PRODUCTION_READINESS_REMEDIATION.md](./PRODUCTION_READINESS_REMEDIATION.md)

**Review date:** October 3, 2026  
**Scope:** monorepo, API, frontend, database, Redis, queues, integrations,
security, recovery, concurrency, and AI quality.

## 1. Verified state

- Linux CI build and typecheck pass.
- Secret scanning and Git history audit pass.
- PostgreSQL was verified with 172 tables and 69 schema entries.
- Transactional and concurrent registration, concurrent credits,
  orchestration fallback, checkpoint/resume, and operational health passed
  locally.
- The 22 GLP22 capabilities remain at 20 `PARTIAL`, 2 `BLOCKED`, and 0
  `HEALTHY`.
- The initial dependency audit found 75 vulnerabilities in the runtime graph:
  39 high, 31 moderate, and 5 low. After dependency remediation,
  `pnpm audit --prod` found no known vulnerabilities on October 3, 2026.

## 2. Readiness criteria

The system should only be considered ready for open production when:

1. credentials are not sent to AI models, logs, or unencrypted storage;
2. no known high-severity vulnerability remains in an exposed runtime path;
3. critical tests run automatically in CI with disposable PostgreSQL and Redis;
4. backup and restore, dependency outages, and recovery are exercised;
5. load and concurrency limits are documented;
6. a real end-to-end journey is completed in an authorized sandbox;
7. AI quality is measured with reproducible evaluations and human review.

## 3. Prioritized plan

### P0 — Credential security

- [x] Remove Academy default administrative credentials, protect the 11 reviewed
  routes and reject URL credentials; authorize the manual scheduler endpoint.
  Local evidence and compatibility: [ACADEMY_ADMIN_SECURITY.en.md](./ACADEMY_ADMIN_SECURITY.en.md).
- [ ] Move Academy administration to owner sessions and audit remaining routes/codes.
- [x] Use cryptographic randomness for Academy checkout/gift codes and validate
  gift batches before issuance, preserving existing codes.
  Local evidence: [ACADEMY_ADMIN_SECURITY.en.md](./ACADEMY_ADMIN_SECURITY.en.md).
- [x] Limit public Academy verification attempts by IP/subnet, resist spoofed
  origin headers and authenticate the webhook/simulated confirmation endpoint.
- [ ] Share quotas across instances and review code protection,
  expiry/revocation and personal-data exposure.
- [x] Block billing webhooks without a valid token and require additional privilege
  for manual confirmation; share safe comparison with Academy/product checkout.
  Local evidence: [BILLING_WEBHOOK_SECURITY.en.md](./BILLING_WEBHOOK_SECURITY.en.md).
- [x] Make billing confirmation, balance and ledger atomic and idempotent;
  validate concurrent confirmations, grants and deductions using local fixtures.
- [x] Verify billing against current Asaas ID, amount, method and status;
  block grants on outages/mismatches, recheck binding under lock and test with mocks.
- [x] Verify Academy webhook against Asaas payment/customer/reference/amount/status;
  commit purchase/conversion together and test concurrency without real delivery.
  Local evidence: [ACADEMY_PAYMENT_CONFIRMATION.en.md](./ACADEMY_PAYMENT_CONFIRMATION.en.md).
- [ ] Review reversals, historical balances/purchases and provider/database failure
  recovery; implement a durable Academy access-email outbox.

- [x] Remove previously committed secrets and clean Git history.
- [x] Prevent tokens, keys, and screenshots from being sent to the integrations
  assistant.
- [x] Remove tokens from Academy logs.
- [x] Escape dynamic values in Academy funnel/access emails; validate and
  escape URLs in the reviewed templates' attributes.
  Local evidence: [ACADEMY_FUNNEL_DELIVERY.en.md](./ACADEMY_FUNNEL_DELIVERY.en.md).
- [ ] Complete the sensitive-data audit for logs in the remaining modules.
- [x] Protect central/HTTP loggers, errors and child bindings from sensitive
  fields; remove unnecessary data at reviewed call sites.
  Scope and limits: [LOG_SECURITY.en.md](./LOG_SECURITY.en.md).
- [x] Remove private content from reviewed Meta/WhatsApp logs, provider responses
  and AI previews; add an AST logging guard to the local workflow.
- [x] Restrict realtime campaign rooms to the authenticated workspace,
  validate WebSocket/polling origins and disconnect on token expiry.
  Evidence: [REALTIME_SECURITY.en.md](./REALTIME_SECURITY.en.md).
- [x] Remove the default WhatsApp webhook secret.
- [x] Validate the WhatsApp webhook HMAC signature.
- [x] Encrypt integration tokens at rest with a key stored outside the database.
  Procedure: [INTEGRATION_TOKEN_ENCRYPTION.en.md](./INTEGRATION_TOKEN_ENCRYPTION.en.md).
- [x] Move refresh tokens out of `localStorage` into `HttpOnly`, `Secure`, and
  `SameSite` cookies, with rotation and revocation.
  Procedure: [AUTH_SESSION_SECURITY.en.md](./AUTH_SESSION_SECURITY.en.md).

### P1 — Dependencies and CI

- [x] Upgrade vulnerable direct API dependencies and patched transitives.
- [x] Remove the unused legacy `html-pdf-node`/Puppeteer dependency chain.
- [x] Add `pnpm audit --prod` to CI, blocking every severity.
  Evidence: [DEPENDENCY_SECURITY_REMEDIATION.en.md](./DEPENDENCY_SECURITY_REMEDIATION.en.md).
- [ ] Run critical tests in CI with disposable PostgreSQL and Redis.
- [x] Run authentication, concurrent registration, and encryption tests in CI
  with disposable PostgreSQL. Redis and remaining flows are still pending.
- [ ] Run empty-database bootstrap, verification, and rollback in CI.
- [ ] Run a full Git history audit in the security workflow.

### P2 — Infrastructure and recovery

- [ ] Upgrade Redis to a supported release, preferably Redis 7.
- [ ] Configure Redis as a persistent, monitored service.
- [ ] Test complete backup and restore procedures.
- [ ] Exercise PostgreSQL, Redis, and external-provider failure scenarios.
- [ ] Measure load, latency, saturation, and recovery under realistic
  concurrency.

### P3 — Product journey and quality

- [ ] Complete the sandbox journey: registration → campaign → content →
  publishing → lead → checkout → attribution.
- [x] Prevent the Academy funnel from marking emails as sent without a configured
  provider; advance only after provider acceptance, without production simulation.
  Local evidence and limits: [ACADEMY_FUNNEL_DELIVERY.en.md](./ACADEMY_FUNNEL_DELIVERY.en.md).
- [ ] Certify Academy sending idempotency, concurrency and recovery.
- [x] Fix Gmail dispatch and receipt validation for Academy transactional access emails.
- [ ] Persist an outbox and reconcile transactional Academy access-email failures.
- [x] Make Academy enrollment transactional/idempotent per lead and atomically
  claim dispatch across welcome/scheduler calls; quarantine ambiguous outcomes.
  Local concurrency and separate-process crash tests passed. Read-only inspection
  and explicit quarantine of ambiguous outcomes are implemented. Host/database
  crashes and real provider reconciliation remain pending in
  [ACADEMY_FUNNEL_DELIVERY.en.md](./ACADEMY_FUNNEL_DELIVERY.en.md).
- [ ] Implement object-access grants for the media worker.
- [ ] Complete and certify video and paid-media executors.
- [ ] Create a versioned AI evaluation set with criteria for each artifact.
- [ ] Define minimum scores, human review, and prompt/model regression checks.

## 4. Evidence required for each remediation

Each item must include:

- an automated test that fails before the change and passes afterward;
- confirmation that logs and responses contain no secrets;
- passing typecheck and build results;
- database impact and rollback procedure, when applicable;
- an updated checklist;
- confirmation from remote workflows.

## 5. Release state

While any P0 item remains open or a high-severity vulnerability exists on an
exposed path, the recommended release target is staging or a restricted canary
without real customer credentials. Open production requires completed P0 and P1
work, plus minimum evidence for P2 and P3.
