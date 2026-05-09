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

## Production Environment Variables

**Required for production (will crash without these):**
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — used as JWT secret fallback (min 32 chars, random)

**Optional but strongly recommended:**
- `JWT_SECRET` — dedicated JWT signing key (defaults to SESSION_SECRET)
- `REDIS_URL` — Redis connection URL for BullMQ queues + Socket.io (gracefully degraded if absent)
- `ANTHROPIC_API_KEY` — Claude API key (strategy, compliance, intake AI)
- `OPENAI_API_KEY` — GPT-4o API key (copy, creative, content)
- `GEMINI_API_KEY` — Gemini API key (analytics, optimization)
- `ALLOWED_ORIGINS` — comma-separated allowed CORS origins (e.g. `https://app.nexos.ai,https://nexos.ai`)
- `APP_URL` — public base URL for OAuth callbacks and webhooks

**Optional integrations:**
- `NEXOS_BASE_DOMAIN` — base domain for white-label (default: `nexos.ai`)
- `CREDIT_MARGIN_MULTIPLIER` — AI cost markup multiplier (default: `1.5`)

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
- `artifacts/api-server/src/modules/` — domain modules (auth, credits, campaigns, workspaces, plans, ai-gateway, queue, realtime, orchestration, metrics, content, agents, intake, launch-sequence, vsl, email-dispatch, whatsapp)
- `artifacts/api-server/src/modules/launch-sequence/sequence-scheduler.worker.ts` — automation engine (60s tick, BullMQ + setInterval fallback)
- `artifacts/api-server/src/modules/launch-sequence/sequence-analytics.service.ts` — engagement stats, adaptive AI suggestions, contact segment recalc
- `artifacts/api-server/src/modules/launch-sequence/sequence-realtime.ts` — Socket.io events for live automation dashboard
- `artifacts/api-server/src/modules/agents/whatsapp-response.agent.ts` — AI auto-response (classify intent + generate reply)
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

## Frontend Status (Post-session)

