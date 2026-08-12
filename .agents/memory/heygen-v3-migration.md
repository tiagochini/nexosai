---
name: HeyGen v3 Migration
description: Breaking changes from HeyGen v2→v3 API — payload format, look IDs, polling endpoint, and avatar catalog.
---

# HeyGen v3 Migration

## The rule
`POST /v3/videos` uses a **flat payload** — NOT the `video_inputs[]` array from v2.

**Why:** HeyGen deprecated v2 video generation. The v3 endpoint has a completely different schema that causes "Unable to extract tag using discriminator 'type'" with the old format.

**How to apply:** Always use:
```json
{
  "avatar_id": "<look UUID>",
  "voice_id": "<voice UUID>",
  "input_text": "<voiceover text>",
  "aspect_ratio": "9:16",
  "resolution": "720p",
  "test": false
}
```
- ⚠️ Field is `"input_text"` NOT `"script"` — v3 silently ignores `"script"` (v1/v2 field), accepts the request, returns a video_id, but renders a silent/empty video that fails internally with no error message. This causes videos to stay stuck as "processing" forever.
- No `"type"` field needed — `avatar_id` implies the type
- No `background`, `dimension`, or `video_inputs` fields
- Truncate `input_text` to 2000 chars max — longer scripts cause silent render failures
- Always do pre-flight `GET /v3/avatars/looks/{avatarId}` before submitting — if `status !== "completed"`, the look is still processing and video generation will fail

## Avatar IDs — v2 vs v3
- v2 IDs look like: `Abigail_expressive_2024112501` → **REJECTED by v3** (400: "This video avatar does not support Avatar IV")
- v3 IDs look like: `f29d5ce53e464fc4a1353a04dc9aac3b` (UUID from `/v3/avatars/looks`)
- **`/v3/avatars/looks`** returns look UUIDs — these are what go into `avatar_id`
- **`/v3/avatars`** returns avatar groups (character identities) — NOT the right IDs for video creation
- Private avatars (user twins): `/v3/avatars/looks?ownership=private`

## Polling
- v1: `GET /v1/video_status.get?video_id={id}` — deprecated
- v3: `GET /v3/videos/{id}` → `data.status` ("waiting"/"processing"/"completed"/"failed") + `data.video_url` + `data.failure_message`

## Boot cleanup
Pattern to detect and clear v2-format stock avatar IDs from workspace settings:
```sql
WHERE settings->'persona'->>'heygenAvatarId' ~ '^[A-Za-z][A-Za-z0-9]*[-_][A-Za-z][A-Za-z0-9]*[-_][0-9]{8}$'
```
This regex matches `Word_word_YYYYMMDD` format — all legacy v2 IDs.

## Stock avatar list endpoint
Use `GET /v3/avatars/looks?limit=50` with pagination via `next_token`.
Private twins (ownership=private) appear first in the list.
Response field `id` (not `avatar_id`) is the look UUID to save as `heygenAvatarId`.

## Key files
- `artifacts/api-server/src/modules/video-production/video-generation.service.ts` — `generateAvatarVideo` (line ~201), `pollHeyGenJob` (line ~272)
- `artifacts/api-server/src/modules/workspaces/workspaces.routes.ts` — stock-avatars endpoint (line ~413)
- `artifacts/api-server/src/index.ts` — boot cleanup regex (line ~175)
