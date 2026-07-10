---
name: HeyGen/ElevenLabs avatar gate — verified real API constraints
description: Real HeyGen/ElevenLabs API quirks discovered while verifying the mandatory avatar/voice recording gate end-to-end
---

- HeyGen `talking_photo_style` accepts `"square"` / `"circle"` / `"closeUp"` — `"normal"` returns HTTP 400 `invalid_parameter`.
  **Why:** discovered via a live end-to-end call to `api.heygen.com/v2/video/generate`, not from docs.
  **How to apply:** any code constructing a HeyGen `talking_photo` character payload must use one of the three valid style values.

- HeyGen's `voice.text.voice_id` must be a voice registered in HeyGen's own voice library — an arbitrary ElevenLabs voice ID (even a real, valid one) is rejected with `Invalid voice_id ... Voice not found`.
  **Why:** confirmed live; HeyGen does not transparently accept raw ElevenLabs IDs for its `voice_id` field.
  **How to apply:** if voice cloning is meant to feed HeyGen video generation, confirm the actual integration contract (e.g. HeyGen's own instant-voice-clone API, or whatever import step is required) — do not assume an ElevenLabs voice ID is directly usable as HeyGen's `voice_id`.

- ElevenLabs instant voice cloning (`/v1/voices/add`) requires a paid ElevenLabs plan; free/current plan returns `402`-style error `paid_plan_required` / `can_not_use_instant_voice_cloning`.
  **Why:** confirmed live against the production `ELEVENLABS_API_KEY`.
  **How to apply:** this is an account/billing blocker, not a code bug — flag to the user/business owner rather than debugging the integration code further.
