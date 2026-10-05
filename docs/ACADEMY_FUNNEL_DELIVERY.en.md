# Academy — truthful sending state

Updated October 4, 2026. [Português](./ACADEMY_FUNNEL_DELIVERY.md).

## Remediation

Without `RESEND_API_KEY` or both `GMAIL_USER`/`GMAIL_APP_PASSWORD`, the email
stays `scheduled`, with `EMAIL_PROVIDER_NOT_CONFIGURED` and null `sentAt` and
`resendId`. There is no longer a fictitious `dev-no-provider` success. The
scheduler can retry after configuring a provider and restarting the API.

Resend takes precedence. Gmail works when only Gmail is configured.
The `sent` result requires a valid identifier returned by Resend or recipient
acceptance by Gmail with a message identifier.
**This means provider acceptance, not delivery to the recipient's inbox.**
Failures become `failed`, with bounded codes; provider response bodies and
exception messages are not persisted. There is no fallback after Resend fails,
because acceptance may have occurred before a network interruption.

Leads start at `funnelStep = -1`. Welcome delivery and the scheduler advance
only after acceptance and never regress a later step. Welcome delivery honors
unsubscribe and does not resend `sent` or `skipped` records. The scheduler
retains unsubscribe rules and excludes sales offers for converted leads.

## Validation

```powershell
pnpm --filter @workspace/api-server run test:academy-funnel-delivery
pnpm --filter @workspace/api-server run test:academy-funnel-db
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
pnpm run security:check-runtime-logging
```

The database test requires `DATABASE_URL` and valid API configuration. It creates
a temporary lead and deletes it and its emails in `finally`. All transports are
mocked; scheduler execution is scoped to the test lead. No real email is sent.
These local checks passed; the workflow was updated but not executed remotely
in this stage because there was no push.

## Operations and limits

- Restart the API with the new build to apply the fix. No automatic restart or
  real delivery test was performed.
- No schema change. Historical records were not modified. Find previous false
  successes with this read-only query:

  ```sql
  SELECT count(*) FROM academy_funnel_emails
  WHERE resend_id = 'dev-no-provider';
  ```

  Do not resend in bulk. Review consent, conversion, age and duplication before
  deciding on any reprocessing.
- The scheduler does not automatically retry `failed` records. Welcome delivery
  can be retried by an explicit call. Interruptions with an ambiguous outcome
  require provider reconciliation before another attempt.
- Still pending: atomic claims across processes/welcome/scheduler, enrollment
  and sending idempotency, backoff retries, pending-message ordering and age
  limits, delivery/bounce webhooks, reconciliation when provider acceptance
  succeeds but persistence fails, and full consent/unsubscribe flow review.
  This fix does not certify exactly-once delivery.
- Rollback: restore only the previous code and rebuild the API. No database
  rollback is required, but this would reintroduce false successes; prefer a
  forward fix. Do not modify accepted-send records.
