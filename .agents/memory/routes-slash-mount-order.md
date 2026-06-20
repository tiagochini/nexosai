---
name: Routes "/" Mount Order
description: Routers mounted at "/" with global requireAuth intercept ALL subsequent routes — specific-path routers must come before them.
---

## Rule
Any router registered with `router.use("/", someRouter)` where `someRouter` has `router.use(requireAuth)` at the top will intercept **all** requests that haven't already been matched — including routes registered after it in routes/index.ts. Public endpoints in later-registered routers will incorrectly return 401.

**Why:** Express `router.use("/", x)` matches every path. The child router's global middleware (requireAuth) runs before any route matching inside the child — if the token is absent, it responds 401 without calling next(), so the parent router never reaches subsequent `router.use("/self-proof", ...)` handlers.

**How to apply:**
- Always register specific-path routers (especially those with public/no-auth endpoints) **before** any `router.use("/", bigRouter)` catch-alls in routes/index.ts.
- Current offenders: `videoProductionRouter` and `metaDeletionRouter` both mount at `"/"` with global requireAuth. Fix: moved `selfProofRouter` and `referralsRouter` above them.
- Pattern to watch: if a new public endpoint returns 401 unexpectedly and there's no requireAuth on the route itself, check if a `router.use("/", ...)` with global auth sits above it in routes/index.ts.
