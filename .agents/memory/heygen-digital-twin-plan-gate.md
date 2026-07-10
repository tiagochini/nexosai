---
name: HeyGen Digital Twin requires Enterprise plan
description: Video-based avatar cloning (Digital Twin) on HeyGen is gated behind an Enterprise account tier, not a code issue.
---

`POST https://api.heygen.com/v2/video_avatar` (Digital Twin / video-based avatar creation) returns HTTP 403 `{"error":{"code":"internal_error","message":"forbidden"}}` on non-Enterprise HeyGen accounts — verified live against the real API.

**Why:** HeyGen's docs explicitly scope the Digital Twin Creation API to Enterprise plans. Photo-based `talking_photo` cloning has no such restriction and works on any plan.

**How to apply:** When building/debugging HeyGen video-avatar-clone features, treat a 403 `forbidden` from `/v2/video_avatar` as an account-tier blocker, not a bug — do not spend time re-debugging payload shape or auth headers. The full request/response flow (upload → create → poll status → resolve avatar_id via `/v3/avatars/looks`) is otherwise correct once verified against real HeyGen error responses (initial guess of `/v2/digital_twin/create` was wrong; correct endpoint is `/v2/video_avatar`, status poll is `/v2/video_avatar/{id}`, statuses are `in_progress`/`complete`/`failed`, not `pending`/`processing`). `/v2/video_avatar` and `/v2/video/generate` are deprecated but supported through Oct 31, 2026; there is no v3 replacement yet for Digital Twin *creation* specifically (v3 only covers video *generation*, via `/v3/videos`).
