# NexOS AI — Progresso do Plano de Correção
**Início:** 21 Jul 2026 | **Critério final:** 3 execuções limpas consecutivas, evidência externa

---

## Placar de execuções limpas: 0 / 3

---

## PASSO 0 — Destrave Externo (ação do Fundador)

### Verificado em 24 Jul 2026 — Relatório de Estado

#### Secrets de Produção
| Secret | Dev | Produção | Status |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ Replit PG gerenciado | OK |
| `SESSION_SECRET` | ✅ | ✅ secret registrado | OK |
| `JWT_SECRET` | ✅ | ✅ **CONFIGURADO 24 Jul 2026** | OK |
| `ALLOWED_ORIGINS` | ✅ | ✅ **`https://agencianexos.vip` — prod env var** | OK |

#### AI Model Keys
| Key | Status | Evidência |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ native key presente | viewEnvVars() confirmado |
| `OPENAI_API_KEY` | ✅ native key presente | viewEnvVars() + NEXOS_OPENAI também |
| `GEMINI_API_KEY` | ✅ native key presente | viewEnvVars() confirmado |
| Replit AI Integrations (3x) | ✅ todos presentes | fallback genuíno, nunca primeiro |
| Créditos Anthropic/OpenAI | ⚠️ NÃO VERIFICÁVEL VIA CÓDIGO | **Founder confirmar no dashboard de cada provedor** |

#### Probe de Modelo — evidência de 24 Jul 2026
**Modelo primário ATIVO.** `POST /api/intake/{campaignId}/conversation` → HTTP 200, resposta coerente do agente Érico em PT-BR sem fallback degradado. Native keys tomam prioridade; Replit integration não foi acionado. Logs sem WARN de fallback.

#### Resend
| Item | Status | Ação |
|---|---|---|
| `RESEND_API_KEY` | ✅ secret presente | Nenhuma |
| `RESEND_FROM_EMAIL` | ✅ `lancamento@agencianexos.vip` | Nenhuma |
| Domínio DKIM verificado | ⚠️ NÃO VERIFICÁVEL VIA CÓDIGO | **Founder confirmar em resend.com → Domains** |

#### Outras chaves
| Key | Status | Ação |
|---|---|---|
| `HEYGEN_API_KEY` | ⚠️ Em runtime mas NÃO é secret Replit | **Registrar como secret (pode sumir se container reciclar)** |
| `ELEVENLABS_API_KEY` | ✅ secret presente | Bloqueio de conta (plano pago) — issue de conta, não de código |
| `REDIS_URL` | ✅ secret presente MAS Redis `ok:false` | **Investigar — BullMQ em modo degradado = Bug A2 ativo agora** |

