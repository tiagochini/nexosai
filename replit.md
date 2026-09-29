# NexOS AI

AI-powered operating system for campaign execution, launch automation and digital growth — transforming user intention into fully orchestrated campaign execution.

## Run & Operate

- In this imported Replit workspace, start **Redis (development)** first, then **artifacts/api-server: API Server**, then **artifacts/app: web** using the Workflows pane. The managed app preview is `/`; login is `/login`, and API health is `/api/healthz`. Other artifact services (landing, academy, editor, video) can be started separately as needed.
- Use Node.js 24 and `pnpm install --frozen-lockfile` for a fresh checkout. Development PostgreSQL is provisioned by Replit; on a new, **empty** development database only, initialize the schema with `pnpm --filter @workspace/db run push`. Do not run schema push against an existing database without reviewing the proposed changes. Local development Redis binds to `127.0.0.1:6379` and is configured without persistence, so queued jobs do not survive its restart.
- A clean `pnpm run typecheck` currently fails in the legacy `scripts` package; the app and API package typechecks pass. External AI, email, and social-provider features require their own configured credentials and are not validated by the local health check. Do not put credentials in tracked configuration; rotate any credential-like values that were committed in the imported `.replit` file.
- `pnpm run dev:local` — Windows/local launcher; builds the API on port 8080 and starts Vite on 8081
- `pnpm run dev:local:meta-test` — same local stack with outbound Meta Graph calls simulated in memory
- `pnpm run dev:meta-gateway` — exposes only the two Meta webhook paths on local port 8090
- `pnpm --filter @workspace/api-server run dev` — Replit/Linux API launcher
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — build composite libs (run before api-server typecheck when DB schema changes)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Seed plans: `cd lib/db && /home/runner/workspace/node_modules/.pnpm/node_modules/.bin/tsx src/seed-plans.ts`
- Required env: `DATABASE_URL` — Postgres connection string

