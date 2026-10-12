# NEXOS AI — Campaign State Machine

**Fonte de verdade:** `artifacts/api-server/src/modules/campaigns/campaign-state-machine.ts`
**Enforcement:** Level 3 (ativo) — `transitionCampaign()` lança `ValidationError` em transições inválidas.

---

## Diagrama de Estados

```
                        ┌──────────────────────────────────────────────────────┐
                        │                   PIPELINE KERNEL                    │
                        └──────────────────────────────────────────────────────┘

  [intake] ──► [analyzing] ──► [strategy_ready] ──► [generating] ──► [awaiting_approval]
     ▲              │                  │                   │                  │
     │            intake           approved*            strategy_ready      generating
     │              │                  │                   │                  │
     └──────────────┘              cancelled           cancelled           analyzing
                                                                              │
                                                                          [approved]
                                                                              │
                                                                          [executing]
                                                                         /    │
                                                                      live   paused
                                                                       │       │
                                                                  completed  executing
                                                                       │       │
                                                                  [completed] [cancelled]
```

`*` approved: auto-progressão de pipeline (campanha anterior entra em executing → próxima vai para approved)

---

## Tabela de Transições

| De → Para | Gatilho | Quem Aciona | Gate Humano? |
|-----------|---------|-------------|--------------|
| `intake` → `analyzing` | `POST /execute {phase: "strategy"}` | Usuário | ✅ Requer clique consciente |
| `analyzing` → `strategy_ready` | Agente de estratégia concluído | `command.agent` | ❌ Automático |
| `analyzing` → `awaiting_approval` | Checkpoints pendentes criados | `command.agent` | ✅ Checkpoints requerem aprovação |
| `analyzing` → `generating` | Sem checkpoints + conteúdo iniciado | `command.agent` | ❌ Automático |
| `strategy_ready` → `generating` | `POST /execute {phase: "content"}` | Usuário | ✅ Requer clique consciente |
| `strategy_ready` → `approved` | Pipeline auto-progressão | `triggerPipelineCapture` | ❌ Automático (sistema) |
| `generating` → `awaiting_approval` | Conteúdo gerado com checkpoints | `orchestration.worker` | ✅ Aprovação de conteúdo |
| `awaiting_approval` → `approved` | Todos checkpoints aprovados | `agents.routes` | ✅ Aprovação explícita |
| `approved` → `executing` | `POST /execute {phase: "launch"}` | Usuário | ✅ Requer clique + verificação de integrações |
| `executing` → `live` | Sequências ativadas, launch iniciado | `orchestration.worker` | ❌ Automático |
| `live` → `paused` | Pausa manual | Usuário | ✅ Ação manual |
| `live` → `completed` | `POST /execute {phase: "complete"}` | Usuário/Sistema | ✅ |
| `live` → `generating` | Re-geração de conteúdo mid-launch | Usuário | ✅ |
| `paused` → `executing` | Retomada | `orchestration.worker` | ❌ Automático após resume |
| `* → cancelled` | Cancelamento | Usuário | ✅ Ação destrutiva |

---

## Fases de Entrada

```typescript
// Importar sempre de campaign-state-machine.ts — nunca redeclarar inline
STRATEGY_PHASE_ENTRY_STATUSES  = ["intake", "analyzing", "strategy_ready"]
CONTENT_PHASE_ENTRY_STATUSES   = ["strategy_ready", "awaiting_approval", "approved", "live"]
LAUNCH_PHASE_ENTRY_STATUSES    = ["approved", "paused"]
CREATIVE_INTENT_PHASE_ENTRY_STATUSES = ["strategy_ready", "generating", "awaiting_approval", "approved"]
```

---

## Labels

| Status | Label PT-BR | Fase |
|--------|-------------|------|
| `intake` | Briefing | FASE 1 — BRIEFING |
| `analyzing` | Analisando | FASE 2 — ESTRATÉGIA |
| `strategy_ready` | Estratégia Pronta | FASE 2 — ESTRATÉGIA PRONTA |
| `generating` | Gerando Conteúdo | FASE 3 — CONTEÚDO |
| `awaiting_approval` | Aguardando Aprovação | FASE 3 — APROVAÇÃO PENDENTE |
| `approved` | Aprovado | FASE 4 — PRONTO PARA LANÇAR |
| `executing` | Executando | FASE 4 — LANÇANDO |
| `live` | Ao Vivo | FASE 5 — AO VIVO |
| `paused` | Pausado | FASE 5 — PAUSADO |
| `completed` | Concluído | FASE 6 — CONCLUÍDO |
| `cancelled` | Cancelado | CANCELADO |

---

## Regras de Governança (Level 3 — ATIVO)

1. **Toda transição passa por `transitionCampaign()`** — nunca atualizar `status` diretamente via `db.update(campaignsTable).set({status})`
2. **Transição inválida = `ValidationError` lançado** — não aviso, não silêncio
3. **Todas as constantes importadas de `campaign-state-machine.ts`** — nunca redeclarar inline em workers, routes ou agents
4. **`updateCampaignStatus()` = API layer** (strict, side-effects, throws) | **`transitionCampaign()` = engine layer** (internal, com observabilidade extra)
5. **Estados terminais (`completed`, `cancelled`)** têm array de transições vazio — qualquer tentativa de transição é rejeitada

---

## Como Adicionar um Novo Estado ou Aresta

1. Editar **apenas** `campaign-state-machine.ts` — adicionar ao `VALID_STATUS_TRANSITIONS`
2. Adicionar label em `STATUS_LABELS` e `STATUS_PHASE_LABELS`
3. Atualizar este documento
4. Verificar se alguma `PHASE_ENTRY_STATUSES` precisa ser expandida
5. Rodar typecheck: `pnpm run typecheck`
