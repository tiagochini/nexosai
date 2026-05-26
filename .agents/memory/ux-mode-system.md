---
name: UX Fundador/Arquiteto System
description: Two-mode UX system implemented across the app; key files, flow, and gotchas.
---

## Rule
The canonical mode file is `lib/mode.ts` — exports `useMode()` with `{ mode, setMode, isFundador, isArquiteto, isExpert, isGuided }`. `lib/mode.tsx` is a re-export shim only. Never add logic to mode.tsx.

**Why:** A stale duplicate `pages/mode.tsx` caused confusion; mode.ts is the single source.

## How to apply
- `isFundador` → show simplified, emotional, guided views (max 2xl centered, fewer panels)
- `isArquiteto` → show full technical dashboard (all panels, traces, metrics, tabs)
- Mode is stored in localStorage key `nexos_mode`, default is `"fundador"`

## New user flow (post-implementation)
1. Register / Checkout → `/welcome` (standalone full-screen emotional welcome)
2. `/welcome` marks seen + redirects to `/onboarding`
3. `/onboarding` starts at `welcome` step (briefing team intro) → path_select → conversation → plan_preview → diagnosis_approval → integration_setup
4. Dashboard auto-redirect: if no campaigns + has plan → `/welcome`

## Files changed
- `pages/welcome/index.tsx` — standalone full-screen welcome (hasSeenWelcome / markWelcomeSeen helpers)
- `pages/war-room/index.tsx` — Fundador War Room view for active campaigns; redirects to /campaigns/:id if isArquiteto
- `components/ux-context-bar.tsx` — mode-aware context bar component
- `components/feature-onboarding.tsx` + `lib/useFeatureOnboarding.ts` — per-feature guided onboarding
- `pages/onboarding.tsx` — UIStep now includes "welcome" and "diagnosis_approval"
- `pages/dashboard.tsx` — isFundador → simplified 2xl view with mission card + 2-KPI strip
- `pages/campaigns/detail.tsx` — isFundador → emotional status view with phase progress bar
- `routes.tsx` — /welcome (WelcomeRoute) + /war-room/:id registered
- `pages/register.tsx` + `pages/checkout.tsx` → redirect to /welcome for new users

## Gotchas
- `AgentRun` interface uses `agentRole` not `role`
- `useGetCampaign` takes positional `(id, options)` not `{ id }` object
- Fundador view in detail.tsx uses `executeMutation.mutate()` / `executeMutation.isPending` directly (no handleExecute wrapper)
- sidebar `expertOnly: true` groups are already hidden from Fundador (isExpert = isArquiteto)
