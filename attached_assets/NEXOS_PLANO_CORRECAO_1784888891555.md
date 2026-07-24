# NexOS AI — PLANO DE CORREÇÃO SEQUENCIADO
## Roteiro de execução para o Replit — da auditoria (21 Jul 2026) às 3 execuções limpas
### Ordem de ataque, dependências e critério de "PRONTO" (verificação externa) por item

> **REGRA MÃE:** um item de cada vez. Corrige → verifica na FONTE EXTERNA → só então o próximo.
> "Corrigido" NUNCA se baseia em log interno. Corrigido = evidência externa registrada.
> Atacar tudo junto = nada verificável. A ordem abaixo evita retrabalho (cada passo não quebra o anterior).
> Registrar cada conclusão em PROGRESS.md com a evidência.

---

## PASSO 0 — DESTRAVE EXTERNO (fazer HOJE, antes de tocar em código)
Estes não são bugs — são recursos externos faltando que causam metade dos sintomas de "qualidade ruim". Resolver primeiro porque muda o diagnóstico de vários bugs.

- [ ] **Recarregar créditos Anthropic + OpenAI** — o Bug #02 e a "secura" dos textos vêm em grande parte do fallback degradado por falta de crédito. Este é o maior impacto pelo menor esforço de toda a lista.
- [ ] **Configurar secrets de produção:** DATABASE_URL, SESSION_SECRET, JWT_SECRET, ALLOWED_ORIGINS
- [ ] **Configurar Resend** (API key + domínio verificado DKIM) — sem isso o Bug #08 é inevitável
- [ ] Confirmar que os secrets existem em PRODUÇÃO, não só em dev (causa raiz nº1 de "funciona em dev")

**PRONTO quando:** um agente de teste roda com o modelo principal (não fallback) E os secrets estão presentes em produção (verificado, não presumido).

---

## FASE A — OS QUE FEREM O CLIENTE (Prioridade 0 · não lançar sem isto)
Estes dois danificam a conta/lista/reputação do cliente. São os mais perigosos da lista inteira.

### A1 — Bug #04 · Social auto-post sem gate de confirmação
**Problema:** aprovar peça para revisão dispara post real nas redes imediatamente. Cliente posta sem querer.
**Correção:** `autoPostApprovedContent()` deixa de ser fire-and-forget. Aprovação de conteúdo (revisão) e publicação viram DOIS atos separados. Publicar exige gate explícito "Confirmar publicação nas redes?" com as redes/horários visíveis.
**Dependência:** nenhuma. Fazer primeiro.
**PRONTO quando:** aprovar uma peça NÃO gera post; o post só sai após o segundo clique de confirmação; verificado olhando a rede real (o post não existe até confirmar, existe depois). Evidência externa: estado da conta social antes/depois.

### A2 — Bug #05 · Dupla execução no scheduler
**Problema:** quando Redis volta, BullMQ + setInterval disparam juntos → mesmo email/WhatsApp enviado 2x para a lista.
**Correção:** fonte única de disparo. Quando BullMQ/Redis está ativo, o setInterval fallback DESLIGA (não coexiste). Toda ação de envio ganha chave de idempotência (campaignId+step+contactId) — o mesmo envio nunca sai duas vezes, mesmo se dois processos tentarem.
**Dependência:** conceito de idempotência aqui é o mesmo do Bug #07 — resolver junto reaproveita a fundação.
**PRONTO quando:** simular queda e retorno do Redis durante uma sequência NÃO gera envio duplicado; verificado na caixa de entrada real de um contato de teste (chega 1 email, não 2). Evidência externa: inbox de teste.

---

## FASE B — OS QUE ENTREGAM LIXO (Prioridade 0 · qualidade da entrega)

### B1 — Bug #02 · content_calendar volta vazio (calendar:[])
**Problema:** LLM trunca antes de completar 20+ posts → parse retorna default vazio.
**Correção:** geração em chunks (blocos de 7 dias, como o targeting agent já faz). Cada bloco validado antes de montar o calendário final. Nunca aceitar `calendar:[]` como resultado válido.
**Dependência:** Passo 0 (créditos) — parte do truncamento é fallback por falta de crédito. Fazer Passo 0 antes pode revelar que metade do bug já sumiu.
**PRONTO quando:** gerar calendário produz N dias preenchidos (N = pedido), zero blocos vazios, em 3 gerações seguidas. Evidência: o calendário renderizado com todos os dias.

