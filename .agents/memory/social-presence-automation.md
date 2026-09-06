---
name: Social Presence Automation Architecture
description: Decisions and constraints for the social presence automated publishing pipeline — stories, reels, highlights, DM flows
---

## Core pipeline (every 60s tick in sequence-scheduler.worker.ts)
1. `publishDuePresencePosts()` — publishes scheduled posts
2. `processDmSequences()` — sends pending DM response steps

## Reel/video timeout
- `waitForInstagramContainer` accepts `maxWaitMs`
- Video formats (reel, feed_video): **300_000ms (5 min)**
- Image formats: **30_000ms (30s)**
- Pass explicitly at call site in `publishToInstagram`

## Skip logic for video still generating
- If `format === reel/feed_video` AND `mediaUrls.length === 0` AND `mediaGenStatus` is `video_generating | storyboard_generating | storyboard_ready` → **silent skip** (no error message, stays scheduled, retried next tick)
- Otherwise if no media → set errorMessage and continue (soft skip, not failed)

## Highlights (Destaques)
- AI planner sets `highlightName` on story posts
- After story published: `addStoryToHighlight()` called fire-and-forget
- Tries `GET /{igUserId}/highlight_albums` → finds match by title → `POST /{albumId}` with `media_ids_to_add` OR creates new highlight
- Non-fatal: errors are logged as warn, never block publish

## DM Response Flows
- AI planner sets `dmResponseFlow: { triggerKeyword, triggerInstructions, steps[] }` on posts with DM CTA
- `processMetaWebhook` in social.service.ts handles `messaging` events → calls `handleInstagramDmTrigger()` via setImmediate
- `handleInstagramDmTrigger()`: finds matching post by keyword → creates `instagram_dm_sequences` row → fires step 0 if delayMinutes=0
- `processDmSequences()`: sends pending steps, advances currentStep, marks complete when all steps sent
- Deduplication: won't create a new sequence if one is already active for same (igAccountId, recipientId)

## DB build requirement
- `lib/db` uses `composite: true` with `emitDeclarationOnly: true` → TypeScript reads from `lib/db/dist/`
- After ANY schema change to `lib/db/src/schema/`: run `cd lib/db && pnpm exec tsc --build` BEFORE compiling api-server
- Then run `cd lib/db && pnpm run push` to migrate the DB

## Meta App Review video skip
- User uses app for own company only (not third-party platform) → Standard/Development mode
- Add own Instagram accounts directly as app users in Meta Developer Console
- Demo videos for App Review can be skipped for internal-only use

## Confirmed production behavior
- The operator logged into their own Instagram account and confirmed the automatic scheduler published the final scheduled content successfully end to end.
- Treat automatic Instagram publishing as operationally proven for that tested account and scenario; do not generalize the evidence to every account, format, provider, or multiconta routing.

**Why:** Static code inspection previously understated this capability because the successful external publication evidence existed only through the operator's direct observation.

**How to apply:** In audits, classify the tested automatic Instagram publication flow as ready for its validated scope, while keeping untested variants explicitly inconclusive.

**Why:** Established during social presence automation sprint. These decisions must be consistent across all future presence-related work.
