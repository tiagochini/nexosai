---
name: Race condition — strategy pipeline sobrescreve status do content pipeline
description: Bug onde command.agent.ts finalizava com finalStatus hardcoded "strategy_ready" depois que o content pipeline já havia avançado para "generating", causando regressão silenciosa de estado.
---

## A Regra

Quando a strategy pipeline termina, ela NÃO pode sobrescrever o status atual se a campanha já avançou para `generating` ou além. O `finalStatus = "strategy_ready"` em `command.agent.ts` é um hardcode que precisa de um read-before-write.

**Why:** O usuário pode clicar "Aprovar e Gerar Conteúdo" enquanto a strategy pipeline ainda está processando seus últimos agentes (ex: `launch_manager` em `waiting_approval`, `business_intelligence` completando). Quando isso ocorre, o content pipeline avança o status para `generating`, mas a strategy pipeline termina depois e sobrescreve de volta para `strategy_ready` — regressão silenciosa. As peças de conteúdo existem no banco mas o UI mostra "Estratégia Pronta" como se a geração nunca tivesse acontecido.

**How to apply:** O fix está em `command.agent.ts` (pré-check lê live status antes de chamar transitionCampaign) e em `campaigns.service.ts` (detector de regressão loga WARN + persiste audit event `campaign.status.regression_detected`).

## Arquitetura do Fix (3 camadas)

### 1. `campaign-state-machine.ts` — `CAMPAIGN_STATUS_RANK` + `isRegressionTransition()`
- Rank canônico: intake=1, analyzing=2, strategy_ready=3, generating=4, awaiting_approval=5, approved=6, executing=7, live=8, completed=9
- Statuses unranked (paused, compliance_review, cancelled) = nunca classificados como regressão
- `isRegressionTransition(from, to)` — pura, sem DB

### 2. `campaigns.service.ts` → `transitionCampaign()` — DETECÇÃO (não bloqueia)
- Após self-transition no-op, antes de `isValidTransition`
- Se `isRegressionTransition(current, target)` → log.WARN + audit `campaign.status.regression_detected`
- A transição AINDA EXECUTA (para permitir regressions intencionais como `approved → generating`)
- O estado do evento tem `{from, to, reason, ts}`

### 3. `command.agent.ts` — BLOQUEIO explícito
- Antes de chamar `transitionCampaign(..., "strategy_ready")`
- Lê o status atual da campanha no DB
- Compara `CAMPAIGN_STATUS_RANK[live] > CAMPAIGN_STATUS_RANK["strategy_ready"]`
- Se verdadeiro: log.WARN + audit `campaign.orchestration.regression_blocked` + SKIP da chamada a transitionCampaign
- Se falso: chama transitionCampaign normalmente

## Distinção: Detecção vs Bloqueio

| Cenário | isRegressionTransition() | transitionCampaign() | command.agent.ts |
|---|---|---|---|
| generating → strategy_ready (BUG) | true | WARN + audit, executa | BLOQUEIA antes de chamar |
| approved → generating (re-gen intencional) | true | WARN + audit, executa | não chama com strategy_ready |
| strategy_ready → generating (normal) | false | silencioso | não relevante |

## Evento audit de regressão detectada

```json
{
  "action": "campaign.status.regression_detected",
  "actor": "system",
  "data": { "from": "generating", "to": "strategy_ready", "reason": "...", "ts": "..." }
}
```

## Evento audit de bloqueio (command.agent.ts)

```json
{
  "action": "campaign.orchestration.regression_blocked",
  "actor": "system",
  "data": {
    "liveStatus": "generating",
    "blockedTarget": "strategy_ready",
    "reason": "strategy pipeline completed after content pipeline was triggered",
    "agentsRun": [...],
    "checkpointsPending": [...]
  }
}
```

## Estado JL#4 após o fix

- Campanha `4e119c75` corrigida manualmente via SQL: `strategy_ready` → `awaiting_approval`
- 4 content_pieces preservadas: `email_sequence(pending_approval)`, `creative_direction(pending_approval)`, `targeting_config(budget_proposed)`, `media_buying_plan(budget_proposed)`
- Audit entry `campaign.status.manual_correction` escrita documentando a correção
