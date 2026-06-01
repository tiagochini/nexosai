---
name: Video Stream Auth
description: <video src> elements can't send Authorization headers — use token query param endpoint for video streaming.
---

## Rule

`<video src="...">` elements cannot attach `Authorization: Bearer` headers. Any video endpoint behind `requireAuth` middleware will fail silently (401) when used as a video src.

## Fix Pattern

Register a dedicated `/video-stream` route **before** `router.use(requireAuth)` that reads the token from `?token=` query param and calls `verifyAccessToken()` manually.

```ts
// BEFORE router.use(requireAuth)
router.get("/:id/video-stream", async (req, res) => {
  const rawToken = req.query["token"];
  if (typeof rawToken !== "string") { res.status(401).json({...}); return; }
  const { workspaceId } = verifyAccessToken(rawToken);
  await svc.serveVideo(req.params.id, workspaceId, res);
});
```

**Client side:** `src={/api/recordings/${id}/video-stream?token=${encodeURIComponent(token)}}`

## Applied In

- `recording.routes.ts` — `/api/recordings/:id/video-stream`
- `video-editor/index.tsx` — `addClipFromUrl` uses `/video-stream?token=`

**Why:** The HTML video element spec prohibits custom headers on src attribute URLs. This is not fixable without blob URL workaround (XHR + createObjectURL), which is more complex and loses native seek/range support.