### B2 — Bug #03 · Contract violations não bloqueiam a peça
**Problema:** `_contractViolation:true` é setado mas a peça avança pra aprovação. Entregável fora de contrato é usado em campanha real.
**Correção:** violação de contrato BLOQUEIA a peça (não vai pra pending_approval) e dispara reprocessamento automático. Só peça dentro do contrato chega ao cliente.
**Dependência:** depois de B1 (mesma área de geração/validação de conteúdo).
**PRONTO quando:** injetar uma peça fora de contrato → ela é bloqueada e reprocessada, nunca aparece pra aprovação. Evidência: a peça violadora não alcança a Central de Aprovação.

---

## FASE C — OS QUE FALHAM SILENCIOSAMENTE (Prioridade 1 · antes do 1º cliente pagar)
Estes são a doutrina em forma de bug: sistema diz "ok", nada aconteceu de verdade.

### C1 — Bug #06 · Credencial salva sem validação prévia
**Problema:** token inválido salvo como "connected" sem ping real. Lançamento chega na publicação e falha.
**Correção:** rota `POST /integrations/test` — toda credencial (manual ou OAuth) faz chamada real de validação ANTES de salvar. Status "connected" só após o ping passar. (= Adaptação #4, risco BAIXO, adição pura.)
**Dependência:** nenhuma técnica; conceitualmente casa com C2.
**PRONTO quando:** colar token inválido → sistema recusa e avisa; token válido → confirma com dado real da conta ("✓ encontrei @conta"). Evidência: a chamada de validação externa.

### C2 — Bug #08 · Graceful degradation tratada como sucesso
**Problema:** Resend sem key loga "skip", sequência roda "dispatched", zero emails entregues.
**Correção:** ausência de canal configurado = ERRO explícito ao usuário ANTES de iniciar, nunca "skip" silencioso. Status "dispatched" só com confirmação de envio real do provedor.
**Dependência:** Passo 0 (Resend configurado) + C1 (validação de credencial).
**PRONTO quando:** rodar sequência sem email configurado → bloqueio explicado, não "sucesso"; com email configurado → status reflete entrega real confirmada pelo provedor. Evidência: resposta do provedor + inbox de teste.

### C3 — Bug #07 · Idempotência de créditos em reinício
**Problema:** `skipAgent()` depende de pieceStatus setado antes do restart; créditos podem ser deduzidos 2x.
**Correção:** débito de crédito atrelado a ID estável da tarefa, aplicado UMA vez na conclusão bem-sucedida. Reinício verifica "esta tarefa já debitou?" antes de qualquer cobrança. Output já gerado é carregado, nunca regerado.
**Dependência:** compartilha a fundação de idempotência com A2 — resolver na mesma leva.
**PRONTO quando:** reiniciar a página no meio da produção → crédito debitado idêntico antes e depois; nenhum agente concluído redisparado. **Este estanca o vazamento de créditos que o cliente relatou.** Evidência: saldo de créditos antes/depois do restart.

---

## FASE D — O DIFERENCIAL DE PRODUTO (Prioridade 1 · elevado por decisão do fundador)

### D1 — Adaptação #1 · Gate de Validação (Mercado / Oferta / Marca) = Avaliação Mercadológica
**Por que aqui e não depois:** é a etapa que o Arsenal do Fundador exige (convicção lastreada) e a jornada define como coração. Sem ela, o NexOS executa lançamento de produto inviável com força total — o que a própria doutrina proíbe. Não é economia de crédito, é o que protege o cliente e diferencia o produto.
**Encaixe (conforme auditoria):** rodar os 3 validadores DENTRO da fase "analyzing", ANTES do command.agent — reusa checkpoint/awaiting_approval existente (evita a transição de estado nova, que é o risco ALTO apontado).
**O que construir:** agentes market_validator, offer_price_validator, brand_validator; campo em brainData (aprovado/ajustar/rejeitado); curto-circuito (1 rejeição crítica bloqueia); UI de review; veredito com ramificação (viável / ajustar / pivô para digital/curso).
**Dependência:** melhor com Passo 0 feito (validadores precisam do modelo bom, não fallback).
**PRONTO quando:** produto inviável recebe veredito de bloqueio com alternativas ANTES de consumir créditos de execução; produto viável passa; em ambos, o resultado persiste em brainData. Evidência: a campanha inviável não chega à fase de execução.

### D2 — Adaptação #3 · Motor de mídia paga (Meta Ads / Google Ads)
**Problema:** produto vende "gestão de mídia paga" que não executa via API de ads. Risco ALTO de promessa vs. entrega.
**Correção:** módulo meta-ads/ (Marketing API) + google-ads/; auto-bid/budget; retry com backoff; dead-letter queue. Refresh automático de token (senão falha silenciosa no meio da campanha).
**Dependência:** **App Review da Meta aprovado** (trilho externo do PATHWAY, rodando em paralelo desde já) + Token Lifecycle Manager. Construir em SANDBOX enquanto a aprovação corre.
**PRONTO quando:** campanha paga criada e ATIVA verificada no Ads Manager externo (sandbox primeiro, produção quando aprovado); token expira e renova sozinho sem quebrar campanha. Evidência: a campanha no painel de anúncios real.

---

## FASE E — POLIMENTO (Prioridade 2 · pós-lançamento imediato)

### E1 — Bug #09 · autoGenerateCreativesFromBrief sem gate
Confirmação antes de consumir créditos DALL-E ao aprovar media_brief.
**PRONTO:** aprovar brief não gera imagem até confirmar; crédito só após confirmação.

### E2 — Adaptação #6 · Navegação (back) em sub-estados sem saída
Corrigir os becos sem saída confirmados: video-production (AvatarCloneGate), sequences/detail (editor inline), campaigns/content (modal sem fechar), onboarding clone_wow (sem recomeçar), war-room, launcher, not-found (sem link pra dashboard).
**PRONTO:** cada tela listada tem saída óbvia sem perder trabalho; testar as 7 rotas.

---

## FASE F — REAVALIAÇÃO (Prioridade 4 · NÃO construir como está)

### F1 — Adaptação #5 · Nexos Bridge
**Decisão:** NÃO desenvolver como especificado. Dois analistas independentes (auditoria + revisão) convergiram: ToS de Meta/TikTok/Google proíbem automação de console; webview não distingue campo de senha; indistinguível de phishing.
**Substituição:** a Adaptação #4 (C1, onboarding com validação real + deep-link pro browser NATIVO do usuário, nunca iframe controlado) entrega o objetivo legítimo — guiar a conexão — sem os riscos. O "guia passo a passo" abre a página real da plataforma em aba externa; o NexOS só instrui e valida o resultado.
**Ação:** arquivar o conceito original; absorver a parte boa na Adaptação #4.

---

## O QUE RODA EM PARALELO (trilho externo, não bloqueia código)
Começar HOJE, corre sozinho enquanto o código é corrigido:
- [ ] App Review Meta (PATHWAY B0→B4) — fila longa, começar já
- [ ] Business Verification com ABN (sole trader aceito)
- [ ] Registrar callback OAuth (já definido: /api/integrations/oauth/callback/facebook)
- [ ] TikTok App Review (PATHWAY C)

---

## CRITÉRIO FINAL — O GABARITO
Depois de Fases A→C resolvidas (D1 fortemente recomendado antes do 1º pagante):
> A jornada intake → botão vermelho roda **3 vezes consecutivas**, 100% verificada na fonte externa, zero intervenção manual, zero erro visível ao Founder. Qualquer falha zera a contagem.

Placar em PROGRESS.md: "Execuções limpas consecutivas: N/3".
Isto resolve o Bug #10 (validação sem evidência externa) por construção — porque o critério É a evidência externa.

---

## RESUMO DA ORDEM (cola rápida)
0. Créditos + secrets de produção (HOJE)
1. A1 #04 social gate → A2 #05 dupla execução
2. B1 #02 calendário vazio → B2 #03 contract violations
3. C1 #06 validar credencial → C2 #08 degradation → C3 #07 idempotência créditos
4. D1 Avaliação Mercadológica → D2 mídia paga (sandbox; produção quando Meta aprovar)
5. E1 #09 gate DALL-E → E2 navegação
6. F1 Bridge: arquivar, absorver em C1
7. 3 execuções limpas = pronto
