# NEXOS AI — Agent Contracts

Contratos de entrada/saída de todos os agentes ativos na pipeline automatizada.
Para agentes experimentais (sem integração na pipeline), ver `agents/experimental/README.md`.

---

## Como ler este documento

```
Agente: nome do agente
Role: AgentRole usado no AGENT_PROVIDER_MAP
Provider: anthropic | openai | gemini
Entrada: campos obrigatórios que o caller deve fornecer
Saída JSON: campos garantidos quando ok=true
Acionado por: qual módulo/evento dispara este agente
```

---

## Agentes de Pipeline Principal

### strategy
- **Role:** `strategy`
- **Provider:** Anthropic (claude)
- **Entrada:** `{ intakeData, track, profile?, campaignType }`
- **Saída JSON:** `{ launchPlan, phases[], targetAudience, mainOffer, revenueGoal, keyMechanics[] }`
- **Acionado por:** `orchestration.worker` → `runStrategyAgent()`

### profile_builder
- **Role:** `profile_builder` (via agent.runner)
- **Provider:** Anthropic
- **Entrada:** `{ intakeData, campaignType }`
- **Saída JSON:** `{ avatarName, painPoints[], desiredOutcome, sophisticationLevel, buyerPersona }`
- **Acionado por:** `orchestration.worker` → `runProfileBuilderAgent()`

### offer
- **Role:** `offer`
- **Provider:** OpenAI (gpt)
- **Entrada:** `{ intakeData, profile, strategy }`
- **Saída JSON:** `{ offerTitle, mainPromise, bonuses[], price, guarantee, scarcityMechanism }`
- **Acionado por:** `command.agent` → fase de estratégia

### copywriter
- **Role:** `copywriter`
- **Provider:** OpenAI (gpt)
- **Entrada:** `{ campaignContext, contentType, targetPlatform, avatar }`
- **Saída JSON:** `{ headline, subheadline, body, cta, hooks[], emotionalAngle }`
- **Acionado por:** `orchestration.worker` → fase de conteúdo

### media_brief
- **Role:** `media_brief`
- **Provider:** OpenAI (gpt)
- **Entrada:** `{ campaignContext, creativeGoal, platform }`
- **Saída JSON:** `{ briefTitle, visualConcept, colorPalette, typography, mood, imageSuggestions[] }`
- **Acionado por:** `orchestration.worker` → fase de conteúdo

### creative_director
- **Role:** `creative_director`
- **Provider:** OpenAI (gpt)
- **Entrada:** `{ mediaBrief, platform, format }`
- **Saída JSON:** `{ conceptTitle, conceptDescription, visualElements[], colorPalette{}, callToAction, targetEmotion }`
- **Acionado por:** `creatives.service` → geração de conceito DALL-E

### landing_page
- **Role:** `landing_page`
- **Provider:** OpenAI (gpt)
- **Entrada:** `{ offer, avatar, strategy, track }`
- **Saída JSON:** `{ structure{ hero, aboveFold, sections[], urgencyMechanisms[], ctas[] }, seoTitle, metaDescription }`
- **Acionado por:** `orchestration.worker` → fase de conteúdo

### vsl_script
- **Role:** `vsl_script`
- **Provider:** Anthropic
- **Entrada:** `{ offer, avatar, strategy, duration? }`
- **Saída JSON:** `{ hook, problem, agitation, solution, proof, offer, urgency, cta, fullScript }`
- **Acionado por:** `orchestration.worker` → fase de conteúdo

### optimization
- **Role:** `optimization`
- **Provider:** Gemini
- **Entrada:** `{ metrics, healthScore, campaignContext }`
- **Saída JSON:** `{ recommendations[], priorityActions[], forecastedImpact, alertLevel }`
- **Acionado por:** `metrics.service` → quando healthScore ≤ 30

### command
- **Role:** `command`
- **Provider:** Anthropic
- **Entrada:** orquestra múltiplos agentes — não tem contrato único de saída JSON
- **Função:** Orquestrador da fase de estratégia — chama strategy, profile, offer, compliance
- **Acionado por:** `orchestration.worker` → `runStrategyAgent()`

---

## Agentes de Sequência / Automação

### item_copy
- **Role:** `item_copy`
- **Provider:** OpenAI (gpt)
- **Entrada:** `{ sequenceItem, contactSegment, campaignContext }`
- **Saída JSON:** `{ subject, previewText, body, ctaText, ctaUrl, segment }`
- **Acionado por:** `POST /launch-sequences/:id/items/:itemId/generate-copy`

### launch_sequence_builder
- **Role:** `launch_sequence_builder`
- **Provider:** Anthropic
- **Entrada:** `{ campaignContext, model, track, totalDays }`
- **Saída JSON:** `{ phases[], items[], milestones[], summary }`
- **Acionado por:** `POST /launch-sequences/:id/generate-plan`

### whatsapp_response
- **Role:** `whatsapp_response`
- **Provider:** Anthropic
- **Entrada:** `{ incomingMessage, conversationHistory, campaignContext }`
- **Saída JSON:** `{ intent, response, requiresHuman, confidence }`
- **Acionado por:** `whatsapp.routes` → webhook de mensagem recebida

---

## Agentes de Vendas (Time de Atendimento)

### sales_warmer / sales_desire / sales_closer / sales_objection / sales_consultant
- **Provider:** Anthropic (todos)
- **Entrada:** `{ conversationHistory, funnelStage, contactName, campaignContext }`
- **Saída:** texto de sugestão de resposta (não JSON estruturado)
- **Acionado por:** `POST /sales-team/:id/suggest`

---

## Agentes de Mentalidade (Fase 0 — stubs implementados)

### mental_frequency_coach
- **Role:** `mental_frequency_coach`
- **Provider:** Anthropic
- **Entrada:** `{ currentChallenge, emotionalState?, campaignPhase? }`
- **Saída:** texto estruturado: diagnóstico + quebra de padrão + ação imediata + perspectiva
- **Arquivo:** `agents/mental-frequency-coach.agent.ts`

### identity_architect
- **Role:** `identity_architect`
- **Provider:** Anthropic
- **Entrada:** `{ intakeData, existingPositioning?, competitorContext? }`
- **Saída JSON:** `{ identidadeEspecialista{}, identidadeProduto{}, recomendacoes[] }`
- **Arquivo:** `agents/identity-architect.agent.ts`

### obstinacy_trainer
- **Role:** `obstinacy_trainer`
- **Provider:** Anthropic
- **Entrada:** `{ currentObstacle, launchPhase, daysSinceStart?, resultsToDate? }`
- **Saída:** texto estruturado: diagnóstico + linha de corte + próximo experimento + accountability
- **Arquivo:** `agents/obstinacy-trainer.agent.ts`

---

## Nota: Agent Isolation Sandbox

Para execuções críticas que requerem contrato de saída garantido, use:

```typescript
import { runIsolatedAgent } from "../agents/agent-isolation-sandbox.js";

const result = await runIsolatedAgent<MyOutput>(
  { ...agentInput, contract: { requiredOutputFields: ["field1", "field2"] } },
  fallbackValue,
);

if (!result.ok) {
  log.warn({ error: result.error, errorCode: result.errorCode }, "agent failed");
  return; // nunca lança exceção
}

// result.data é garantidamente tipado e contém os campos obrigatórios
```
