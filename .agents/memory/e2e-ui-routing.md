---
name: E2E UI Routing & Test Patterns
description: App routing facts and Playwright test patterns learned from E2E production testing
---

## App Routing (artifacts/app)

- `BASE_PATH = "/"`, `previewPath = "/"` — all routes are at ROOT, no `/app` prefix
- Login: `/login`, Dashboard: `/dashboard`, Campaign: `/campaigns/:id`
- Content: `/campaigns/:id/content`, War Room: `/war-room/:id`
- Integracoes: `/integracoes`, Revenue: `/revenue`, Sequences: `/sequences`
- Atendimento: `/atendimento`
- When writing Playwright tests, always use root-relative paths (e.g. `/login` NOT `/app/login`)

## PreLaunchChecklist Gates

4 gates must ALL pass before "Lançar Campanha Agora" button enables:
1. Canal de Mensagens (whatsapp_business OR telegram)
2. Plataforma de Email (rd_station OR activecampaign)
3. Verificação de Conteúdo (all pieces approved + 2.3s animation finishes)
4. Plano Financeiro — **requires explicit user click on "Confirmo" button** (UI-only state, `finConfirmed`)

**Why:** Gate 4 is intentional UX; user must acknowledge financial plan. Not a bug.
**How to apply:** In automated tests, expand Gate 4 section and click the confirm button before expecting the launch button to become enabled.

## BullMQ Zombie Worker Pattern

- After a server restart, BullMQ jobs enqueued for campaign may not be picked up immediately
- The zombie detection in `enqueueOrExecute()` fires after 30s: if job is still in "waiting" state with age > 30s, executes directly (fallback)
- Confirmed working: second launch attempt after 35s triggers `executeDirectly()` and transitions campaign to `live`

## Link/Button HTML Fix

- Never use `<Link><Button>` — renders as `<a><button>` (invalid HTML, nested interactive)
- Correct pattern: `<Button asChild><Link href="...">text</Link></Button>` — renders as `<a class="button-styles">`
- Fixed in: PreLaunchChecklist.tsx (3 places), admin/index.tsx, admin/nexos-launch.tsx
