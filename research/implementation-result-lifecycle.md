Implemented the lifecycle foundation in the shared workspace.

Changed files:
- lib/db/src/schema/lifecycle.ts — tenant-scoped canonical contacts, immutable idempotent lifecycle ledger, cart-recovery actions, buyer-onboarding instances and schema types.
- lib/db/src/schema/index.ts — exports lifecycle domain.
- lib/db/drizzle/0017_lifecycle.sql — lifecycle migration and uniqueness constraints.
- artifacts/api-server/src/modules/lifecycle/lifecycle.service.ts — contact merge-by-workspace identity, event-key dedupe, paid/checkout hooks, CAS-protected expiry recovery, paid suppression, onboarding creation, LTV increment.
- artifacts/api-server/src/modules/lifecycle/lifecycle.routes.ts — authenticated contact list/timeline, audited stage updates, onboarding activation.
- artifacts/api-server/src/modules/lifecycle/lifecycle.worker.ts — guarded 60s scheduler.
- artifacts/api-server/src/modules/product-checkout/product-checkout.service.ts — real checkout and confirmed Asaas payment boundaries emit lifecycle events; paid webhook accepts pending/expired race and suppresses unclaimed recovery.
- artifacts/api-server/src/routes/index.ts and src/index.ts — lifecycle route/scheduler mounted and shutdown handled.

Validation: DB TypeScript build passed; API typecheck was run and has no lifecycle/product-checkout/index diagnostics. Existing unrelated API errors remain in community and native-media modules.

Provider-dependent blocker intentionally preserved: cart recovery actions are created only when explicit channel consent exists, but remain pending until an approved recovery sequence/provider-dispatch configuration is modeled. They are never marked sent/executed without a real email/WhatsApp provider mutation. Upsell offer checkout dispatch, purchaser-referral rewards/reversals, and retention playbook provider dispatch still need their respective approved policy/schema integrations; no planning-agent output was treated as executed.