---
name: Meta verify token digest fallback
description: Durable rule for Meta webhook verification when production secret synchronization fails.
---

Meta webhook subscription verification accepts either the configured runtime token or a pinned SHA-256 digest of the current high-entropy token. The plaintext token must never be committed.

**Why:** Replit workspace and deployment Secrets can be scoped independently, and production repeatedly rejected the correct Meta verification token while the workspace endpoint accepted it. A digest fallback permits verification without exposing the token or weakening signed POST-event validation.

**How to apply:** Whenever the Meta verification token is rotated, update its pinned digest in the same change and publish. Keep POST callbacks protected independently by `X-Hub-Signature-256` using the Meta App Secret.