# NEXOS AI — Master Architecture

**Última atualização:** 26 Mai 2026 | **Versão:** 2.5 (State Governance)

---

## Visão Geral

NEXOS AI é uma plataforma de orquestração de lançamentos digitais. A arquitetura é modular por domínio — cada domínio tem seu próprio service, routes, e opcionalmente worker. Sem imports cruzados entre módulos, exceto através de interfaces explícitas.

---

## Camadas do Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)         /artifacts/app                     │
│  52 páginas · Wouter routing · Socket.io client · JWT auth          │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP + WebSocket (/api/socket.io)
┌────────────────────────▼────────────────────────────────────────────┐
│  API GATEWAY (Express 5)         /artifacts/api-server              │
│  55 módulos · JWT middleware · Zod validation · Pino logging        │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐ ┌────▼────────────────┐
│  AI GATEWAY │ │  STATE  │ │  SCHEDULER  │ │  REALTIME           │
│  Multi-LLM  │ │ MACHINE │ │  BullMQ +   │ │  Socket.io rooms    │
│  Anthropic  │ │  Level 3│ │  setInterval│ │  campaign:{id}      │
│  OpenAI     │ │ enforced│ │  fallback   │ │  emitAgentThinking  │
│  Gemini     │ └────┬────┘ └──────┬──────┘ └────────────────────┘
└──────┬──────┘      │             │
       │         ┌───▼─────────────▼───┐
┌──────▼──────┐  │   CAMPAIGN BRAIN    │
│  AGENTS     │  │   10 sub-services   │
│  70+ roles  │  │   alignment         │
│  Isolation  │  │   doctrine-gate     │
│  Sandbox    │  │   vertical-memory   │
└─────────────┘  └─────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│  DATABASE (PostgreSQL + Drizzle ORM)     /lib/db                    │
│  38 tabelas · schema-per-domain · migrations via drizzle-kit        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Módulos Backend (55 total)

### Core Pipeline
| Módulo | Responsabilidade | Arquivo principal |
|--------|-----------------|-------------------|
| `campaigns` | CRUD + state machine | `campaigns.service.ts` |
| `campaign-state-machine` | **Single source of truth** — statuses, transitions, labels | `campaign-state-machine.ts` |
| `orchestration` | Coordena fases via BullMQ | `orchestration.worker.ts` |
| `intake` | Perguntas + NL conversacional + scoring | `intake.service.ts`, `intake.ai.ts` |
| `content` | Geração e aprovação de conteúdo | `content.service.ts`, `content.routes.ts` |
| `content-post-approval` | Side-effects de aprovação (isolados) | `content-post-approval.ts` |
| `agents` | Runner + checkpoint + audit | `agent.runner.ts`, `agents.routes.ts` |
| `agent-isolation-sandbox` | Wrapper tipado, nunca lança | `agent-isolation-sandbox.ts` |
| `ai-gateway` | Multi-LLM, custo, créditos | `ai-gateway.service.ts` |
| `creatives` | DALL-E 3 + status machine | `creatives.service.ts` |
| `creative-intent` | ConceptDraft + aprovação por índice | `creative-intent.service.ts` |
| `creative-auto-gen` | Auto-geração de conceitos do brief | `creative-auto-gen.service.ts` |
| `campaign-brain` | Alignment + doctrine + memory | 10 sub-services |

### Automação e Despacho
| Módulo | Responsabilidade |
|--------|-----------------|
| `launch-sequence` | Sequências multi-step email+WhatsApp |
| `sequence-scheduler.worker` | 60s tick — despacho automático |
| `email-dispatch` | RD Station, ActiveCampaign, Resend |
| `whatsapp` | Meta API + AI auto-response |
| `social` | Instagram, Facebook, TikTok publisher |
| `social.autopost` | Fire-and-forget após aprovação de conteúdo |
| `social.worker` | 60s + 6h timers para posts agendados |
| `server-events` | Meta CAPI + TikTok Events API |

### Receita e Produtos
| Módulo | Responsabilidade |
|--------|-----------------|
| `revenue` | Revenue events + webhooks Hotmart/Kiwify |
| `billing` | Planos e pagamentos Asaas |
| `credits` | Sistema de créditos por custo real de AI |
| `products` | Produtos digitais + checkout |
| `sales-team` | Kanban de atendimento + sugestão AI |

### Infraestrutura
| Módulo | Responsabilidade |
|--------|-----------------|
| `auth` | JWT access (15m) + refresh (30d) + bcrypt |
| `workspaces` | Workspace + integrações |
| `memory` | Campaign memory + compressão |
| `realtime` | Socket.io rooms + events |
| `queue` | BullMQ + Redis graceful degradation |
| `metrics` | Health score 100pt + alertas automáticos |
| `compliance` | Verificação de compliance por agente |
| `weekly-report` | Email semanal de métricas |
| `admin` | Owner command center + financials |

---

## Governança de Estado de Campanha

> **Fonte:** `campaign-state-machine.ts` → `NEXOS_STATE_MACHINE.md`

- **Level 3 ativo:** `transitionCampaign()` lança `ValidationError` em transições inválidas
- **11 status:** intake → analyzing → strategy_ready → generating → awaiting_approval → approved → executing → live → paused → completed | cancelled
- **4 fases de entrada:** strategy, content, launch, creative-intent
- **Nunca** fazer `db.update(campaignsTable).set({status})` direto — sempre via `transitionCampaign()`

---

## Sistema de Agentes

> **Contratos:** `NEXOS_AGENT_CONTRACTS.md`
> **Agentes experimentais:** `agents/experimental/README.md`

- **70+ AgentRoles** no tipo `AgentRole`
- **AGENT_PROVIDER_MAP** mapeia cada role para provider + modelo
- **Execution path:** `runIsolatedAgent()` → `runAgent()` → `completeWithAgent()` → provider API
- **Audit trail:** toda execução registrada em `aiProviderLogsTable` + `agentExecutionLogsTable`
- **NEXOS_MASTER_EVOLUTION_PROMPT** injetado universalmente antes do system prompt específico

---

## Regras de Acoplamento

1. **Sem imports cruzados entre módulos** — comunicação via interfaces explícitas
2. **Side-effects de aprovação** centralizados em `content-post-approval.ts`
3. **State machine** centralizada em `campaign-state-machine.ts`
4. **Prompts** ficam no arquivo `.agent.ts` do próprio agente
5. **Lógica de negócio** em services, nunca em routes
6. **Routes** apenas: validação de input, auth check, chamada de service, resposta HTTP

---

## Checklist de Saúde do Sistema

```bash
# Typecheck completo
pnpm run typecheck

# Typecheck só libs (necessário após mudanças de schema)
pnpm run typecheck:libs && pnpm --filter @workspace/api-server run typecheck

# Seed de planos (necessário antes do primeiro registro de usuário)
cd lib/db && tsx src/seed-plans.ts

# Push de schema (dev only)
pnpm --filter @workspace/db run push
```

---

## Documentação de Suporte

| Documento | Conteúdo |
|-----------|----------|
| `NEXOS_STATE_MACHINE.md` | Diagrama, tabela de transições, labels, regras Level 3 |
| `NEXOS_AGENT_CONTRACTS.md` | Contratos de entrada/saída de todos os agentes ativos |
| `NEXOS_WORKFLOW_MAP.md` | Fluxos completos com gates, timers e riscos |
| `NEXOS_GUARDRAILS.md` | Regras obrigatórias, checklist de PR |
| `replit.md` | README do projeto, stack, gotchas, preferências do usuário |
