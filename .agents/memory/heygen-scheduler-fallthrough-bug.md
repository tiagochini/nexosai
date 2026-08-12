---
name: HeyGen Scheduler Fall-Through Bug
description: Root cause of com_job_id=0 in production — missing `continue` after setImmediate in publishDuePresencePosts caused all video generation to fail silently.
---

# HeyGen Scheduler Fall-Through Bug

## The Rule
Any code path that calls `setImmediate(() => approveStoryboardGenerateVideo(...))` in `publishDuePresencePosts()` **must** be followed by a `continue` statement to prevent fall-through.

**Why:** Without `continue`, execution falls through to the "null/idle/failed → auto-gerar storyboard" block at line ~1609, which immediately sets `mediaGenStatus = "storyboard_generating"`. When the setImmediate fires, `approveStoryboardGenerateVideo()` checks `approvedStatuses = ["storyboard_ready", "storyboard_draft"]`, finds `"storyboard_generating"`, and throws — causing the catch to log "non-fatal" and abort the video submit. This was the cause of `com_job_id: 0, falhados: 6, completos: 0` in production.

**How to apply:** Whenever adding or reviewing code in `publishDuePresencePosts()` at `social-presence.service.ts` that dispatches async video generation via `setImmediate`, always add `continue` immediately after the setImmediate block. The fix was applied as part of the DISABLE_SCHEDULED_VIDEO_GENERATION flag insertion.

## Dev vs Prod DB
Dev and prod are **DIFFERENT databases**. Dev: `host: helium / db: heliumdb / 24 workspaces`. Prod: different host / 12 workspaces. All SQL evidence must declare which host was queried. Querying dev when debugging prod issues gives misleading results (this wasted several investigation rounds).

## Production Persona State (as of Aug 2026)
- Workspace: `21aa4337-82db-4671-bd8c-acdbeb9f6495` (NexOS Founder's Workspace)
- `heygenAvatarId`: `7ecb72e295624b20b6b14ad98148744a` (look — `preferred_orientation: "landscape"`)
- `avatarType`: `"digital_twin"` — maps to `character.type: "digital_twin"` in v2 payload
- `heygenVoiceId`: `c8ac31e97555494fb8502599e6bc5461` = "Adriano" (HeyGen stock voice, Portuguese male — NOT a user voice clone)
- Portrait look exists: `5279d1ea433e4b9f8715a1b58c811260` (group `307779b4e7094592b1478ed72fc8ecdf`)

## Containment Flag
`DISABLE_SCHEDULED_VIDEO_GENERATION=true` (env var, production) suppresses scheduler's auto video generation. Applied at the divergence point in `publishDuePresencePosts()` before `setImmediate`. Manual "Gerar vídeo" button is **unaffected** (different code path via routes.ts). Remove/set to false after manual validation. [TEMP — C0.9]

## HeyGen Credit Consumption
~7 credits per ~5s video. 90 credits remaining as of Aug 12 2026 (after C1 test consumed 7 from 97). 28 video-format posts would exhaust saldo (~12 max videos at current rate).

## C1 Fix Summary
`POST /v3/videos` (flat payload) → `POST /v2/video/generate` (video_inputs[] array). v3 rejects video_inputs[] with "Unable to extract tag using discriminator 'type'" (400). v2 sunset: 2026-10-31 — v3 correct format still unknown.
