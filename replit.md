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

## TikTok Integration (Post-session)

- **TikTok added everywhere**: `tiktok` provider added to `settings.tsx` INTEGRATION_CATALOG (Social Orgânico category), `onboarding.tsx` INTEGRATION_CATALOG + PATH_INTEGRATIONS (all 4 paths), `dashboard.tsx` CRITICAL_INTEGRATIONS, `social.autopost.service.ts` platform mapping (`reel`, `feed_video`, `short_video`, `tiktok_video`, `tiktok_reel` → `tiktok`).
- **TikTok Ads** also added to settings catalog (Mídia Paga category) and maintained in existing social.tsx.
- **`publishToTikTok()`** in `social.publisher.ts`: uses TikTok Content Posting API v2 Pull Upload (`/post/publish/video/init/`). Requires video URL + access token. Fire-and-forget from autopost.
- **TikTok Ads** (`tiktok_ads`) was already in the DB enum; organic `tiktok` is treated as a connected integration stored under the `tiktok_ads` enum value for now (DB enum unchanged to avoid migration). Display layer uses `tiktok` string, provider stored as `tiktok_ads`.

## Resend Email Integration (Post-session)

- **`sendViaResend()`** added to `email-dispatch.service.ts`: detects Resend Audience UUID vs. email address in `listId`. If UUID → uses Resend Broadcasts API. If email address → uses transactional `/emails` endpoint.
- **`RESEND_API_KEY`** and **`RESEND_FROM_EMAIL`** added to `env.ts`.
- Fallback: when `RESEND_API_KEY` is set and provider is `mailchimp/sendgrid/brevo/custom_smtp`, automatically routes through Resend instead of mock-sending.
- Integration gate also considers `RESEND_API_KEY` as satisfying the email requirement.

## Integrações Page (Post-session)

- **`/integracoes`** — new dedicated page at `artifacts/app/src/pages/integracoes/index.tsx`. Full integration management: connect/disconnect, organized by category, Full Auto status bar, per-integration "why you need it" explanation, required badges.
- **Sidebar** — "Integrações" item added under "Automações" group, always visible (not expert-only). Points to `/integracoes`.
- **Route** registered in `routes.tsx` as protected route.
- **Dashboard CTA** — "Conectar" button in IntegrationHealthPanel now points to `/integracoes` (was `/configuracoes?tab=integracoes`).

## Integration Gate on Launch (Post-session)

- **`checkIntegrationsForLaunch()`** in `execution.routes.ts`: runs before `execute/launch` phase. Checks DB for connected messaging (WhatsApp/Telegram) AND email (RD Station/ActiveCampaign) + checks env for `RESEND_API_KEY`. If missing, returns HTTP 422 with `MISSING_INTEGRATIONS` code + `data.missing[]` array.
- **Frontend gate**: `campaigns/detail.tsx` handles `MISSING_INTEGRATIONS` code — sets `missingIntegrations` state which renders a blocking modal with the list of missing categories, connect options, and a CTA button to `/integracoes`.

## AI Integration Status (Post-session)

- **Replit AI Integrations active**: All 3 provisioned — Anthropic, OpenAI, Gemini via `AI_INTEGRATIONS_*` env vars.
- **ai-gateway.service.ts updated**:
  - `getAnthropic()`: uses `AI_INTEGRATIONS_ANTHROPIC_*` when no native key → model auto-switches to `claude-sonnet-4-6`
  - `getOpenAI()`: uses `AI_INTEGRATIONS_OPENAI_*` when no native key → model auto-switches to `gpt-5.4` with `max_completion_tokens` (not `max_tokens`)
  - `getGemini()`: uses `AI_INTEGRATIONS_GEMINI_API_KEY` when no native key → model `gemini-3-flash-preview`. Falls back to Anthropic integration when no Gemini access.
  - All fallback chains: Anthropic → OpenAI integration → Anthropic integration → error
- **env.ts**: Added `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`

## Social Auto-Post Status (Post-session)

- **`social.autopost.service.ts`**: Fire-and-forget post to Instagram/Facebook on content approval. Triggered from `content.routes.ts` after `approveCampaignContent()`. Maps content piece types to platforms, looks up connected workspace integrations, calls `publishToInstagram`/`publishToFacebook`, logs results to `social_posts` table.
- **Content approval pipeline**: `POST /campaigns/:campaignId/content/:pieceId/approve` now triggers both memory save AND social auto-post (both fire-and-forget, never block HTTP response).

## Frontend Status (Post-session)