Local setup and restored-database safety are documented in `README.md` and
`docs/LOCAL_DEVELOPMENT.md`. Meta callback development is documented in
`docs/META_WEBHOOK_LOCAL_DEV.md`.

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
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — transactional/broadcast email via Resend
- `HEYGEN_API_KEY` — AI avatar video generation (account exists; not yet connected in production — see Gotchas)
- `ELEVENLABS_API_KEY` — voice cloning/narration (**not currently set** — voice cloning is non-functional until this secret is added)

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
- `artifacts/api-server/src/modules/` — domain modules (auth, credits, campaigns, workspaces, plans, ai-gateway, queue, realtime, orchestration, metrics, content, agents, intake, launch-sequence, vsl, email-dispatch, whatsapp, social, creatives, video-production, weekly-report, sales-team, server-events)
- `artifacts/api-server/src/modules/launch-sequence/sequence-scheduler.worker.ts` — automation engine (60s tick, BullMQ + setInterval fallback)
- `artifacts/api-server/src/modules/launch-sequence/sequence-analytics.service.ts` — engagement stats, adaptive AI suggestions, contact segment recalc
- `artifacts/api-server/src/modules/launch-sequence/sequence-realtime.ts` — Socket.io events for live automation dashboard
- `artifacts/api-server/src/modules/agents/whatsapp-response.agent.ts` — AI auto-response (classify intent + generate reply)
- `artifacts/api-server/src/modules/social/` — `social.publisher.ts` (Instagram/Facebook/TikTok publish calls), `social.autopost.service.ts` (fire-and-forget post on content approval)
- `artifacts/api-server/src/modules/creatives/creatives.service.ts` — DALL-E image pipeline: concept_pending → concept_ready → preview_generating → preview_ready → final_generating → approved (each step is a manual/explicit trigger, not automatic)
- `artifacts/api-server/src/modules/video-production/video-generation.service.ts` — real AI video generation (Runway, Kling, HeyGen avatar, ElevenLabs voice) — separate "Generate Video" action, not bulk-generated with content
- `artifacts/api-server/src/modules/weekly-report/` — weekly HTML report composer + `POST /api/reports/send` + Monday 08:00 UTC scheduler
- `artifacts/api-server/src/modules/sales-team/` — Time de Vendas CRUD + AI reply suggestions (`POST /api/sales-team/:id/suggest`)
- `artifacts/api-server/src/modules/market-intel/` — Análise Mercadológica: `market-intel.service.ts` (startAnalysis bg via setImmediate, 90-day reuse of UNLINKED ready reports only, triggerMarketIntelFromIntake idempotent per campaign excluding failed, buildIntakeMarketIntelContext, deepdive chat) + routes at `/api/market-intel`. Intake fires it via setImmediate after both saveIntakeData sites in `intake.ai.ts`; clarifying questions from the agent are injected into the intake contextNote. UI: `artifacts/app/src/pages/market-intel/index.tsx` (`/market-intel`, sidebar "Inteligência de Mercado").
- `artifacts/api-server/src/modules/server-events/` — Meta CAPI + TikTok Events API server-side tracking (`/api/events/*`, fire-and-forget)
- `artifacts/api-server/src/modules/social-presence/` — Presença Social Always-On: `social-presence.service.ts` (config upsert, generate-week 202+setImmediate com guard in-flight/409, approve/PATCH posts, bio optimize, métricas com sync 6h, `publishDuePresencePosts` com claim CAS atômico + recovery de "publishing" preso >10min, `generateWeekForAllActiveConfigs`) + rotas em `/api/presence`. Agentes em `agents/presence-planner.agent.ts` (presence_planner, bio_optimizer — por plataforma, campaignId:null). Scheduler: segunda 08h UTC (plano semanal) + tick 60s (publicação) em `sequence-scheduler.worker.ts`. LinkedIn é publicação manual (usuário marca published via PATCH); IG/TikTok sem mediaUrls ficam scheduled com hint; auto-publish bloqueado nos primeiros 7 dias da config. UI: `artifacts/app/src/pages/presence/index.tsx` (`/presence`, sidebar "Presença Social"). Smoke test: `scripts/src/presence-smoke-test.ts` + `presence-smoke-verify.ts`.
- `artifacts/api-server/src/lib/` — shared utilities (env, errors, logger)
- `artifacts/api-server/src/routes/` — route barrel (mounts all module routers)
- `artifacts/app/src/pages/integracoes/index.tsx` — canonical integration management page (`/integracoes`); connect/disconnect, Full Auto status bar, guided AI chat panel (`integration-chat-panel.tsx`)
- `artifacts/app/src/pages/settings.tsx` — Configurações; 4th tab duplicates integration connect UI (legacy — prefer `/integracoes`)
- `artifacts/app/src/pages/campaigns/content.tsx` — content approval page (3 tabs: Por Plataforma, Cronograma, Segmentação)
- `artifacts/app/src/pages/video-production/index.tsx` — recording mode + avatar/voice selection (RECORDING_MODES: no_face/partial_pip/own_recording)
- `artifacts/app/src/components/CloneStudioPanel.tsx`, `CloneWowMoment.tsx` — avatar/voice clone onboarding flow (optional, manual trigger during `plan_preview`)
- `artifacts/app/src/pages/atendimento/index.tsx` — Time de Vendas conversation manager (kanban-by-stage)
- `artifacts/app/src/pages/agency/clients.tsx`, `affiliate/index.tsx`, `revenue/index.tsx`, `admin/index.tsx` — Agency client management, affiliate program, revenue analytics, Owner Command Center

## Architecture Decisions

