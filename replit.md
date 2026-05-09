# NexOS AI

AI-powered operating system for campaign execution, launch automation and digital growth — transforming user intention into fully orchestrated campaign execution.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — build composite libs (run before api-server typecheck when DB schema changes)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Seed plans: `cd lib/db && /home/runner/workspace/node_modules/.pnpm/node_modules/.bin/tsx src/seed-plans.ts`
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (modular domain architecture — services, routes, middleware per domain)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Validation: Zod (zod/v4)
- Auth: JWT (access 15m + refresh 30d) + bcryptjs
- Real-time: Socket.io (WebSocket) at /api/socket.io
- Jobs: BullMQ + Redis (graceful degradation when Redis unavailable)
- AI: Multi-provider gateway (Anthropic → strategy/command/compliance, OpenAI → copy/creative/media, Gemini → analytics/optimization/video)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — all Drizzle table definitions (one file per domain)
- `lib/db/src/seed-plans.ts` — plan seeder
- `artifacts/api-server/src/modules/` — domain modules (auth, credits, campaigns, workspaces, plans, ai-gateway, queue, realtime, orchestration, metrics, content, agents, intake)
- `artifacts/api-server/src/lib/` — shared utilities (env, errors, logger)
- `artifacts/api-server/src/routes/` — route barrel (mounts all module routers)

## Architecture Decisions

- **Modular domain architecture**: each domain has its own service (business logic), routes (HTTP layer), and optionally middleware. No cross-module imports except through explicit interfaces.
- **Decoupled payment gateways**: integrations with Stripe, Hotmart, etc. are workspace-level optional connections and never block campaign execution. `blocksExecution = false` is a hard rule for all payment gateways.
- **Credit system based on actual AI costs**: credits are calculated from real provider token costs × margin multiplier (1.5x default). `AI_PROVIDER_COSTS` and `calculateCostUsd()` in `lib/db/src/schema/ai-provider-logs.ts` are the source of truth.
- **Multi-provider AI routing**: each agent role maps to the optimal provider (Claude for strategy/reasoning, GPT-4o for copywriting/creative, Gemini for analytics/optimization). Defined in `ai-gateway.service.ts`.
- **Campaign State Machine**: `VALID_STATUS_TRANSITIONS` in `campaigns.service.ts` enforces valid transitions. Campaigns cannot skip states or go backwards except through defined paths.
- **Socket.io rooms**: clients join `campaign:{id}` rooms to receive real-time agent events. The Live Production Display streams via `emitAgentThinking()`, `emitAgentStarted()`, `emitAgentCompleted()`.
- **Async execution pipeline**: `POST /campaigns/:id/execute` returns 202 immediately; BullMQ worker processes asynchronously. When Redis is unavailable (dev), falls back to `setImmediate` direct execution — never blocks HTTP. Worker in `orchestration.worker.ts`, service in `orchestration.service.ts`.
- **Campaign execution state machine phases**: intake → (execute/strategy) → analyzing → strategy_ready → (execute/content) → generating → awaiting_approval → approved → (execute/launch) → executing → live → (execute/monitor) → completed.
- **Metrics health score**: 100-point system (revenue 35 + ROAS 25 + CPL 20 + email 10 + trend 10). Auto-generates alerts at thresholds. Auto-triggers optimization agent at score ≤ 30. Schema in `lib/db/src/schema/metrics.ts`.

## Product

NexOS AI sells to digital product launchers and agencies. Two plans:
- **Solo** (R$297/mo + R$2500 onboarding): 3 campaigns, 1500 credits/month, 6-digit track
- **Agency** (R$1497/mo + R$2500 onboarding): 10 campaigns, 5000 credits/month, all tracks, white-label

Launch tracks by revenue target:
- **6-digit**: R$100k–R$999k in 7 days
- **8-digit**: R$10M–R$99M in 7 days
- **10-digit**: R$100M+ in 7 days

## User Preferences

- Frontend: fintech-grade high-tech design aesthetic
- No drag-and-drop — everything AI-generated
- AI must align/approve before generating any video or image (pre-flight concept → low-res preview → user approval → high-res final)
- All AI generations have an auditable log trail
- Payment integration is NEVER a blocker for campaign execution
- Multilingual: PT-BR first, EN-US and ES-LA modular

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` when DB schema changes
- BullMQ queue names cannot contain `:` — use `-` instead
- Redis is optional in dev — queues and WebSocket degrade gracefully
- Seed plans before first user registration (Solo plan must exist)
- `z.record()` in zod/v4 requires two args: `z.record(z.string(), z.unknown())`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB schema source of truth: `lib/db/src/schema/`
- AI cost source of truth: `lib/db/src/schema/ai-provider-logs.ts` → `AI_PROVIDER_COSTS`
- Credit action costs: `lib/db/src/schema/credits.ts` → `CREDIT_COSTS`
