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

Instagram Login webhooks may be signed with the Instagram product's own app secret rather than the Facebook/Meta app secret. Signature verification must accept either configured official secret while still requiring `X-Hub-Signature-256`; never bypass validation for dashboard samples.

**Why:** A real Meta Dashboard `messages` sample reached production but returned HTTP 401 when only the Meta/Facebook app secret was checked.

**How to apply:** Store the Instagram product secret separately as `INSTAGRAM_APP_SECRET`, compare the signature against every configured official app secret using constant-time equality, and keep the secret out of logs and evidence.

Requesting OAuth scopes and configuring the callback URL do not by themselves prove that Instagram event fields are active. Instagram webhook fields must be subscribed in the Meta App Dashboard; Meta explicitly rejects configuring Instagram `subscribed_fields` through the Page or app subscription APIs.

**Why:** Publishing can remain fully functional while inbound comments and DMs never arrive. A production attempt to call the account-scoped `subscribed_apps` endpoint failed with Meta error `(#3) Application does not have the capability`; official documentation confirms Instagram fields are dashboard-managed.

**How to apply:** Treat OAuth permissions, callback verification, dashboard field subscriptions, access level, and real callback evidence as separate gates. Never claim readiness until a real signed callback arrives.