- **Modular domain architecture**: each domain has its own service (business logic), routes (HTTP layer), and optionally middleware. No cross-module imports except through explicit interfaces.
- **Decoupled payment gateways**: integrations with Stripe, Hotmart, etc. are workspace-level optional connections and never block campaign execution. `blocksExecution = false` is a hard rule for all payment gateways.
- **Credit system based on actual AI costs**: credits are calculated from real provider token costs × margin multiplier (1.5x default). `AI_PROVIDER_COSTS` and `calculateCostUsd()` in `lib/db/src/schema/ai-provider-logs.ts` are the source of truth.
- **Multi-provider AI routing**: each agent role maps to the optimal provider (Claude for strategy/reasoning, GPT-4o for copywriting/creative, Gemini for analytics/optimization). Defined in `ai-gateway.service.ts`.
- **Campaign State Machine**: `VALID_STATUS_TRANSITIONS` in `campaigns.service.ts` enforces valid transitions. Campaigns cannot skip states or go backwards except through defined paths.
- **Socket.io rooms**: clients join `campaign:{id}` rooms to receive real-time agent events. The Live Production Display streams via `emitAgentThinking()`, `emitAgentStarted()`, `emitAgentCompleted()`.
- **Async execution pipeline**: `POST /campaigns/:id/execute` returns 202 immediately; BullMQ worker processes asynchronously. When Redis is unavailable (dev), falls back to `setImmediate` direct execution — never blocks HTTP. Worker in `orchestration.worker.ts`, service in `orchestration.service.ts`.
- **Campaign execution state machine phases**: intake → (execute/strategy) → analyzing → strategy_ready → (execute/content) → generating → awaiting_approval → approved → (execute/launch) → executing → live → (execute/monitor) → completed. Content approval auto-advances `awaiting_approval → approved` but does NOT auto-trigger `executing`/`live` — that requires a separate launch action.
- **Metrics health score**: 100-point system (revenue 35 + ROAS 25 + CPL 20 + email 10 + trend 10). Auto-generates alerts at thresholds. Auto-triggers optimization agent at score ≤ 30. Schema in `lib/db/src/schema/metrics.ts`.
- **Integration gate on launch**: `checkIntegrationsForLaunch()` in `execution.routes.ts` runs before `execute/launch`; requires connected messaging (WhatsApp/Telegram) AND email (RD Station/ActiveCampaign/`RESEND_API_KEY`). Missing → HTTP 422 `MISSING_INTEGRATIONS` + blocking modal on frontend linking to `/integracoes`. This is the ONLY integration gate — never gate at content approval or status PATCH.
- **Deliverable generation is opt-in per asset, not bulk**: content pieces (scripts/copy/plans) generate automatically during the `generating` phase, but actual DALL-E images and AI videos require an explicit follow-up action per creative — approving content does not by itself produce final image/video files.

## Product

NexOS AI sells to digital product launchers and agencies. Two plans:
- **Solo** (R$3.990 lançamento / R$5.000 regular — acesso único vitalício): 3 campaigns, 900 credits incluídos (~2 lançamentos), 6-digit track
- **Agency** (R$9.990 lançamento / R$14.000 regular — acesso único vitalício): 10 campaigns, 2000 credits incluídos (~5 lançamentos), all tracks, white-label
- **NexOS Academy** (R$2.500 lançamento / R$3.900 regular — acesso único): bônus incluso para quem adquire NexOS AI
- MODELO: ticket único, sem mensalidade, sem recorrência. Créditos adicionais: 500cr/R$85, 1500cr/R$239, 3500cr/R$529, 7000cr/R$979

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

## Integrations

