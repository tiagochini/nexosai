# Administrative delivery, gifts and payment reversals

Updated October 5, 2026. [Português](ACADEMY_DELIVERY_AND_REVERSALS.md).

Update: administrative authentication now uses individual sessions;
[session contract and audited reconciliation](P0_SECURITY_CLOSEOUT.en.md)
supersede the shared-secret instructions below. The separate Academy client was adapted.

## Completed scope

Administrative confirmation, local simulation, checkout resend, administrative resend and gifts now use the durable access-delivery queue. Purchases and delivery intents commit together. Repeated confirmation never creates another delivery. History is retained and only one active attempt is allowed per purchase. Uncertain `sending` attempts require reconciliation, including after process death; they are never blindly retried.

`sent` means provider acceptance, not inbox delivery. Accepted messages cannot be recalled; revoked codes fail access verification. A delivery already in flight may finish during a refund.

## HTTP contract

All administrative routes require configured `x-admin-secret`, never a URL secret. Resends and batches also require `Idempotency-Key`: 8–128 alphanumeric characters, with `:`, `_` and `-` allowed. Generate one key per intent and reuse it for retries. Reusing a key with different content returns 409.

| POST /api/academy | Body | Result |
| --- | --- | --- |
| `/admin/confirm` | `{ "purchaseId": "UUID" }` | Confirms and queues the initial delivery; replay does not resend. |
| `/admin/resend` | `{ "purchaseId": "UUID" }` | 202 with `jobId`; coalesces scheduled delivery, rejects uncertain delivery. |
| `/admin/gift-codes` | `{ "count": 3, "productId": "mini-guide" }` | 201 with codes and purchase IDs; 1–50 gifts per batch. |
| `/admin/gift-delivery` | `{ "purchaseId": "UUID", "recipientEmail": "person@example.com" }` | Assigns a recipient and queues delivery; an assigned recipient cannot be replaced. |

Gift batches accept optional `recipientEmail` and `recipientName`. Unassigned gifts retain usable administrator-issued codes, but delivery is `skipped/GIFT_RECIPIENT_NOT_ASSIGNED`; the placeholder address never receives mail. Assignment also accepts optional `recipientName`. Public checkout resends have a five-minute cooldown and never disclose access codes.

The separate Academy frontend now uses individual sessions and idempotency keys for gifts. External administrative clients must also follow the current session contract in the P0 closeout document; the shared-secret contract below is historical.

## Financial reconciliation

This code never initiates a refund or financial transfer. Following authenticated notifications, it queries current Asaas state and validates payment binding. Only `DONE` refund installments count toward cumulative refunds; pending requests are not evidence of returned funds. `REFUNDED` requires full completion evidence. Mismatches, value regression and outages leave balances/access unchanged.

- Academy: full refunds revoke access and cancel still-scheduled jobs. Partial refunds are recorded while retaining access to the indivisible product. Chargebacks suspend access; only verified paid state releases the hold. A previously unconfirmed purchase returns to pending and must pass normal confirmation before access is released.
- Credit packs: partial refunds reverse a proportional number of credits, rounding down against the cumulative total; full refunds reverse the entire pack. Chargebacks hold pack credits; verified release restores only held credits. Transactions and row locks prevent duplicate debits/credits.
- User-approved policy: previously consumed credits can result in negative balances. New consumption is blocked even for unlimited-credit accounts until replenishment. Monthly allocation repays debt instead of erasing it; a monthly key prevents duplicate allocation.
- Historical purchases without a verified grant keyed `billing-payment:<UUID>` receive `reversalReview=LEGACY_CREDIT_GRANT_UNVERIFIED`. Financial state is recorded, but no debit is guessed. An operator must inspect the ledger before any manual correction.

Read-only historical review query, excluding emails and credentials:

```sql
SELECT id, workspace_id, status, metadata->>'reversalReview' AS reason
FROM subscription_payments
WHERE metadata->>'reversalReview' = 'LEGACY_CREDIT_GRANT_UNVERIFIED';
```

Ensure both configured Asaas webhooks subscribe to reversal events: `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_REFUND_DENIED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE` and `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`, as well as existing confirmation events. External webhook configuration was not changed in this delivery.

## Operation and validation

Migrations: `0065_academy_delivery_intents.sql` and `0066_credit_refund_reversal.sql`. Stop the old API before 0065 changes the queue conflict key; start the new version afterwards. Periodic recovery remains disabled under `LOCAL_SAFE_MODE=true`; interactive request wake-ups remain active. Production requires an active worker, configured delivery provider and monitoring of uncertain attempts.

Tests: `test:academy-delivery-lifecycle-db`, `test:billing-reversal-db`, `test:academy-access-outbox-db`, `test:academy-settlement-db`, `test:academy-admin-security`, `test:billing-credit-concurrency-db`, `test:billing-settlement`, `test:billing-webhook-security` and `test:academy-access-email`. Owned fixtures and mocks prevent real emails, charges and refunds. Types and build were also validated. End-to-end sandbox checks, webhook configuration and historical reconciliation remain operational requirements; this is not a production certification of the entire system.

Official references: [refund installment states](https://docs.asaas.com/docs/estornos), [payment and chargeback webhook events](https://docs.asaas.com/docs/webhook-para-cobrancas).
