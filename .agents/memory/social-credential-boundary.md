---
name: Social credential boundary
description: Fail-closed credential and provider-health rules for social mutations and metrics.
---

Every external social mutation—including manual/scheduled posts, presence content, bio changes, highlights and DMs—must pass one canonical workspace-scoped readiness gate before any provider call. Validate provider mapping, connected status, token, account, expiry, account identity and required permission proof.

**Why:** Separate presence paths bypassed publish validation, valid TikTok accounts were initially blocked by an incorrect creator-info response shape, and provider metric failures could overwrite good cached metrics with zeros.

**How to apply:** Treat 401/403, account mismatch and missing permission proof as terminal credential failures; treat 408/429/5xx and transport failures as bounded transient retries without expiring the integration. TikTok creator-info fields, including `privacy_level_options`, are directly under `data`. Persist metrics only from confirmed successful responses and preserve prior cache on every failure.