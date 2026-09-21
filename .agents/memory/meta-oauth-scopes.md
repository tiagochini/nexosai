---
name: Meta OAuth and App Review
description: Durable security and evidence rules for Meta messaging, comments, and App Review demonstrations.
---

Meta webhook processing must fail closed unless `X-Hub-Signature-256` validates against the raw request body, and every inbound account ID must resolve to one exact connected organic integration. Never fall back to the first workspace or integration row.

**Why:** Meta can redeliver events concurrently, workspaces can contain multiple Instagram accounts, and legacy records may share provider labels. Loose routing or unsigned callbacks can send a reply from the wrong customer account and fail App Review.

**How to apply:** Claim events atomically by provider account, provider event ID, and action. Immediate configured DM/comment replies must not wait for an LLM. Record correlation, sanitized Graph request metadata, provider response ID, latency, retries, and dead-letter state; never persist or expose tokens in review evidence.

Free-form comment and DM replies run only after deterministic keyword/sequence handling. They must resolve the exact originating account, post, campaign and approved Master Plan, then use the canonical campaign context and recent same-user conversation. Missing or ambiguous context, sensitive claims, payment/refund/legal topics, explicit human requests, or low confidence require human handoff rather than a generic AI reply.

**Why:** A mechanically correct reply can still misrepresent the client's launch if it answers from workspace-level defaults or a different product.

**How to apply:** Persist each inbound/outbound turn with tenant, account, campaign, Master Plan/context fingerprints, decision, confidence, handoff reason and provider receipt. AI decides language; deterministic code owns provider mutations, retries and evidence.

OAuth flows used for the review must request the same canonical messaging, comment, Page metadata, publishing, engagement, and insights scopes. Keep paid-media credentials purpose-separated from organic social credentials.