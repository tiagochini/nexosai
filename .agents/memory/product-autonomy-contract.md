---
name: Product Autonomy Contract
description: Durable autonomy, financial-responsibility, compliance and approval boundaries for NexOS operations.
---

NexOS operates inside a versioned authorization envelope accepted by the customer. Optimization inside one advertising platform may be autonomous when it remains within the approved Masterplan and budget; moving budget between platforms always requires a metric-backed recommendation and explicit customer approval.

**Why:** The product must act like an autonomous agency without silently changing the customer’s financial strategy or implying that disclaimers replace platform, legal or rights controls.

**How to apply:** Require current autonomy and asset-rights acceptance at the launch boundary; require the regulated-activity acceptance when campaign signals indicate it. Customers fund ad platforms directly. Mandatory pauses cover probable illegality, fraud, rights violations, severe account-ban risk, overspend and severe reputational crises. Do not retroactively block already-started executions when introducing a new contract version.

Mandatory-pause scope dimensions are conjunctive and must use canonical values consistently. Campaign launch is `channel=campaign` plus `action=launch`; omitting the channel does not match that scoped pause. Enforce safety both when accepting work and again at the worker/adapter boundary, because a pause or revocation can occur after enqueue.

**Why:** E2E exposed that a valid active launch pause was bypassed when the launch guard supplied the campaign and action but omitted the canonical campaign channel. Route-only enforcement also leaves a queue race.

**How to apply:** Every external action must pass all known scope dimensions to the final guard. Treat `NULL` only as an intentional wildcard. A paused campaign never advances automatically, and resolving a pause never resumes it.