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
credit-grant/manual-confirmation idempotency and concurrency, replay protection,
session-based administrative authorization and auditing remain pending. Billing
is not fully certified. Rolling back can reintroduce unsafe access; prefer a
forward fix and never reopen routes because a secret is absent.
