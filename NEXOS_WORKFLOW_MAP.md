# NEXOS AI — Workflow Map

Mapa completo de todos os fluxos automáticos, seus gatilhos, gates e riscos.

---

## 1. Pipeline de Campanha (fluxo principal)

```
Usuário cria campanha
        │
        ▼
   [intake] ──── POST /execute {phase:"strategy"} ────► [analyzing]
                     Gate: clique consciente                    │
                                                      command.agent executa
                                                      strategy + profile + offer
                                                                │
                                        ┌───────────────────────┴───────────────────────┐
                                        │ checkpoints pendentes?                         │
                                       YES                                               NO
                                        │                                                │
                                 [awaiting_approval]                              [strategy_ready]
                                        │                                                │
                             Usuário aprova checkpoints              POST /execute {phase:"content"}
                                        │                                Gate: clique consciente
                                        ▼                                                │
                                  [approved]                                      [generating]
                                        │                                                │
                                        │                               orchestration.worker gera
                                        │                               conteúdo com agentes
                                        │                                                │
                                        │                                        [awaiting_approval]
                                        │                                                │
                                        └──────────────────────────────────────► [approved]
                                                                                         │
                                                              POST /execute {phase:"launch"}
                                                              Gate: clique + integrações obrigatórias
                                                                                         │
                                                                                  [executing]
                                                                                         │
                                                                              sequências auto-ativadas
                                                                                         │
                                                                                      [live]
                                                                                         │
                                                                POST /execute {phase:"complete"}
                                                                                         │
                                                                                  [completed]
```

---

## 2. Fluxo de Criativos (DALL-E 3)

```
Aprovação de Media Brief
        │
        ▼
autoGenerateCreativesFromBrief() [fire-and-forget, setImmediate]
        │
        ▼
campaignCreativesTable: status = "concept_ready"
        │
        ▼
Usuário acessa /campaigns/:id/creatives
        │
        ▼
Aprova conceito visual ── POST /creatives/:id/approve-concept
        │                        Gate: clique explícito ✅
        ▼
DALL-E 3 gera preview (standard quality)
        │
        ▼
status = "preview_ready"
        │
        ▼
Usuário aprova preview ── POST /creatives/:id/approve-preview
        │                       Gate: clique explícito ✅
        ▼
DALL-E 3 gera versão final HD
        │
        ▼
status = "approved", finalUrl preenchido
        │
        ▼
Social autopost usa finalUrl como mídia
```

**Riscos:**
- ⚠️ `autoGenerateCreativesFromBrief` dispara sem gate após media_brief approval
- Recomendação Fase 3: adicionar modal de confirmação antes de iniciar geração

---

## 3. Fluxo de Sequência de Lançamento (Scheduler)

```
POST /launch-sequences/:id/activate
        Gate: clique explícito ✅
        │
        ▼
Items: status = "scheduled", scheduledAt calculado (startAt + dayIndex)
        │
        ▼
sequence-scheduler.worker (60s tick via BullMQ + setInterval fallback)
        │
        ▼
status = "scheduled" AND scheduledAt <= now AND sequence.status = "active"
        │
        ▼
Dispatcher: Email (RD Station/ActiveCampaign/Resend) + WhatsApp (Meta API)
        │
        ▼
Item status = "dispatched"
        │
        ▼
Webhooks de engajamento (open/click/unsubscribe)
        │
        ▼
Contact score atualizado (hot/warm/cold)
        │
        ▼
sequenceContactsTable: engagementScore, segment, preferredSendHour
```

**Riscos:**
- ⚠️ Dupla execução possível: quando Redis volta online após setInterval fallback (BullMQ + interval simultâneos)
- ⚠️ Sem dry-run preview antes de ativar — mensagens vão imediatamente

---

## 4. Fluxo Social Auto-Post

```
POST /campaigns/:id/content/:id/approve
        Gate: clique explícito ✅
        │
        ├── Hook 1: processContentPieceApproval() → memory.service [fire-and-forget]
        ├── Hook 2: autoPostApprovedContent() → social.autopost.service [fire-and-forget]
        │                                                                     │
        │                                              ┌────────────────────────────────────┐
        │                                              │ extractMediaUrls (3-tier)           │
        │                                              │ 1. content JSONB                    │
        │                                              │ 2. mediaBriefsTable                 │
        │                                              │ 3. campaignCreativesTable.finalUrl   │
        │                                              └────────────────────────────────────┘
        │                                                           │
        │                                          publishToInstagram / publishToFacebook / publishToTikTok
        ├── Hook 3: autoGenerateCreativesFromBrief() [condicional: só se media_brief]
        └── Hook 4: runStrategicAlignmentEngine() → contradiction detector [setImmediate]
```

**Risco:**
- ❌ Sem gate de confirmação antes de postar nas redes sociais — disparo imediato após aprovação

---

## 5. Fluxo WhatsApp AI Auto-Response

```
POST /whatsapp/webhook (Meta API inbound)
        │
        ▼
runWhatsAppResponseAgent() [setImmediate, fire-and-forget]
        │
        ▼
classifyIntent() → compra / dúvida / suporte / saudação / spam
        │
        ├── requiresHuman = false → gera resposta via AI → envia via Meta API
        └── requiresHuman = true  → emite Socket.io alert para o lançador ⚠️
                                         (aguarda intervenção humana)
```

---

## 6. Weekly Report Scheduler

```
sequence-scheduler.worker — tick a cada 60s
        │
        ▼
maybeFireWeeklyReport() — verifica se é segunda-feira 08:00 UTC
        │
        ▼ (idempotente — keyed por date string)
sendWeeklyReportsToAll() → weekly-report.service
        │
        ▼
Email com métricas: revenue, sales, campaigns, credits, health score, AI insight
(SMTP não configurado = log preview apenas)
```

---

## 7. Timers Ativos no Sistema

| Timer | Intervalo | Arquivo | Risco |
|-------|-----------|---------|-------|
| Sequence scheduler | 60s | sequence-scheduler.worker.ts | Dupla execução com BullMQ |
| Social post scheduler | 60s | social.worker.ts | Timer duplicado no restart |
| Social metrics sync | 6h | social.worker.ts | Timer duplicado no restart |
| BullMQ repeatable job | 60s | sequence-scheduler.worker.ts | Pode coexistir com setInterval |
