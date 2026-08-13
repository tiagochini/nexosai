---
name: Presence Video Serve 400
description: redirectToPresenceMedia returns 400 for presence-video/ keys because of a parts.length < 4 guard designed for presence-media/ format.
---

# presence-video/ Serve 400 Bug

**Rule:** `redirectToPresenceMedia` must parse path segments per prefix type before doing the `< 4` guard.

**Why:** `presence-video/{workspaceId}/{postId}.mp4` has 3 segments; old code required ≥ 4 → `res.status(400)` immediately. This caused:
- UI preview broken (player can't load video)
- Instagram container ERROR (can't download 400 URL)
- curl -I returns 400

**How to apply:**
- `presence-video/` → 3 parts, extract workspaceId=parts[1], postId=parts[2].replace extension
- `presence-storyboard/` → 3 parts, no postId — skip ownership check
- `presence-media/` → ≥ 4 parts (original behavior)
- ownership check gated on `if (postId)` to handle storyboard case

**Fixed 2026-08-13** in `social-presence.service.ts` `redirectToPresenceMedia`.
