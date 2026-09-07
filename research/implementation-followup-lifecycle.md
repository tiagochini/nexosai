Extended the lifecycle implementation beyond the foundation.

Added durable lifecycle records (in lifecycle schema + migration): retention actions, approved upsell offers/actions, purchaser referral enrollment, purchase attribution, and reward/reversal ledger. All records are workspace-scoped with uniqueness guards for idempotency.

Service behavior added:
- External revenue webhook events now enter the lifecycle ledger once, update LTV for sales/renewals/upsells, subtract refunds, and create retention actions for refunds/cancellations.
- Product checkout preserves purchaser referral code; confirmed paid sale creates only one onboarding, suppresses pending recovery, attributes a non-self purchaser referral, and creates a pending (not fulfilled) reward.
- Refund transition reverses pending purchaser-referral rewards and adjusts LTV/risk once.
- Expired-cart processing atomically claims pending→expired; paid webhook accepts pending/expired and wins/suppresses recovery correctly.
- Activation evaluates only approved upsell offers and respects activation timing; it creates pending actions only—no checkout/send or provider success is fabricated.

Routes added under /api/lifecycle:
- create/approve upsell offers; list actions
- create retention risk/action
- purchaser referral enrollment (customer-only; duplicate-safe)
- prior contact timeline/stage and onboarding activation routes retained.

Changed additionally:
- artifacts/api-server/src/modules/revenue/revenue.webhooks.ts
- artifacts/api-server/src/modules/product-checkout/product-checkout.{service,routes}.ts
- artifacts/api-server/src/modules/lifecycle/{lifecycle.service,lifecycle.routes}.ts
- lib/db/src/schema/lifecycle.ts and lib/db/drizzle/0017_lifecycle.sql

Focused validation passed: DB declaration build, API typecheck filtered for lifecycle/product-checkout/revenue diagnostics, and git diff --check. Full API typecheck still has pre-existing unrelated community/native-media diagnostics.

Provider boundary remains fail-closed: recovery, retention, upsell, and reward actions stay pending until separately approved policy and real provider/fulfillment receipts are wired. No mock success or planning output is marked executed.