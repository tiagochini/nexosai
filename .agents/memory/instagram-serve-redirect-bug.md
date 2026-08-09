---
name: Instagram Media Serve — Direct Stream Fix
description: Why /media/serve must stream bytes directly (not redirect) when GCS signed URLs are unavailable, so Instagram containers don't fail with status ERROR.
---

## The Rule
`redirectToPresenceMedia` must stream GCS bytes directly when `getPresenceMediaSignedUrl` returns null. Never redirect to a local JWT-gated endpoint as the fallback for external API callers.

**Why:**
- Replit's GCS credentials lack `iam.serviceAccounts.signBlob` → `getPresenceMediaSignedUrl` always returns null in the Replit environment.
- The old fallback redirected to `/api/presence/media/stream?tok=JWT` (local signed path). Instagram's async container-creation downloader does **not** follow redirects reliably — the container comes back as `status: ERROR`.
- The fix (in `redirectToPresenceMedia`, social-presence.service.ts): when signedUrl is null, pipe the GCS stream directly via `createGCSObjectStream(gcsKey).pipe(res)` with `Content-Type`, `Content-Length`, and `Cache-Control: public`.
- Set `retryCount: 0` in `publishNow` so manual retries get 3 fresh attempts regardless of prior failures.

**How to apply:**
- Any new media endpoint meant to be fetched by external APIs (Instagram, TikTok, Meta) must never use redirect chains. Stream directly or use a true CDN/GCS public URL.
- `getPresenceMediaSignedUrl` returning null is the **normal Replit case**, not an error. Design for it.
