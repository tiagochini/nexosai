# Durable Academy access-email outbox

Updated: 2026-10-05. Scope: automatic payment confirmation through webhooks.

## Behavior

Migration `0064_academy_access_email_outbox.sql` adds one unique job per purchase.
Confirmation, lead conversion and job creation commit in one transaction and
roll back together. No historical backfill or replay-driven resend.

The webhook requests a best-effort attempt after commit; losing that wake-up
does not lose the job. Outside local safe mode, the worker polls on startup and
every minute in batches of up to 20. Atomic `scheduled → sending` database claims
allow only one process per attempt. Eligibility/backoff use database time.

| State | Meaning/action |
| --- | --- |
| `scheduled` | Worker may claim. Missing provider configuration defers five minutes. |
| `sending` | In progress or unknown outcome; never automatically reclaimed by age. |
| `sent` | Provider accepted with receipt, not proof of inbox delivery. |
| `failed` | Known rejection; review required, no automatic retry in this stage. |
| `skipped` | Purchase was not confirmed when dispatch attempted. |

Process exit after commit but before claim is recoverable automatically. After
claim, provider acceptance may be unknown and the job stays `sending`. Reconcile
with the provider before resending, including acceptance followed by database
completion failure. This is not exactly-once delivery or automatic recovery of
ambiguous outcomes.

## Security and operations

The queue stores purchase reference, state, attempts, timestamps, receipt ID and
bounded error codes. It does not copy recipient, access code, HTML, credentials
or error bodies. Dispatch reads the purchase only to build the message and checks
that it is still confirmed.

```powershell
pnpm --filter @workspace/api-server run academy:access-check
pnpm --filter @workspace/api-server run test:academy-access-outbox-db
```

Read-only inspection returns counts and up to 100 `sending`/`failed` job IDs,
without recipients, tokens or message content. Exit 0: no such jobs; 2: in-flight/
uncertain or failed jobs to check; 1: inspection error. Not every `sending` job
is abandoned. Load private environment configuration normally without exposing
values in commands, documents or logs.

Existing local safe mode remains active, disabling this automatic worker along
with other schedulers. Jobs persist; interactive webhook confirmation still
requests immediate dispatch. Tests neither enable real delivery nor alter secrets.

## Validation

Local additive migration applied/verified: 173 public tables, 70 schema history
entries. Existing business users/workspaces/campaigns unchanged. Mocked regression
covers uniqueness, 16 concurrent workers, persistent receipt, missing-provider
backoff, rejection, unknown outcome/private error handling, purchase/outbox rollback
and unconfirmed-purchase blocking. A fresh process resumes an unclaimed job.
Three processes contend for another job; the owned winner is terminated and a
replacement cannot redeliver the uncertain attempt. Only fixture processes/UUIDs
are affected. Webhook, authorization, access, transport and logging regressions
also passed.

## Limits

Resend, administrative confirmation and gift routes still use earlier flows and
do not automatically gain this guarantee. Confirmed historical purchases do not
create jobs on replay. Authorized reconciliation/audited retry tooling, migration
of other flows, operational metrics, reversals/revocation and end-to-end provider
sandbox certification remain pending. Keep the table/jobs if rolling back code;
do not delete the outbox.
