Implemented server-side community foundation and capability-safe mutation boundary.

Changed files:
- `lib/db/src/schema/community.ts` — workspace-scoped conversations, participants (consent/provenance), messages/attachments/status, deduped provider events, moderation rules/decisions, idempotent action attempts/receipts, response policies/quotas.
- `lib/db/src/schema/index.ts` — exports community schema.
- `lib/db/drizzle/0017_community_operations.sql` — durable schema migration.
- `lib/db/src/schema/campaign-groups.ts` — lifecycle/sync/error fields and explicit blocked/sync-failed statuses.
- `artifacts/api-server/src/modules/community/community-capabilities.ts` — conservative official-capability matrix; WhatsApp group mutations always explicitly unsupported.
- `community.service.ts` / `community.routes.ts` — idempotent normalized inbound persistence API foundation, tenant-scoped inbox, moderation rule creation, capability endpoint, and audited action attempts returning `capability_blocked` rather than fabricated success.
- `routes/index.ts` — mounted at `/community`.
- campaign groups service/routes updated for new lifecycle statuses.

Validation: API typecheck was run. It could not validate the new DB exports because the workspace DB declaration build was interrupted (`SERVER unexpectedly disconnected`), and it also reports pre-existing errors in lifecycle/paid-media/native-media. New route handler return-type issues found by the check were corrected.

Remaining provider-dependent blockers: verified public Meta/WhatsApp/Telegram webhook adapters must map official payloads into `ingestInboundCommunityEvent`; Telegram mutations require an authorized bot-admin adapter; WhatsApp Cloud group creation/member/moderation remains officially unsupported and is deliberately capability-blocked. No provider mutation is marked successful without a real adapter receipt.