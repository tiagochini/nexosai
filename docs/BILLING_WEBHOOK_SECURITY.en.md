# Billing — financial authentication

Local review: October 5, 2026. [Português](./BILLING_WEBHOOK_SECURITY.md).

## Webhook

`POST /api/billing/webhooks/asaas` does not process events without a valid token.
Absent, incorrect, array or URL-only credentials, or empty/surrounding-whitespace
configuration, receive `401` and `UNAUTHORIZED_WEBHOOK` before payment queries,
plan/credit changes or provider calls.

Send the token in `asaas-access-token` over HTTPS. Configuration precedence is:

1. `ASAAS_WEBHOOK_SECRET`, if the legacy variable is defined;
2. `ASAAS_WEBHOOK_TOKEN`, only when the legacy variable is absent.

An explicitly empty legacy variable disables billing webhooks even when the
shared variable is populated. Remove the legacy variable rather than clearing
it to use the shared token. Academy and product checkout use
`ASAAS_WEBHOOK_TOKEN`. All three flows share a constant-time comparator and
never log tokens. Nonempty tokens have a defensive 1,024-character limit;
there is no default secret.

Configure the same private token in provider endpoint settings and the server.
No credentials or Asaas settings were changed in this stage. Without valid
configuration, webhooks remain blocked after applying the new code.

## Manual confirmation

`POST /api/billing/confirm/:paymentId` still requires user authentication and
restricts the payment to the workspace, but now also requires a private random
32–256-character `BILLING_MANUAL_CONFIRM_SECRET`, configured on the server and
provided in `x-billing-admin-secret`. Otherwise it returns `403` and
`MANUAL_CONFIRMATION_FORBIDDEN` without querying or confirming payment.

Previously an authenticated user could confirm their own payment; that behavior
is blocked. Legacy clients without the header cannot confirm manually. Never
put the secret in public JavaScript, URLs, logs or the repository. No secret was
generated or saved in `.env.local`. This additional credential is temporary:
administrative role authorization and action auditing remain pending.

## Validation and limits

```powershell
pnpm --filter @workspace/api-server run test:billing-webhook-security
pnpm --filter @workspace/api-server run test:academy-admin-security
pnpm --filter @workspace/api-server run test:product-asaas-sandbox-unit
```

Local HTTP tests exercise rejection, configuration precedence and authenticated
users without additional privileges. The positive manual-confirmation test
exercises only the guard, not payment mutation. Authenticated test events without
a payment ID are ignored without database/provider access. No real payment,
subscription change, credit grant or email occurred.

Typecheck, build and logging security passed locally. The workflow was updated
but not executed remotely because there was no push. The running API was not
restarted. No schema migration or existing-payment changes were made.

Origin authentication does not prove settlement. Provider reconciliation review,
event replay protection,
session-based administrative authorization and auditing remain pending. Billing
is not fully certified. Rolling back can reintroduce unsafe access; prefer a
forward fix and never reopen routes because a secret is absent.

## Atomic payment confirmation and credit grants — 2026-10-05

Manual and external-ID confirmations now share one transaction: lock the payment,
update its status, and grant pack credits together with the ledger entry. A workspace
row lock prevents lost balance updates. The `billing-payment:<UUID>` key uses the
existing unique idempotency index; no migration is required. Direct credit grants
are transactional too. Approved cards receive credits before commit, with no
silently failing background task.

Only `pending` and `processing` may transition to `paid`. Terminal states return
a conflict and require explicit reconciliation. Ambiguous external IDs are blocked.
Replaying a paid record neither modifies it nor grants credits, including historical
records without a key. Historical balance inconsistencies are not repaired automatically.

`test:billing-credit-concurrency-db` covers 16 concurrent manual/provider confirmations,
8 separate payments, concurrent grants, repeated keys, cross-workspace conflicts,
invalid amounts, overflow, rollback/retry, workspace isolation, terminal states,
ambiguous external IDs, approved-card transactions using a mocked provider and replay.
Owned fixtures are removed in `finally`; external calls are forbidden in this test.
The regression is included in the workflow's database job.

Limits: provider acceptance followed by database failure still requires reconciliation;
a local transaction cannot make the provider transactional. Monthly balance resets and credit reversals
were not fixed in this stage. No real charges, API restart, push or secret changes.

## Canonical lookup and local restart — 2026-10-05

Before external-ID confirmation, billing queries `GET /v3/payments/{id}` in the
configured Asaas account. Webhook data is a notification, not payment proof.
ID, `value` converted to cents, local BRL currency and payment method must match
the local record. `netValue` is not compared because it excludes provider fees.
The lookup has a 10-second deadline. Outages, unsuccessful HTTP responses or
unreadable JSON return 503 without confirmation or grants. Incomplete objects
return 502; mismatches and deleted charges return 409.

Pix/boleto require `RECEIVED`; cards also accept `CONFIRMED`. Pix `CONFIRMED`
can be under precautionary hold, so it waits for receipt. Ineligible states are
acknowledged without local mutation. Guarded manual confirmation remains separate.

HTTP runs outside the transaction. Local record ID and ID/amount/method binding
are checked again under the row lock. Stored evidence contains only ID, status,
amount in cents, method and verification time, not the full provider object or
raw notification. Historical data is not deleted. Paid-record replay neither
queries the provider nor grants credits again.

`test:billing-settlement` covers the contract, status policy, values, identity,
currency, deadline, escaped URL, HTTP errors, timeout and malformed responses
with mocks. Database regression also covers spoofed notifications, provider
outage/retry and a local amount change during lookup. No real Asaas calls.

Official sources: [payment lookup](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca),
[creation and Pix caveat](https://docs.asaas.com/reference/criar-nova-cobranca),
[card response and amount fields](https://docs.asaas.com/reference/pay-a-charge-with-credit-card).

The project was started through `scripts/dev-local.mjs`, preserving existing local
safe mode with schedulers/automatic recovery disabled: API 8080, frontend 8081.
No secrets were changed or credential-free routes enabled. Academy, reversals,
recovery between provider acceptance and persistence, historical reconciliation,
session-based auditing and end-to-end sandbox certification remain pending.
Remote state can change after lookup; there is no distributed provider transaction
or complete billing certification.
