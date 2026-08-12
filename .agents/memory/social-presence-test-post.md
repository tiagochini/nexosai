---
name: Social Presence Test Post
description: createTestScheduledPost() supports text/post/reel/story with custom timing and auto-approval for image posts.
---

# Social Presence Test Post

## The Rule
Use `createTestScheduledPost()` for all scheduled test posts. The old `createTestReelPost()` has hardcoded NexOS content — deprecated.

**Why:** User's client workspaces can't have NexOS-specific content. The new function uses real workspace business context.

## Supported Formats
- `text` + `facebook`: creates post with no media (text-only publishing supported)
- `text` + `instagram`: generates text-card image via AI, auto-approves (Instagram has no text-only API)
- `post`: generates AI image via `generateStoryboardFrame()`, auto-approves as `mediaUrls` (no user approval step)
- `reel` / `story`: creates post + triggers `generatePostStoryboard()` → requires user storyboard approval

## Auto-Approval Pattern
For image posts (format=post or text+instagram):
1. `generateAndAutoApproveTestImage()` generates image via `generateStoryboardFrame()`
2. If `isAI=true`: sets `status="scheduled"`, `mediaUrls=[serveUrl]`, `mediaGenStatus=null` → ready to publish
3. If SVG fallback: sets `mediaGenStatus="storyboard_draft"` → still requires manual approval

## Route
`POST /api/presence/posts/create-test-scheduled` with `{ platform, format, minutesFromNow, caption? }`

## Frontend
Button "Agendar Teste" → opens `ScheduleTestModal` with format/platform/timing selection.
Old "Criar Reel Teste (1h)" button removed.

## Approval UX Fix
`approve()` and `bulkApprove()` now show `toast.success()` from sonner with scheduled time.
Posts don't disappear silently — toast explains they moved to the agenda.
