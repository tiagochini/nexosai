# Academy — truthful sending state

Updated October 5, 2026. [Português](./ACADEMY_FUNNEL_DELIVERY.md).

## Remediation

Without `RESEND_API_KEY` or both `GMAIL_USER`/`GMAIL_APP_PASSWORD`, the email
stays `scheduled`, with `EMAIL_PROVIDER_NOT_CONFIGURED` and null `sentAt` and
`resendId`. There is no longer a fictitious `dev-no-provider` success. The
scheduler can retry after configuring a provider and restarting the API.

Resend takes precedence. Gmail works when only Gmail is configured.
The `sent` result requires a valid identifier returned by Resend or recipient
acceptance by Gmail with a message identifier.
**This means provider acceptance, not delivery to the recipient's inbox.**
Rejections become `failed`. Timeouts, transport errors, Resend 5xx responses
and invalid acceptance receipts remain `sending`, with an uncertain outcome
and no automatic redelivery. Both use bounded codes; provider response bodies and
exception messages are not persisted. There is no fallback after Resend fails,
because acceptance may have occurred before a network interruption.

Leads start at `funnelStep = -1`. Welcome delivery and the scheduler advance
only after acceptance and never regress a later step. Welcome delivery honors
unsubscribe and does not resend `sent` or `skipped` records. The scheduler
retains unsubscribe rules and excludes sales offers for converted leads.

## Concurrency and interruption

Enrollment is transactional and idempotent per lead ID: only one conditional
update of a null `funnelEnrolledAt` creates the five emails. Repeated calls do
not restart the sequence or erase progress. This does not deduplicate separate
leads sharing an email address or historical duplicate records.

Before dispatch, a PostgreSQL compare-and-set claims the row by changing
`scheduled` to `sending`. Only the winner dispatches; other welcome/scheduler
calls do not process that row. Unsubscribe/conversion rules are checked again
after claiming. A consent change after this check can still race with dispatch.

The email result and lead progress commit in the same transaction. An interruption
or persistence failure can leave `sending` with `DELIVERY_IN_PROGRESS_OR_UNKNOWN`.
There is no automatic recovery of this state: check the provider before any
reprocessing. The `sending` funnel statistics field makes these cases visible,
but does not by itself distinguish active dispatch from interrupted dispatch.

The database test covers eight concurrent enrollments, simultaneous contention
between 16 welcome/scheduler calls, held in-flight delivery and simulated
interruption. These use concurrent PostgreSQL connections within one test
process. An additional test uses three separate Node processes: only one reaches
simulated dispatch, the test terminates that process and a replacement does not
resend the record. This validates claiming and quarantine after process death,
but does not certify host/database crashes or reconciliation with real providers.

## Read-only operational inspection

```powershell
pnpm --filter @workspace/api-server run academy:funnel-check
```

Run with `DATABASE_URL` available in the environment. The command uses a
PostgreSQL `READ ONLY` transaction and does not call providers, send emails or
modify records. It reports counts by state, unconfigured pending messages,
historical false successes, duplicate groups and `sending`/`failed` record IDs
for review. It excludes email addresses, names, credentials, message bodies
and raw persisted errors. Lists are capped at 100 items with truncation indicators.

Exit codes: `0` no detected review items, `2` review required, `1` execution error.
`0` does not certify provider configuration, overall health or actual delivery;
`2` does not authorize redelivery. `scheduledAt` is the schedule date, not the
claim timestamp; `sending` may be active or interrupted.

Local validation found zero counts after test cleanup. Duplicate, false-success
and missing-configuration detectors were also tested with temporary records.

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
- Neither the scheduler nor welcome calls automatically retry `failed` or
  `sending`. Before reopening a record as `scheduled`, check provider acceptance,
  consent, conversion and duplication. No reprocessing endpoint was added.
- Still pending: lead/history deduplication, provider-side idempotency,
  backoff retries, pending-message age limits, delivery/bounce webhooks,
  automated interrupted-dispatch alerts and operational reconciliation when provider acceptance
  succeeds but persistence fails, and full consent/unsubscribe flow review.
  This fix does not certify exactly-once delivery.
- Rollback: restore only the previous code and rebuild the API. No database
  rollback is required, but it may reintroduce previously fixed failures; prefer a
  forward fix. Old code does not recognize `sending`; reconcile these records,
  rather than bulk-converting them to pending. Do not modify accepted-send records.