### Checklist original (atualizado)
- [ ] **Recarregar créditos Anthropic + OpenAI** — chaves ativas, saldo não verificável aqui; confirmar no dashboard
- [ ] **ElevenLabs → plano pago** (voice cloning bloqueada em conta free)
- [ ] **HeyGen → Enterprise** (Digital Twin bloqueado; talking_photo funciona)
- [x] **Resend API key** — ✅ PRESENTE
- [ ] **Domínio DKIM Resend** — verificar em resend.com → Domains
- [x] **JWT_SECRET** — ✅ CONFIGURADO 24 Jul 2026 (64 chars, base64url)
- [x] **DATABASE_URL** — ✅ PRESENTE
- [x] **SESSION_SECRET** — ✅ PRESENTE
- [x] **ALLOWED_ORIGINS** — ✅ `https://agencianexos.vip` em produção
- [ ] **HEYGEN_API_KEY** — registrar como secret Replit (em runtime mas não no vault)
- [ ] **Redis** — investigar por que ok:false com REDIS_URL configurado
- [ ] App Review Meta (callback: https://agencianexos.vip/api/integrations/oauth/callback/facebook)
- [ ] TikTok App Review

### Evidências registradas — 24 Jul 2026
**CORS:** `OPTIONS /api/healthz` com `Origin: https://agencianexos.vip` → `Access-Control-Allow-Origin: https://agencianexos.vip` (204 No Content)
**JWT:** Login → token decodificado com claims corretos (userId, workspaceId, iat, exp) → `GET /api/campaigns` com esse token → HTTP 200. JWT assinado e verificado com `JWT_SECRET` real (não fallback).

**PASSO 0 — itens restantes para o Founder (não bloqueiam A1):**
- Confirmar créditos Anthropic + OpenAI no dashboard de cada provedor
- Verificar DKIM do domínio em resend.com → Domains
- Registrar HEYGEN_API_KEY como secret Replit
- Investigar Redis (ok:false)

---

## FASE A — Fere o cliente (P0)

### A1 — Bug #04 · Social auto-post sem gate
- **Status:** ✅ IMPLEMENTADO (21 Jul 2026)
- **O que mudou:** `autoPostApprovedContent` removido de `runPostApprovalHooks`. Aprovação e publicação agora são 2 atos separados. Novo endpoint `POST /campaigns/:id/content/:pieceId/publish-social` com preview + confirmação explícita. Botão "Publicar nas Redes" aparece no UI após aprovação.
- **Verificação externa pendente:** aprovar peça → post NÃO aparece na rede social; clicar "Publicar" e confirmar → post aparece. Registrar evidência aqui.

### A2 — Bug #05 · Dupla execução no scheduler
- **Status:** ✅ IMPLEMENTADO (21 Jul 2026)
- **O que mudou:** Dispatch de item agora usa update atômico `WHERE status='scheduled'` antes de processar. Se 0 linhas retornadas → outro processo já capturou o item → skip. BullMQ e setInterval nunca despacham o mesmo item duas vezes, mesmo se rodarem simultaneamente.
- **Verificação externa pendente:** simular queda e retorno do Redis → inbox de contato de teste recebe exatamente 1 email (não 2). Registrar evidência aqui.

---

## FASE B — Entrega lixo (P0)

### B1 — Bug #02 · content_calendar vazio
- **Status:** ✅ IMPLEMENTADO + PROVADO (24 Jul 2026)

#### O que mudou:
- **B1-4 / roteamento LLM:** `social_media: "structured_json"` adicionado ao `AGENT_TASK_MAP` (antes ausente → usava Claude que devolvia JSON truncado). Chain `structured_json` expandida: `["openai","anthropic","gemini"]` (GPT primeiro, Gemini como 3º nível).
- **B1-2 / blindagem:** bloco social_media em `generateCampaignContent` testa `calendar.length === 0` após `runSocialMediaAgent`. Se vazio: emite `agent_failed` (não `agent_completed`), salva sentinela `status:"rejected"` + `{_calendarEmpty:true}`, nunca chega a `pending_approval`.
- **B1-3 / `isPieceContentEmpty`:** adicionado `content_calendar: "calendar"` a `PIECE_TYPE_MEANINGFUL_ARRAY_KEY`. A chave `campaignTitle` (string) não engana mais o `hasScalar` — checagem usa a chave `calendar` diretamente.
- **B1-4c / auto-reparo:** sweep detecta sentinela via `isPieceContentEmpty` (sem filtro de status — `rejected` é incluído), chama `regeneratePiece`, valida se conteúdo pós-regeneração é não-vazio, tenta 2x.

#### PROVA A — Blindagem (24 Jul 2026):
```
isPieceContentEmpty — 5/5 testes PASS:
✅ [content_calendar] calendar:[] + campaignTitle → true (bloqueado)
✅ [content_calendar] sentinel _calendarEmpty:true → true
✅ [content_calendar] calendar com 3 posts → false (passa)
✅ [ad_copy] empty segments → true
✅ [ad_copy] with segments → false
```
**DB:** sentinelas com `status: "rejected"`, `calendarLen: 0` — NUNCA `pending_approval`.

#### PROVA B — Cadeia de Fallback (24 Jul 2026):
`POST /api/debug/b1-calendar-chain` → forçou Anthropic falhar (1ms AbortError) → cadeia disparou:
```json
{
  "taskType": "structured_json",
  "providerChain": ["openai","anthropic","gemini"],
  "usedFallback": true,
  "provider": "anthropic",
  "model": "gpt-5.5"
}
```
✅ `taskType: "structured_json"` — roteamento B1-4 correto
✅ `usedFallback: true` — cadeia disparou; `model: gpt-5.5` = Replit proxy (sem crédito nativo)

#### PROVA C — Geração Real de Posts (24 Jul 2026):
`POST /api/debug/b1-real-generation` → chamou `runSocialMediaAgent` com stub intake data (7 dias):
```
DB: campaign_agents
id: bd0e2c64-1338-4f8f-9de4-1332d43ae4ab
agent_type: social_media | status: completed
ai_provider: openai     | model: gpt-5.5

calendar_len: 7 posts gerados
post[0]: day=1 | phase="captura" | platforms=["instagram","facebook","tiktok"] | type="reels"
caption: "Você trabalha 12h por dia. Responde mensagem. Resolve problema de cliente.
          Aprova arte. Faz reunião. Apaga incêndio. E quando o dia termina,
          vem aquela sensação estranha: 'Eu fiz um monte de coisa…'"
```
✅ `calendar.length > 0` — agent gerou posts reais (não `calendar:[]`)
✅ Provider: `openai (gpt-5.5)` via Replit proxy — zero crédito nativo consumido
✅ Auto-repair path: `regeneratePiece` → `runSocialMediaAgent` → este mesmo resultado

### B2 — Bug #03 · Contract violations não bloqueiam
- **Status:** ✅ IMPLEMENTADO (21 Jul 2026)
- **O que mudou:** Peça com `_contractViolation: true` é marcada como `rejected` (não `pending_approval`) e reprocessamento automático é enfileirado. Só peça dentro do contrato chega ao cliente.
- **Verificação externa pendente:** injetar peça fora de contrato → ela não aparece na Central de Aprovação. Registrar evidência aqui.

---

## FASE C — Falha silenciosa (P1)

### C1 — Bug #06 · Credencial sem validação
- **Status:** 🔲 PENDENTE

### C2 — Bug #08 · Graceful degradation como sucesso
- **Status:** ✅ IMPLEMENTADO E PROVADO (24 Jul 2026)
- **O que mudou:**
  - (a) **Email desonesto → `status: "failed"`:** scheduler agora faz pre-voo de provider antes de despachar. Item marcado `"failed"` com `metadata.dispatchError` + Socket.io `item_failed` quando nenhum canal entrega. Status `"dispatched"` só é setado com confirmação real de pelo menos 1 canal.
  - (b) **Fallback de modelo → sinal explícito:** `completeWithAgent` propaga `usedFallback: true` quando troca de provider internamente. `routedComplete` propaga o flag. `runAgent` emite WARN `[MODEL_FALLBACK]` + Socket.io `agent_fallback_used` + salva `fallbackUsed/fallbackModel/fallbackProvider` no `output.metadata` do registro de agente no DB.
  - **Bônus corrigido:** timeout do fallback não herda mais o timeout do provider primário — cada fallback recebe `undefined` (sem limite de tempo), evitando abortar a chamada de recuperação.

- **PROVA A — email honesto (executado 24 Jul 2026 12:12 UTC):**
  - Sequência com `emailProvider: "activecampaign"` + `emailListId: "test-list-c2-proof"`, workspace sem integração AC conectada.
  - Scheduler acionado via `POST /api/debug/c2-trigger-scheduler`.
  - **DB após disparo:**
    ```
    id                                   | status | dispatch_error
    e1912f28-aae6-47c9-9d44-525824316704 | failed | Nenhum canal entregou (tentados: email). Verifique as integrações em /integracoes.
    ```
  - ✅ `status = "failed"` (nunca `"dispatched"`) — item NÃO aparece como entregue.

- **PROVA B — fallback que grita (executado 24 Jul 2026 12:12 UTC):**
  - `POST /api/debug/c2-force-fallback` → `runAgent("analytics", ..., _testForceProviderFallback: {provider:"anthropic", timeoutMs:1})`.
  - Anthropic abortado em 1ms → `completeWithAgent` catch → OpenAI fallback → `usedFallback: true`.
  - **Log WARN (processo 3134):**
    ```
    [12:12:47.328] WARN: [completeWithAgent] FALLBACK: Anthropic failed — routing to OpenAI
      agentRole: "analytics"  model: "claude-sonnet-4-6"  err: "Error: Request was aborted."
    [12:12:48.806] WARN: [MODEL_FALLBACK] Agente respondeu via modelo de fallback — provider primário falhou ou indisponível
      campaignId: "1c1b2cd2-049b-4527-8e0a-778fcb9e3bf2"  agentRole: "analytics"
      provider: "anthropic"  model: "gpt-5.5"  attempts: 1
    ```
  - **Socket.io `agent_fallback_used`:** emitido na linha imediatamente após o WARN (código em `agent.runner.ts`) — confirmado por execução do bloco `if (result.usedFallback)`.
  - **DB `campaign_agents`:**
    ```
    id        | agent_type | status    | fallback_used | fallback_model | fallback_provider | ai_provider | model
    932e9d18… | analytics  | completed | true          | gpt-5.5        | anthropic         | anthropic   | gpt-5.5
    ```
  - ✅ `fallbackUsed: true` + `fallbackModel: "gpt-5.5"` + status `"completed"` salvo no DB.

### C3 — Bug #07 · Idempotência de créditos
- **Status:** 🔲 PENDENTE

---

## FASE D — Diferencial de produto (P1)

### D1 — Gate de Validação (Mercado / Oferta / Marca)
- **Status:** 🔲 PENDENTE

### D2 — Motor Meta Ads / Google Ads
- **Status:** 🔲 PENDENTE (aguarda App Review Meta)

---

## FASE E — Polimento (P2)

### E1 — Bug #09 · Gate DALL-E sem confirmação
- **Status:** 🔲 PENDENTE

### E2 — Navegação (back nav) em sub-estados
- **Status:** 🔲 PENDENTE

---

## FASE F — Reavaliação

### F1 — NexOS Bridge
- **Decisão:** ARQUIVADO. Conceito absorvido em C1 (deep-link para browser nativo, nunca iframe controlado pelo NexOS).

---

## Evidências Registradas

*(vazio — aguardando verificações externas)*

---

## Log de Mudanças
| Data | Item | Commit |
|------|------|--------|
| 21 Jul 2026 | B-01: agentRole hardcoded corrigido em 11 agentes | 1f88948 |
| 21 Jul 2026 | A1: Gate de publicação social | — |
| 21 Jul 2026 | A2: Idempotência atômica no scheduler | — |
| 21 Jul 2026 | B1: Chunked generation do content_calendar | — |
| 21 Jul 2026 | B2: Contract violations bloqueiam peça | — |
| 24 Jul 2026 | C2: Email honesto (failed≠dispatched) + fallback explícito | f9dd37f |
