---
name: Clone Digital Persistence
description: Per-take upload + session resume for voice clone, and step-accurate restore for avatar flow on /clone-digital.
---

## Voice Clone (CloneStudioPanel)
- Each take is uploaded immediately after the user accepts it via `queueTakeUpload()` — fire-and-forget, serialised via `uploadQueueRef`.
- Session ID is created lazily on the first `ensureSession()` call inside the first upload.
- Progress `{ recordingId, completedTakeIds }` is saved to the backend after every take via `POST /api/workspaces/me/persona/voice-clone-progress`.
- `finalizeSession()` awaits `uploadQueueRef.current` before calling `/stop`, then clears progress with `recordingId: null`.
- The panel accepts `resumeState?: CloneResumeState` prop; initial take index and take states are derived from `completedTakeIds.length`.
- Auth on recording upload uses `credentials: "include"` (not `Authorization: Bearer localStorage`).

**Why:** All state was in React memory — navigating away reset everything, losing the user's recordings.

## Avatar Flow (AvatarCloneFlow)
- On advance from training → consent, `advanceToConsent()` immediately uploads the training video via `uploadVideoRaw()` to GCS key `persona-media/{workspaceId}/training.webm` (stable, no timestamp).
- The uploaded key is stored in `trainingKeyRef`. If the upload fails, flow still advances (retry at final submit from memory blob).
- On `submit()`, `trainingKey` is omitted when `hasTrainingInGCS=true`; the backend resolves to the stable GCS key via `personaMediaObjectKey(workspaceId, "training")`.

## Backend endpoints
- `GET  /me/persona/avatar-recovery-status` → now returns `{ hasTrainingVideo, hasConsentVideo, hasGCSVideos }` (both checked independently).
- `GET  /me/persona/voice-clone-progress` → `{ inProgress, recordingId?, completedTakeIds? }`.
- `POST /me/persona/voice-clone-progress` → `{ recordingId: null }` clears progress; `{ recordingId, completedTakeIds }` saves it.
- `POST /me/persona/clone-avatar-video` → `trainingKey` is now optional; backend falls back to `personaMediaObjectKey(workspaceId, "training")`.

## Page restoration (CloneDigitalPage)
- Loads voice progress + persona + recovery in parallel on mount.
- If `recovery.hasTrainingVideo && !recovery.hasConsentVideo` → avatar flow auto-opens at consent step (`initialStep="consent"`, `hasTrainingInGCS=true`).
- If `recovery.hasTrainingVideo && recovery.hasConsentVideo && !hasAvatar` → recovery banner shown (both videos exist, just needs HeyGen call).
- Voice resume: shows "Retomar (X/5)" button when `voiceProgress.inProgress && !hasVoice`.