- **Socket.io real-time**: `artifacts/app/src/lib/socket.ts` — singleton `useCampaignSocket(campaignId, onEvent, enabled)` hook. Connects to `/api/socket.io`, auth via JWT from localStorage, joins `campaign:{id}` room, listens for `campaign:event`. Auto-scrolling live feed injected in Campaign Detail → Agentes tab (only visible when campaign is in active statuses).
- **Integrações tab**: `artifacts/app/src/pages/settings.tsx` — 4th tab in Configurações. 10 providers in the catalog (WhatsApp Business, RD Station, ActiveCampaign, Hotmart, Kiwify, Stripe, Meta Ads, Google Ads, Telegram, HubSpot). Reads from `GET /api/workspaces/me/integrations`, writes via `POST /api/workspaces/me/integrations`. Connected integrations shown at top with live status badges.
- **Agency Clients page**: `artifacts/app/src/pages/agency/clients.tsx` — `/agency/clients` route + sidebar link ("Clientes"). Full invite/manage/revoke flow. Plan guard shows upgrade prompt for non-Agency users. Uses `GET/POST/PATCH/DELETE /api/agency/*` endpoints.

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` when DB schema changes
- BullMQ queue names cannot contain `:` — use `-` instead
- Redis is optional in dev — queues and WebSocket degrade gracefully
- Seed plans before first user registration (Solo plan must exist)
- `z.record()` in zod/v4 requires two args: `z.record(z.string(), z.unknown())`
- Redis ECONNREFUSED errors are suppressed in dev (ioredis/BullMQ internal — not a bug)
- Intake module split: `intake.service.ts` (questions/save), `intake.ai.ts` (NL/conversational/finalize), `intake.scoring.ts` (readiness score/viability — pure functions)
- `deductCredits(workspaceId, action, log, campaignId?)` — log is 3rd arg, NOT optional
- `runStrategyAgent(campaignId, workspaceId, intakeData, track, log, profile?)` — track is 4th arg
- `runProfileBuilderAgent(campaignId, workspaceId, intakeData, campaignType, log)` — 5 required args
- `runAgent(opts)` requires `messages: AIMessage[]` (not `userMessage`) + `campaignId?` (optional) + `workspaceId`
- `runAgent` `campaignId` is `string | null | undefined` — pass `null` for sequence-level agents (no `campaign_agents` row inserted, no UUID FK violation)
- Replit AI integration model: `claude-opus-4-5` (NOT `claude-sonnet-4-6` or `claude-3-5-haiku-20241022` — those are unsupported/deprecated). Test with a tiny call before assuming a model works.
- `parseAgentJSON` handles truncated LLM responses: tries code block extraction (with or without closing ```), then raw `{...}` extraction, then `repairTruncatedJson` (auto-closes unclosed braces/brackets). Always safe to call.
- LLM responses at 4096 max_tokens are often truncated mid-JSON for large outputs. Keep prompts compact and limit items in sequence builder to ≤20 to stay within token budget.
- Sequence contacts route: `POST /launch-sequences/:id/contacts` (NOT `/contacts/bulk`)
- `GET /launch-sequences/:id/analytics` returns `{ analytics: { sequenceId, segments, byItem[], adaptiveSuggestions[], healthScore, engagementTrend } }` — top-level key is `analytics`, not spread
- Launch sequence model values: `plf`, `formula_de_lancamento`, `semente`, `afiliado`, `perpetual`, `custom`
- Mental trigger values: `authority`, `social_proof`, `reciprocity`, `community`, `scarcity`, `urgency`, `anticipation`, `event`, `transformation`, `fear_of_loss`, `curiosity`, `contrast`
- WhatsApp dispatch requires workspace integration `whatsapp_business` with status `connected` + `accessToken` + `accountId` (phoneNumberId)
- Email dispatch: `rd_station` and `activecampaign` providers fully integrated; others mock-send with warning log
- Sequence automation: `POST /launch-sequences/:id/activate` calculates scheduledAt per item (startAt + dayIndex), sets all to `scheduled`, stores dispatch config in `config` JSONB
- Sequence scheduler: 60s repeatable job finds `status=scheduled AND scheduledAt<=now AND sequence.status=active` → auto-dispatches email+WhatsApp → marks `dispatched`
- Sequence contacts: `hot` (score≥60), `warm` (score≥25), `cold` (<25). Score = openRatio×50 + clickRatio×50. Updated on every engagement event.
- Email engagement webhooks: `POST /email-dispatch/webhook/rd_station` and `/activecampaign` — maps open/click/unsubscribe/bounce events to sequence engagement table
- WhatsApp AI auto-response: incoming webhook messages trigger `runWhatsAppResponseAgent` → classifies intent → sends response via Meta API (non-blocking setImmediate). `requiresHuman=true` emits Socket.io alert instead.
- Sequence analytics: `GET /launch-sequences/:id/analytics` returns segments (hot/warm/cold/converted/unsubscribed), per-item open/click rates, health score, engagementTrend, adaptiveSuggestions from AI
- Lead capture public endpoint: `POST /api/lead-capture/:sequenceId` — no auth required; validates `leadCaptureEnabled=true`, deduplicates by email, accepts UTM params + tags. `GET /api/lead-capture/:sequenceId` returns public sequence info.
- Purchase → auto-conversion: Hotmart/Kiwify/Eduzz sale webhooks auto-mark matching sequence contacts as `converted` (segment + engagementScore=100 + engagement event) via `setImmediate` after revenue event is saved.
- Campaign → sequence auto-activation: when campaign transitions to `executing`, all linked sequences in `draft`/`scheduled` with items are auto-activated (items scheduled from now+dayIndex, status→active, config.autoActivatedAt logged).
- `updateLaunchSequence` now handles `campaignId` and `leadCaptureEnabled` patches.
- **Per-item copy generation**: `POST /launch-sequences/:id/items/:itemId/generate-copy` — body `{contactSegment?: "hot"|"warm"|"cold"}`. Calls Copywriter AI agent, deducts 2 credits (`nurturing_message`), stores result in `item.metadata.generatedCopy[segment]`, sets status→`content_ready`. Agent: `item-copy.agent.ts`.
- **Launch calendar**: `GET /launch-sequences/:id/calendar` — day-by-day view. Returns days grouped by `dayIndex` with date (if activated), phase label, items, and hasCopy flag. Also returns `phases`, `milestones`, and `summary` from the AI plan.
- **Current phase / today**: `GET /launch-sequences/:id/today` — returns `currentDayIndex`, `currentPhaseLabel`, `progress` %, `today.items`, `tomorrow.items`, `nextSevenDays`, `performance` stats, `warnings[]`. Requires sequence to be active with `config.activatedAt` set.
- **Segment-aware cart dispatch**: Scheduler detects `cart_open`/`cart_middle`/`cart_close` phases and routes WhatsApp by segment. Queries `sequenceContactsTable` for hot/warm/cold contacts → sends segment-specific copy (from `generatedCopy[seg]` or template fallback). hot=VIP/insider angle, warm=standard urgency, cold=reactivation/curiosity.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB schema source of truth: `lib/db/src/schema/`
- AI cost source of truth: `lib/db/src/schema/ai-provider-logs.ts` → `AI_PROVIDER_COSTS`
- Credit action costs: `lib/db/src/schema/credits.ts` → `CREDIT_COSTS`
