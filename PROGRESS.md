# NexOS AI — Progresso do Plano de Correção
**Início:** 21 Jul 2026 | **Critério final:** 3 execuções limpas consecutivas, evidência externa

---

## Placar de execuções limpas: 0 / 3

---

## PASSO 0 — Destrave Externo (ação do Fundador)

### Verificado em 24 Jul 2026 — Relatório de Estado

#### Secrets de Produção
| Secret | Dev | Produção | Ação necessária |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ Replit PG gerenciado | Nenhuma |
| `SESSION_SECRET` | ✅ | ✅ secret registrado | Nenhuma |
| `JWT_SECRET` | ⚠️ | ❌ AUSENTE — usa SESSION_SECRET como fallback | **Criar secret JWT_SECRET (≥32 chars aleatórios)** |
| `ALLOWED_ORIGINS` | ❌ | ❌ NÃO CONFIGURADO | **🔴 CRÍTICO — CORS quebra prod. Configurar `https://agencianexos.vip`** |

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
- [ ] **JWT_SECRET** — criar como secret dedicado
- [x] **DATABASE_URL** — ✅ PRESENTE
- [x] **SESSION_SECRET** — ✅ PRESENTE
- [ ] **ALLOWED_ORIGINS** — 🔴 CRÍTICO, configurar em produção
- [ ] **HEYGEN_API_KEY** — registrar como secret Replit
- [ ] **Redis** — investigar por que ok:false com REDIS_URL configurado
- [ ] App Review Meta (callback: https://agencianexos.vip/api/integrations/oauth/callback/facebook)
- [ ] TikTok App Review

**PASSO 0 PRONTO QUANDO:** Founder confirma créditos OK + ALLOWED_ORIGINS + DKIM + Redis → então A1.

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
- **Status:** ✅ IMPLEMENTADO (21 Jul 2026)
- **O que mudou:** Geração do calendário social em chunks de 7 dias (3 blocos de 7 = 21 dias). Cada chunk validado individualmente. `calendar:[]` nunca mais aceito como resultado válido — dispara retry automático por chunk.
- **Verificação externa pendente:** gerar calendário → 21 dias preenchidos nas próximas 3 gerações. Registrar evidência aqui.

### B2 — Bug #03 · Contract violations não bloqueiam
- **Status:** ✅ IMPLEMENTADO (21 Jul 2026)
- **O que mudou:** Peça com `_contractViolation: true` é marcada como `rejected` (não `pending_approval`) e reprocessamento automático é enfileirado. Só peça dentro do contrato chega ao cliente.
- **Verificação externa pendente:** injetar peça fora de contrato → ela não aparece na Central de Aprovação. Registrar evidência aqui.

---

## FASE C — Falha silenciosa (P1)

### C1 — Bug #06 · Credencial sem validação
- **Status:** 🔲 PENDENTE

### C2 — Bug #08 · Graceful degradation como sucesso
- **Status:** 🔲 PENDENTE

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
