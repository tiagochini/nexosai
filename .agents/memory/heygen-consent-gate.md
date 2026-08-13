---
name: HeyGen Consent Gate
description: digital_twin consent_status:"pending" blocks all video generation — look status:"completed" does NOT mean consent is granted
---

## Rule

For digital_twin avatars in HeyGen, there are TWO separate status checks:

1. **Look status** (`GET /v3/avatars/looks/{look_id}`) — `status: "completed"` means the avatar look is trained and ready.
2. **Group consent status** (`GET /v3/avatars/{group_id}`) — `consent_status: "pending"` means the operator has NOT completed the consent flow in HeyGen's own platform.

These are independent. A look can be `completed` while the group's `consent_status` is still `pending`. The pre-flight in `generateAvatarVideo` (video-generation.service.ts:219) only checks the look status — it does NOT check the group consent_status.

When `POST /v2/video/generate` is called with a pending-consent digital_twin avatar, HeyGen rejects the request (returns `avatar_consent_required`). The video generation sets `media_gen_status = "failed"` with no job_id and no credit consumed.

**Why:** Discovered during W4 experiment (2026-08-13). Digital_twin group `46f9eeb37e214576866ad6c746d39234` (workspace 21aa4337, "Meu Avatar NexOS") had `consent_status: "pending"`. Every scheduler attempt fails silently until consent is completed in HeyGen dashboard.

**How to apply:**
- Before declaring "video generation is blocked by X", check both the look status AND the group consent_status.
- The pre-flight check should be extended to also fetch `GET /v3/avatars/{group_id}` and check `consent_status === "granted"`.
- Consent must be completed by the avatar owner directly in HeyGen's platform (not via API).
- Boot cleanup at index.ts:207 resets posts with HeyGen error messages — this catches HeyGen API error 400/404 but may not catch avatar_consent_required errors (check the error message pattern).

**Workspace 21aa4337 look/group IDs:**
- look_id (heygenAvatarId): `7ecb72e295624b20b6b14ad98148744a`
- group_id (digitalTwinId): `46f9eeb37e214576866ad6c746d39234`
- voice_id (heygenVoiceId): `c8ac31e97555494fb8502599e6bc5461`
