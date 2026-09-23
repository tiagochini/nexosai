---
name: Lifecycle intent versus delivery
description: Governance boundary between local lifecycle records, fulfilled buyer access and externally confirmed actions.
---

Lifecycle actions created from a sale, risk signal or expiry are **intentions**. A status in the local database does not prove that a buyer received access, a message was sent, a referral reward was delivered or a provider confirmed conversion. Without trusted delivery evidence, do not complete buyer onboarding or use that completion to unlock upsell; keep eligible actions pending and suppress ineligible ones with reasons. Local LTV is a ledger projection, not an independently attributed commercial KPI.

**Why:** A manual activation endpoint could previously mark onboarding complete using only a sale ID and then queue upsells, despite no entitlement or delivery adapter. Concurrent webhooks could also leave sale effects incomplete if an event key committed before its local projections.

**How to apply:** Preserve the pending/suppressed distinction when adding workers and UI. Bind future completion to an authorized provider/entitlement receipt and readback, with tenant and sale identity checked. Treat historical partial events as ambiguous rather than blindly reapplying LTV; repair only provably missing events atomically and flag ambiguous history for reconciliation.