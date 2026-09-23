---
name: Safe version comparison
description: Rules for truthful, bounded comparison of persisted campaign versions.
---

Version comparison is read-only and may compare only canonical persisted versions or revisions. Mutable rows and timestamps must never be promoted into invented history.

Detect semantic differences before truncating or redacting returned value previews. Sensitive, long-string, and URL-only changes must remain detectable without exposing their original values.

Every traversal needs global depth, node, item, change, and output-byte budgets. If any budget prevents complete comparison, mark the summary as truncated and show an explicit incomplete-comparison warning; never report the versions as identical.

**Why:** Sanitizing values before comparison can collapse materially different content into the same marker, while per-node markers can keep traversing an attacker-controlled payload and defeat response bounds.

**How to apply:** Use this rule for Master Plans, page revisions, deliverables, approvals, and any future diff surface. Bind both version IDs to the same workspace, campaign, and parent source before comparing.