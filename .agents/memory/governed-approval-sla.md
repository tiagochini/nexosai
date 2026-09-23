---
name: Governed Approval SLA
description: Durable invariants for approval deadlines, reminders, expiration and concurrency.
---

Approval SLA is operational state separate from immutable approval decisions. One obligation binds to the exact workspace, campaign, subject, snapshot hash and actor; its warning, due, escalation and expiration window is immutable.

**Why:** A reminder must not alter authorization, and a scheduler/decision race must never approve an expired snapshot or emit reminders after resolution.

**How to apply:** Schedule, decision and scheduler processing must serialize on the same subject lock and revalidate the obligation transactionally. Warning is exactly one hour before due. Events and audit receipts are append-only and unique by obligation/type/channel. Expiration never approves. Only in-app delivery is supported until an external channel has explicit authorization and provider receipts. SLA handling never publishes, generates, calls providers or charges credits.