- **Providers**: WhatsApp Business, Telegram, RD Station, ActiveCampaign, Mailchimp, Resend, Meta Ads, Instagram, Facebook, TikTok (organic — stored under DB enum value `tiktok_ads`, no separate organic value), TikTok Ads, Google Ads, LinkedIn Ads, Stripe, PayPal, Mercado Pago, Pagar.me, Asaas, Hotmart, Eduzz, Kiwify, HubSpot, HeyGen, Runway ML, Kling (fal.ai), ElevenLabs.
- **Canonical connect page**: `/integracoes` (`artifacts/app/src/pages/integracoes/index.tsx`) — always sends `accessToken` as a top-level field on `POST /api/workspaces/me/integrations`, so manual connects reliably compute `status: "connected"`.
- **Legacy duplicate**: `settings.tsx` Configurações → Integrações tab has the same connect form but historically only nested `accessToken` inside `metadata` (never top-level) — backend then computed `status: "disconnected"` even with a valid token saved in `metadata`. **Fixed** to send `accessToken` top-level like `/integracoes`. Prefer `/integracoes` for all new integration work; treat `settings.tsx`'s integrations tab as legacy.
- **OAuth flow**: `oauth.routes.ts` always sets `status: "connected"` on successful callback. Meta OAuth "URL Blocked" errors are an external config issue — register both provider-specific production redirects when both integrations are used: `/api/integrations/oauth/callback/instagram` and `/api/integrations/oauth/callback/facebook`.
- **Meta webhook callbacks**: `/api/social/webhooks/meta` and `/api/social-moderation/webhooks/meta` are compatibility URLs backed by the same DM/comment processor and persistent idempotency claims. The moderation URL is canonical for new configuration. `META_WEBHOOK_AUTO_SUBSCRIBE` is opt-in; restored databases must keep it disabled and subscribe only a selected test integration.
- **Guided integration chat**: `integrationChatConversationsTable`/`integrationChatMessagesTable` (`lib/db/src/schema/integration-chat.ts`), routes at `/api/integration-chat`. Floating `IntegrationChatPanel` mounted only on `/integracoes`; detects credentials in AI responses and offers copy buttons. Prompt lives in `integrations-specialist.prompt.ts`.
- **`SocialLaunchGate`** (`campaigns/content.tsx`): no inline OAuth popups — shows connection status or a CTA to `/integracoes`, where the real connection happens.
- **Social auto-post**: `social.autopost.service.ts` fires on content approval (fire-and-forget from `content.routes.ts`), publishes to Instagram/Facebook/TikTok only when the integration is truly `connected` with a real token; logs every attempt to `social_posts`. No silent mocking — it skips and logs when not connected.
- **AI Integrations (Anthropic/OpenAI/Gemini)**: all 3 provisioned via Replit `AI_INTEGRATIONS_*` env vars, used automatically when no native key is set (see Gotchas for exact model names). Fallback chain: Anthropic → OpenAI integration → Anthropic integration → error.
- **HeyGen / ElevenLabs / Runway / Kling are NexOS-operated AI infrastructure, NEVER customer-connectable integrations.** `video-generation.service.ts` uses only `env.HEYGEN_API_KEY` / `env.ELEVENLABS_API_KEY` / `env.RUNWAY_API_KEY` / `env.FAL_API_KEY` — no per-workspace "bring your own key" path exists (removed 2026-07-10; previously `settings.tsx` + `POST/DELETE /api/workspaces/me/heygen/connect` let a customer plug their own HeyGen key, which would have let them bypass AI-credit consumption — the core of NexOS's recurring revenue). Do not reintroduce customer-supplied keys for AI generation providers. `/integracoes` (customer-facing) correctly never lists these 4 providers — only social/messaging/email/payment integrations belong there.

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` when DB schema changes
- BullMQ queue names cannot contain `:` — use `-` instead
- The API can start without Redis, but queue workers, schedulers and cross-process realtime are degraded. Use Redis 6.2+ for a representative local environment.
- Seed plans before first user registration (Solo plan must exist)
- `z.record()` in zod/v4 requires two args: `z.record(z.string(), z.unknown())`
- Redis ECONNREFUSED errors are suppressed in dev (ioredis/BullMQ internal — not a bug)
- Intake module split: `intake.service.ts` (questions/save), `intake.ai.ts` (NL/conversational/finalize), `intake.scoring.ts` (readiness score/viability — pure functions)
- `deductCredits(workspaceId, action, log, campaignId?)` — log is 3rd arg, NOT optional
- `runStrategyAgent(campaignId, workspaceId, intakeData, track, log, profile?)` — track is 4th arg
- `runProfileBuilderAgent(campaignId, workspaceId, intakeData, campaignType, log)` — 5 required args
- `runAgent(opts)` requires `messages: AIMessage[]` (not `userMessage`) + `campaignId?` (optional) + `workspaceId`
- `runAgent` `campaignId` is `string | null | undefined` — pass `null` for sequence-level agents (no `campaign_agents` row inserted, no UUID FK violation)
- Replit AI integrations: Anthropic uses `claude-sonnet-4-6`, OpenAI uses `gpt-5.5` (requires `max_completion_tokens` NOT `max_tokens`), Gemini uses `gemini-3-flash-preview`. All 3 are provisioned via `AI_INTEGRATIONS_*` env vars. When native keys are present they take precedence. `callOpenAI()` auto-detects gpt-5.x models and switches the token param.
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
- **UTM Intelligence**: Auto-reads UTMs from body and query params (`lead-capture.routes.ts`), stored in `metadata.utm` + flat keys. `getSequenceAnalytics()` returns `utmBreakdown[]` sorted by volume.
- **Live-stats endpoint**: `GET /api/campaigns/:id/live-stats` — real-time counters for scarcity copy (leads, sales, revenue, engagement, active sequences).
- **Viral loop / referral system**: each captured lead gets an 8-char `referralCode`; `?ref=CODE` or `body.referralCode` tracks referrer; `GET /api/lead-capture/:sequenceId/referral/:code` returns referrer stats.
- **Send time optimization**: `open` events append UTC hour to `contact.metadata.engagementHours` (capped 20); mode → `metadata.preferredSendHour`; analytics returns `sendTimeInsight`.
- **Creative fatigue detection**: on every metric ingest, if current CTR < 70% of historical peak CTR (peak > 0.5%), generates a `kpi_breach` alert recommending creative refresh.
- **completeWithAgent signature**: positional args `(agentRole, systemPrompt, messages, workspaceId, log, campaignId?)` — NOT an object. Returns `AICompletionResult` with `.content` string field. `AppError` constructor is `(statusCode, message, code?)` — status code is FIRST arg.
- **Professor Allan (Academy)**: zod limits `lessonContent` 20 000 / `question` 2 000 / history content 5 000 chars; `max_tokens` 2 048; frontend truncates `lessonContent` to 15 000 chars before sending.
- **Intake completude coherence**: the campaigns list % and the intake page % must always be the SAME metric (answered/total required fields) — list.tsx's `PipelineBar` reads `campaign.intakeCompleteness.percentage` (computed server-side in `campaigns.routes.ts` GET "/") for `status==="intake"` rows instead of the pipeline-stage index. `intake.ai.ts`'s round-limit branch and main LLM path force `progress:100`/`missingRequired:[]` whenever completion is signaled (via `parsed.isComplete`, completeness check, or `messageSignalsCompletion()` text heuristic on the agent's free-text message) so the "Ver e Aprovar Master Plan" button and the % never disagree with what the agent says.
- **Avatar/Voice Recording Gate**: `video_projects` gains `awaiting_clone` status + `pendingAction` (`"preview"|"final"`) column. `generatePreviewClips`/`generateFinalClips` pause and set these when persona lacks `voiceCloneId`/`heygenAvatarId`, instead of silently skipping avatar scenes. Endpoints: `GET /me/persona/stock-avatars`, `POST /me/persona/clone-avatar` (HeyGen talking_photo from a frame), `POST /me/persona/select-stock-avatar`, `POST /me/persona/clone-voice` (ElevenLabs). Frontend `AvatarCloneGate` component resumes the paused pipeline via `pendingAction` after cloning completes. All calls use NexOS's own `HEYGEN_API_KEY`/`ELEVENLABS_API_KEY` — never customer-supplied keys.
- **HeyGen talking_photo_style**: must be `"square"` (or `"circle"`/`"closeUp"`) — `"normal"` is rejected with HTTP 400 `invalid_parameter`. Verified live against the real HeyGen API.
- **ElevenLabs instant voice cloning requires a paid ElevenLabs plan** (`paid_plan_required` / `can_not_use_instant_voice_cloning` on the free tier) — this is an account-level blocker, not a code bug. Voice cloning will keep failing in production until the ElevenLabs account is upgraded.
- **HeyGen Digital Twin (video-based avatar clone) requires an Enterprise HeyGen plan.** `POST /v2/video_avatar` returns HTTP 403 `forbidden` on non-Enterprise accounts — verified live. This is an account-level blocker, not a code bug. Full flow is implemented (`POST /me/persona/clone-avatar-video`, `GET /me/persona/avatar-training-status` in `workspaces.routes.ts`; frontend video-record flow in `AvatarCloneGate`), and will work automatically once HeyGen account is upgraded to Enterprise — no code changes needed then. Photo-based `talking_photo` cloning (no plan requirement) remains the default/working option; video clone is offered as a 3rd "Vídeo (mais realista)" choice alongside stock/photo, and gracefully surfaces the HeyGen error if attempted on a non-Enterprise account. `v2/video_avatar` and `v2/video/generate` are deprecated by HeyGen but remain supported through Oct 31, 2026; no v3 replacement exists yet for Digital Twin *creation* (v3 only replaces the video *generation* call, `/v3/videos`).

- **Video Editor — real cinematographic analysis, live director chat, long uploads**: `POST /video-editor/visual-analysis/:fileId` extracts real frames via ffmpeg and scores them with vision AI (composition/lighting/framing) using the shared `ATLAS_CINEMATOGRAPHY_LIBRARY` (exported from `scene-director.agent.ts`, single source of truth for storyboard + analysis + chat), cached per fileId. `POST /video-editor/director-chat` is a free-form ATLAS Q&A endpoint with script/takes context, usable at any point during editing (not just at storyboard generation). Upload limit raised to 2GB with `MAX_UPLOAD_DURATION_SECONDS` (35min) duration validation. `callVisionChat()`/`callVisionChatOpenAI()` now chain Anthropic native → OpenAI native (gpt-5.5 → gpt-4o) → Replit AI Integrations proxy, since vision/chat callers previously had no fallback when the native key hit quota/access errors (see `completeWithAgent-fallback` memory).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB schema source of truth: `lib/db/src/schema/`
- AI cost source of truth: `lib/db/src/schema/ai-provider-logs.ts` → `AI_PROVIDER_COSTS`
- Credit action costs: `lib/db/src/schema/credits.ts` → `CREDIT_COSTS`
