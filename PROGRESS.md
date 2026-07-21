# NexOS AI — Progresso do Plano de Correção
**Início:** 21 Jul 2026 | **Critério final:** 3 execuções limpas consecutivas, evidência externa

---

## Placar de execuções limpas: 0 / 3

---

## PASSO 0 — Destrave Externo (ação do Fundador)
- [ ] Recarregar créditos Anthropic
- [ ] Recarregar créditos OpenAI
- [ ] ElevenLabs → plano pago (voice cloning)
- [ ] HeyGen → Enterprise (Digital Twin avatar)
- [ ] Configurar Resend (API key + domínio DKIM verificado)
- [ ] Confirmar secrets em produção: DATABASE_URL, SESSION_SECRET, JWT_SECRET, ALLOWED_ORIGINS
- [ ] App Review Meta (callback: https://agencianexos.vip/api/integrations/oauth/callback/facebook)
- [ ] TikTok App Review

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