- **Socket.io real-time**: `artifacts/app/src/lib/socket.ts` — singleton `useCampaignSocket(campaignId, onEvent, enabled)` hook. Connects to `/api/socket.io`, auth via JWT from localStorage, joins `campaign:{id}` room, listens for `campaign:event`. Auto-scrolling live feed injected in Campaign Detail → Agentes tab (only visible when campaign is in active statuses).
- **Integrações tab**: `artifacts/app/src/pages/settings.tsx` — 4th tab in Configurações. 10 providers in the catalog (WhatsApp Business, RD Station, ActiveCampaign, Hotmart, Kiwify, Stripe, Meta Ads, Google Ads, Telegram, HubSpot). Reads from `GET /api/workspaces/me/integrations`, writes via `POST /api/workspaces/me/integrations`. Connected integrations shown at top with live status badges.
- **Agency Clients page**: `artifacts/app/src/pages/agency/clients.tsx` — `/agency/clients` route + sidebar link ("Clientes"). Full invite/manage/revoke flow. Plan guard shows upgrade prompt for non-Agency users. Uses `GET/POST/PATCH/DELETE /api/agency/*` endpoints.
- **Onboarding plan preview**: `artifacts/app/src/pages/onboarding.tsx` — After conversation completes, step transitions to `plan_preview` (7-day visual timeline, AI agents grid, revenue track projections). Then CTA navigates to intake or campaign.
- **Dashboard expandable KPIs**: `artifacts/app/src/pages/dashboard.tsx` — KpiCard now supports `breakdown`, `expanded`, `onToggle` props. Click to expand each KPI and see per-item breakdown. State managed by `expandedKpi: string | null`.
- **Dashboard Execution Flowchart**: `ExecutionFlowchart` component renders campaign pipeline as 5 clickable nodes (Briefing → Estratégia → Conteúdo → Lançamento → Resultados). Node highlights if campaigns exist in that state. Clicking a node navigates to that campaign.
- **Content Approval page**: `artifacts/app/src/pages/campaigns/content.tsx` — route `/campaigns/:id/content` (before `/:id` to avoid conflict). 3 tabs: Por Plataforma, Cronograma, Segmentação. Approve/reject/edit/AI-rewrite per piece. Campaign detail links here when status=`awaiting_approval`.
- **Affiliate page**: `artifacts/app/src/pages/affiliate/index.tsx` — `/affiliate`. Join flow + active dashboard with referral link, KPI stats, 52-week teaser.
- **Revenue page**: `artifacts/app/src/pages/revenue/index.tsx` — Evolução chart tab with recharts AreaChart/BarChart, period selector (7d/30d/90d/all), cumulative chart, CSV export. WeeklyReportCard with health score + AI insight.
- **Dashboard Integration Health Panel**: `IntegrationHealthPanel` component in `dashboard.tsx` — shows WhatsApp/Instagram/Facebook/RD Station connection status. Displays "Full Auto" badge (green) when all connected, yellow warning with count + "Conectar" CTA when missing integrations. Fetches from `GET /api/workspaces/me/integrations`, cached 60s.

## Backend Status (Post-session)

- **Weekly report service**: `artifacts/api-server/src/modules/weekly-report/` — `weekly-report.service.ts` composes HTML email with metrics (revenue, sales, campaigns, credits, health score, AI insight). `weekly-report.routes.ts` exposes `POST /api/reports/send` (auth required, sends to workspace owner). Scheduler in `sequence-scheduler.worker.ts` fires `sendWeeklyReportsToAll()` every Monday at 08:00 UTC via `maybeFireWeeklyReport()` — non-blocking, idempotent (keyed by date string). No SMTP configured → logs compose preview only; wire `nodemailer`/SMTP env vars to enable real delivery.
- **Auth**: DB schema has `phone` + `phoneVerified` columns. Register accepts optional `phone`. Login and register pages fully rebuilt with confirmations, show/hide toggles, live validation.
- **Admin access fixed**: `ADMIN_EMAILS` set in `admin.routes.ts` includes both `admin@nexos.ai` and `founder@nexos.ai`. Frontend `auth.tsx` `isAdmin` check uses a Set (same two emails).
- **Admin financials endpoint**: `GET /api/admin/financials` — returns access revenue, pack revenue, AI costs (USD + BRL), margin %, conversion funnel, 7d/30d signups + revenue, low-credit upsell list (balance < 150), last 10 payments. `getAdminFinancials()` in `admin.service.ts`.
- **Owner Command Center**: `artifacts/app/src/pages/admin/index.tsx` rebuilt with 4 tabs: Visão Geral (KPI strip + SaaS status + growth), Financeiro (revenue breakdown + margin bar + funnel + recent payments), Oportunidades (low-credit upsell list + hibernated re-engagement), Usuários (full table).
- **Agents Hub expanded**: `artifacts/app/src/pages/agents/index.tsx` — 29 agents organized in 6 categories (Estratégia/Conteúdo/Audiência/Vídeo/Analytics/Automação). Each card shows provider badge (Claude/GPT-4o/Gemini), specialties, description and direct chat link.
- **Preparação page updated**: `WHATSAPP_LINKS` replaced with `GROUP_LINKS` supporting both WhatsApp (`https://chat.whatsapp.com/…`) and Telegram (`https://t.me/+…`) per segment. `WhatsAppButton` replaced with `GroupButtons` — shows both platform buttons when configured, two disabled placeholders when null.
- **Checkout pricing fixed**: `CREDIT_PACKS` updated to new pricing: Boost 500cr/R$85, Starter 1500cr/R$239, Pro 3500cr/R$529, Elite 7000cr/R$979. Old 1500cr/R$150 and 3000cr/R$240 removed.

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
- Replit AI integrations: Anthropic uses `claude-sonnet-4-6`, OpenAI uses `gpt-5.4` (requires `max_completion_tokens` NOT `max_tokens`), Gemini uses `gemini-3-flash-preview`. All 3 are provisioned via `AI_INTEGRATIONS_*` env vars. When native keys are present they take precedence. `callOpenAI()` auto-detects gpt-5.x models and switches the token param.
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
