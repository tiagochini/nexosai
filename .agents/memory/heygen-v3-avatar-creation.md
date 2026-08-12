---
name: HeyGen v3 Avatar Creation
description: Full v3 API migration for avatar creation — replaces all deprecated v1/v2 endpoints with POST /v3/avatars type discriminator.
---

# HeyGen v3 Avatar Creation

## The Rule
All avatar creation goes through `POST /v3/avatars` with a `type` discriminator. Every other endpoint is dead.

**Why:** `/v1/talking_photo` → 404, `/v2/video_avatar` → 405. Only v3 is active.

**How to apply:** Check for any direct calls to `/v1/talking_photo`, `/v2/video_avatar`, or `/v1/upload.heygen.com/v1/asset`+save pattern — all must be migrated.

## v3 Endpoints

| Old | New |
|---|---|
| `POST /v2/video_avatar` | `POST /v3/avatars` with `type: "digital_twin"` |
| `POST /v1/talking_photo` | `POST /v3/avatars` with `type: "photo"` |
| `GET /v2/video_avatar/{id}` | `GET /v3/avatars/{group_id}` |

## Response Shape
```json
{
  "data": {
    "avatar_group": { "id": "<group_uuid>", "status": "completed|pending|processing|failed" },
    "avatar_item": { "id": "<look_uuid>", "group_id": "<group_uuid>", "status": "processing" }
  }
}
```
- `avatar_item.id` = look UUID → use as `avatar_id` in `POST /v3/videos` and save as `heygenAvatarId`
- `avatar_group.id` = identity UUID → save as `digitalTwinId` for polling
- For digital twin (async): `avatar_item` may not exist immediately; poll `GET /v3/avatars/{group_id}`

## File Input Format
```json
{ "type": "base64", "data": "<base64>", "media_type": "image/jpeg" }
{ "type": "url", "url": "https://..." }
{ "type": "asset_id", "asset_id": "..." }
```
**NOT** `mime_type` — field is `media_type`. **NOT** `"key"` type — invalid.

## Consent for Digital Twin
1. `POST /v3/avatars` with `type: "digital_twin"` + training video → `avatar_group.id`
2. `POST /v3/avatars/{group_id}/consent` with `consent_video: { type: "url", url }` (Enterprise) OR `{ reroute_url }` (webcam, all plans)
3. Poll `GET /v3/avatars/{group_id}` for `status: "completed"`
4. `GET /v3/avatars/looks?group_id={group_id}&ownership=private` → `data[0].id` = look UUID

## Looks Lookup Fix
Old code matched by `a.avatar_id === digitalTwinId` → `match.avatar_id` — BOTH fields wrong.
- Match by: `a.group_id === digitalTwinId`
- Save: `match.id` (look UUID, NOT group_id)
