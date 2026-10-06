# Technical P0 security closeout

Status: local implementation completed; release closeout still requires the full
build, actual administrator configuration and Asaas sandbox evidence.

October 5, 2026. [Português](P0_SECURITY_CLOSEOUT.md).

## Implemented and validated locally

- Academy administration requires a session-bound JWT, an explicitly authorized user UUID, an active login session and ownership of an active workspace. Session revocation blocks old tokens even after another login. Authorized requests record actor, static route, method and outcome, without bodies, passwords, access codes or emails.
- Fixed PINs, magic owner tokens and URL secrets were removed from the separate `artifacts/nexos-academy` frontend. The dashboard uses individual login and keeps its access token in memory; refresh remains HttpOnly. Gift creation sends an idempotency key and preserves it for failed-request retries.
- Atomic Redis quotas are shared across instances and survive process replacement. IPv6 addresses share a /56 quota; direct clients cannot spoof forwarded IPs. Redis failure returns 503 without purchase queries or permissive fallback. Verification, tutor, checkout and public lead capture have independent limits of 10 calls/15 minutes per origin.
- Public verification returns only `valid` and `productId`, with `Cache-Control: no-store`. Old stored access flags do not authorize access. Codes are verified on startup and every five minutes; revocation removes access. The AI tutor requires active complete-course access or an authorized owner session before calling AI.
- Individual administrators can reconcile uncertain delivery after 15 minutes using provider evidence, an explicit decision and an idempotency key. Decision, actor and evidence hashes commit with delivery state. Reconciliation never automatically sends another message.
- Refunds, chargebacks, negative debt, consumption blocking and idempotent monthly allocation were tested concurrently. The local database has no historical purchases. Unverified legacy grants still require review instead of guessed debits.
- Logging field review and an AST guard cover TypeScript API runtime. Protection now also handles questions, names, titles, keywords, codes, raw responses, configuration and metadata. Opaque canary tests do not rely solely on token-format recognition.
- Production startup rejects missing, short or whitespace-padded signing secrets; JWT verification accepts HS256 only. `test:production-signing` validates configuration without starting external services.

## Safe activation

1. Register the actual administrator account normally. Configure `ACADEMY_ADMIN_USER_IDS` with its UUID, comma-separated for multiple administrators. Email does not confer privilege. Log in again for a session-bound token. The local database has no users; no administrator or password was invented.
2. Keep `ACADEMY_ALLOW_LEGACY_ADMIN_SECRET=false`. Legacy compatibility requires explicit opt-in during development/testing and never works in production. Session/reconciliation routes reject it in every environment.
3. Apply `0067_academy_admin_audit.sql` before the new API. Preserve its tables during rollback. Old code reintroduces shared-credential administration and is not a production rollback strategy.
4. Configure private, persistent Redis and exact trusted proxy IPs. Quotas are origin-based, including students behind NAT; evaluate limits in staging. Do not bypass fail-closed behavior to conceal an outage.
5. Configure the Asaas sandbox credential and webhook tokens/events; complete an authorized sandbox journey before production activation. Local configuration lacks `ASAAS_API_KEY`, so external validation was not run. No real payment, refund or email was performed.

## Uncertain-delivery reconciliation

Stop the responsible worker and verify the case with the provider first. Fifteen minutes is an additional barrier, not proof of rejection. Keep `sending` when evidence remains ambiguous.

`POST /api/academy/admin/delivery-reconciliation`, with `Authorization: Bearer <access token>` and `Idempotency-Key`:

```json
{
  "jobId": "UUID",
  "decision": "accepted",
  "providerId": "opaque-provider-receipt",
  "evidenceReference": "reference-to-a-verified-provider-case"
}
```

Use `not_accepted` without `providerId` only when rejection/non-acceptance is proven. A separate explicit `/admin/resend` intent can then create another attempt. Operators must retain full evidence in restricted storage; the database stores reference hashes only. Administrative audit status 0 means completion is pending/unrecorded or interrupted, not success.

## Evidence and release limitations

Local tests: `test:academy-p0-db`, `test:academy-quota-redis`, `test:academy-admin-security`, `test:academy-verification-security`, `test:academy-delivery-lifecycle-db`, `test:auth-sessions-http`, `test:auth-cookie-security`, `test:academy-access-outbox-db`, `test:billing-reversal-db` and `test:log-security`. Client guard, full typecheck, API build, secret scanner, sensitive-history audit and dependency audit passed. Full/frontend builds on Windows became excessively slow with high memory usage; owned attempts were stopped. CSS scanner/compiler passed in isolation, which does not certify the bundle. Experimental CSS changes were reverted; root cause is unconfirmed. CI now includes disposable PostgreSQL and Redis, but remote execution was not performed: the user prohibited pushing.

Technical local closeout is not production approval. Actual administrator configuration, Asaas credentials/webhooks, sandbox validation and authorized remote execution remain. Log retention/access, third-party consoles, diagnostic scripts and Python services are not certified by this guard. Course materials include static frontend content: these changes protect administration/API/tutor, not DRM; exclusively server-authorized paid-content delivery remains a separate licensing workstream.
