Continued implementation.

Changes:
- Wired verified WhatsApp webhook ingestion into `ingestInboundCommunityEvent` after integration ownership resolution. It persists both text and non-text inbound messages, dedupes on provider message ID, and prevents duplicate response-agent execution.
- Wired verified Meta Instagram DM processing into normalized ingestion after account/integration ownership lookup. Existing Meta signature validation remains the only public entry boundary.
- Added fail-closed autonomous-response authorization: no durable enabled policy means no automated reply; consent, human approval, and daily quota all block execution when required.
- Added generalized pure moderation-rule evaluator (keyword/regex/classification/role) with correct absent-condition handling.
- Added focused `test:community-unit` covering inbound replay dedupe and tenant boundary, WhatsApp capability-blocked behavior, consent/quota/approval response policy, and moderation decisions.
- Registered the focused test in API package scripts.

Test results:
- `pnpm --filter @workspace/api-server test:community-unit` — passed.
- `pnpm --filter @workspace/api-server typecheck` — one unrelated existing failure in `social.autopost.service.ts:313`: mock `SocialPost` lacks `contextFingerprint` and `masterplanVersionId`. No errors reported in community/webhook changes.

Provider boundary remains fail-closed: no generic unauthenticated ingestion route was added; unsupported WhatsApp group operations remain capability-blocked; no Telegram mutation adapter or fabricated receipts was introduced.