---
name: Onboarding flag source of truth
description: hasSeenOnboarding is DB-backed on users table; localStorage is only a flash-prevention cache, not the gate.
---

`usersTable.hasSeenOnboarding` (boolean, default false) is the authoritative flag for whether a user has completed the first-login welcome flow. `POST /api/auth/onboarding/seen` sets it; `GET /api/auth/me` returns it.

**Why:** the original implementation used only a `localStorage` flag (`nexos_welcome_seen`), which meant onboarding replayed on every new device/browser and could never be inspected or reset server-side (e.g. for support or re-onboarding after a major feature launch).

**How to apply:** any route-gating logic (e.g. `WelcomeRoute` in `routes.tsx`) should check `user?.hasSeenOnboarding` first. `localStorage` may still be set alongside it purely to avoid a flash of the welcome flow while `/me` is loading right after registration — never treat it as the real gate.
