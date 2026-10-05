# Academy payment confirmation

Updated: 2026-10-05. Local validation using mocked provider and email delivery.

## Fix

Authenticated webhooks now locate purchases through the stored `asaasPaymentId`,
never the notification's `externalReference`, and cannot replace the payment binding.
Before confirmation, the Asaas lookup must match payment ID, external reference
equal to purchase UUID, stored customer ID and amount in cents. Deleted charges,
fractional cents and unsupported methods are rejected. The gross charge value,
not its fee-adjusted net value, is compared.

Pix/boleto require `RECEIVED`; cards also accept `CONFIRMED`. Risk-analysis
approval alone is insufficient: canonical status decides eligibility. Ineligible
states are acknowledged without granting access. Unknown events remain ignored.
Malformed financial notifications return 400 before purchase/provider lookup;
unauthenticated webhooks remain blocked before processing.

## Atomicity and privacy

Provider HTTP runs outside the transaction with a 10-second deadline. The purchase
row is then locked and its binding rechecked. Only `pending` can become `confirmed`.
Confirmation and matching leads' conversion markers commit together.

Only the concurrent webhook transaction winner schedules the access email.
Confirmed-purchase replay neither changes its timestamp, queries the provider
nor schedules delivery. HTTP acknowledgements contain no access code, email or
name. Full provider responses are neither persisted nor logged.

HTTP failure/timeout or unreadable JSON returns 503; incomplete response returns
502. Mismatch, duplicate provider ID, terminal state or changed binding returns
409, without confirmation/conversion. Corrected transient failures can be retried.

## Configuration and validation

Preserves Academy's existing environment rule: `ASAAS_SANDBOX=true` selects
sandbox, otherwise production, using `ASAAS_API_KEY`. It does not adopt billing's
`ASAAS_ENV`. Tests inject responses and forbid external calls. No private secrets
were generated, displayed or modified.

```powershell
pnpm --filter @workspace/api-server run test:academy-settlement-db
```

HTTP/database regression covers 16 concurrent notifications, one mocked email
scheduling, replay, response privacy, false notifications, ID/customer/reference/
amount binding, risk approval, ineligible states, card/boleto, outages/retry,
malformed responses, binding changes during lookup, terminal state, duplicate ID
and unknown payment. Transport tests check environment selection, escaped URLs,
GET and deadline with mocks. Exact fixture UUIDs are removed in `finally`.
Included in the workflow's database job; no push.

Official references: [payment lookup](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca),
[creation and confirmed-Pix caveat](https://docs.asaas.com/reference/criar-nova-cobranca),
[card confirmation](https://docs.asaas.com/reference/pay-a-charge-with-credit-card).

## Limits and next steps

No schema migration or automatic historical purchase repair. Missing payment/
customer bindings require reconciliation, not notification-reference fallback.
Already-confirmed records are not reverified in this flow.

Webhook confirmation now creates a [durable outbox](./ACADEMY_ACCESS_EMAIL_OUTBOX.en.md)
in the same transaction. Unclaimed jobs can resume; ambiguous outcomes are not
blindly retried. This does not guarantee inbox delivery. Administrative confirmation/resend routes
remain separate and do not share this concurrency certification. Reversals,
revocation, historical reconciliation, provider-acceptance/persistence recovery,
session auditing and end-to-end sandbox tests remain pending. Remote state can
change after lookup; there is no distributed transaction with Asaas.
