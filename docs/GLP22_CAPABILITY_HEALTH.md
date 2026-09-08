# Método GLP22 — Matriz Interna de Saúde e Certificação de Capacidades

**Natureza:** verdade operacional interna; não é copy de landing nem declaração
comercial.  
**Versão:** 0.1  
**Base canônica:** `docs/ETAPA_0_CONGELAMENTO_CONCEITUAL.md` (v0.2) e o
inventário técnico da Etapa 1.  
**Auditoria conservadora atual:** 20 capacidades **PARTIAL**, 2 **BLOCKED**,
0 **HEALTHY**.

## Regra de nome e escopo

**Método GLP22** é o nome proprietário público e interno adotado para o
protocolo. “Global Launch Protocol (GLP)” é a denominação histórica/conceitual
anterior e pode aparecer em evidências e documentos legados com esse sentido.
Esta matriz usa os **exatos 22 domínios canônicos** da Etapa 0. Eles são
capacidades operacionais interdependentes — não são 22 agentes e não são etapas
do roadmap de construção.

## Classes e regra estrita de certificação

- **PARTIAL:** há fundação implementada, mas falta ao menos uma condição de
  escopo, executor, evidência, isolamento, recuperação ou vínculo soberano.
- **BLOCKED:** uma condição crítica ainda não possui prova real de
  provider/sandbox ou executor; a capacidade não pode avançar à certificação.
- **HEALTHY:** somente quando há, para o escopo material aplicável,
  1. execução operacional material;
  2. executor determinístico quando aplicável;
  3. evidência externa independente do provider;
  4. isolamento por tenant/workspace e idempotência;
  5. injeção de falha e recuperação comprovadas; e
  6. ligação imutável à versão aprovada do Master Plan.

Teste unitário, fixture, mock, simulação, ambiente local ou dry-run **nunca**
equivale a HEALTHY. Logs internos tampouco substituem recibo ou confirmação
independente do provider. A evidência abaixo é o mínimo objetivo para certificar
a linha, além dos seis requisitos estritos acima.

## Matriz de certificação

| # | Capacidade canônica | Classe atual | Fundação implementada | Condição prioritária ausente | Evidência objetiva exigida para certificação |
|---:|---|---|---|---|---|
| 1 | Imersão e intake | PARTIAL | Questionário/intake conversacional, persistência, scoring e clarificações. | Gate único para provas, capacidade de entrega, riscos e contradições. | Registro de intake real aprovado, com campos/gate completos, ligado imutavelmente ao Master Plan; teste de isolamento, repetição idempotente e falha/retomada. |
| 2 | Inteligência e análise de mercado | PARTIAL | Agente, relatório assíncrono, estados e vínculo de campanha/workspace. | Fontes externas, proveniência, confiança e atualização uniformes. | Relatório de fontes externas datadas e verificáveis, com confiança e reconciliação; recibos de consulta, isolamento/idempotência, falha de fonte e recuperação, vinculado ao Master Plan aprovado. |
| 3 | Avatar, segmentação e jornada | PARTIAL | Profile builder, targeting, avatar dinâmico e análise social. | Audiências por estágio/canal construídas, sincronizadas e utilizadas. | Recibos de criação/sincronização de audiência real em provider, reconciliação independente de segmentos e uso; isolamento, reexecução idempotente, falha/recovery e vínculo ao Master Plan. |
| 4 | Posicionamento, mecanismo e narrativa | PARTIAL | Identidade, strategic core/doctrine, arco emocional, coerência e gates internos. | Versionamento, aprovação e propagação uniforme à execução. | Versão aprovada propagada a ativos e ações, com hashes de entrada/saída auditáveis; teste de mudança/rejeição, isolamento, recuperação e ligação imutável ao Master Plan. |
| 5 | Engenharia da oferta | PARTIAL | Agentes de oferta/preço, objeções, upsell, produtos e checkout. | Oferta publicada e verificada ponta a ponta, inclusive condições e continuidade. | Oferta real/sandbox autorizado publicada no checkout com consulta independente de preço/condições; idempotência, isolamento, falha/reversão e Master Plan aprovado demonstrados. |
| 6 | Arquitetura estratégica do lançamento | PARTIAL | Strategy, command, governor, launch manager, fases, pipeline e scheduler. | Coordenação comprovada de canais, dependências, gates e contingências. | Execução material multi-canal contra plano aprovado, com dependências/gates observáveis; recibos externos, isolamento/idempotência, falha injetada/recuperada e vínculo imutável. |
| 7 | Master Plan | PARTIAL | Visualização, PDF, memória, rastros de decisão e validação cruzada. | Entidade soberana versionada que governe ações, orçamento, aprovações, gates e rollback. | Master Plan aprovado e versionado cujo hash é exigido e preservado em cada ação; tentativa de alteração/replay auditável, isolamento e recuperação comprovados. |
| 8 | Construção do funil | PARTIAL | Captura, páginas, sequências, pipeline, checkout e analytics em componentes. | Funil publicado/verificado de tráfego à conversão, abandono, onboarding e ascensão. | Jornada real/sandbox de ponta a ponta com recibos independentes por passagem; reexecução sem duplicação, isolamento, falha/recovery e Master Plan imutável. |
| 9 | Copy | PARTIAL | Geração para anúncios, páginas, VSL, conteúdo, e-mail e WhatsApp; aprovação/compliance. | Derivação uniforme do Master Plan vigente e prova de publicação/envio/desempenho. | Artefatos com versão/hash do Master Plan e recibos de publicação/envio do provider; isolamento, idempotência, falha/recuperação e reconciliação externa. |
| 10 | Direção criativa e produção visual | PARTIAL | Brief, direção, geração, previews, aprovação, rejeição e regeneração. | Exportação, distribuição, verificação visual e recovery uniformes por canal. | Asset final aprovado e publicado com URL/recibo verificável; validação independente, isolamento/idempotência, falha de exportação/publicação recuperada e vínculo ao Master Plan. |
| 11 | Direção e produção de vídeos | BLOCKED | Estratégia, hooks, brief, storyboard, projetos, gravações, avatar/voz, geração e editor. | Prova de executor real de provider/sandbox para cadeia render final → publicação → verificação. | Recibo de render e publicação de provider/sandbox real, confirmação independente de disponibilidade e cadeia de assets; isolamento/idempotência, falha/recovery e Master Plan imutável. |
| 12 | Páginas e ativos digitais | PARTIAL | Agente de landing page, site builder, conteúdo, VSL, checkout, rotas e persistência. | Deploy, domínio, responsividade, tracking, testes e verificação pós-publicação. | URL publicada e verificada externamente, testes de responsividade/tracking e recibos de deploy/DNS; isolamento/idempotência, falha/recovery e vínculo ao Master Plan. |
| 13 | Infraestrutura, tracking e integrações | PARTIAL | OAuth, integrações, validação, webhooks, Meta security e eventos de receita. | Padrão único de atribuição, permissões, expiração e recuperação entre canais. | Conexão real por provider com recibo e reconciliação de evento/atribuição; testes de escopo, expiração e recuperação, isolamento/idempotência e Master Plan imutável. |
| 14 | CRM, gestão de leads, grupos e comunidades | PARTIAL | Captura, contatos, pipeline, conversas, segmentos, follow-up, WhatsApp e planejador de grupos. | Identidade/histórico unificados, deduplicação, scoring, sincronização e gestão autônoma. | Lead real/sandbox consentido acompanhado em CRM/provider e comunidade, com deduplicação e recibos; isolamento/idempotência, falha/recovery e vínculo ao Master Plan. |
| 15 | Presença Digital e audiência | PARTIAL | Planejamento, geração, aprovação, agendamento, publicação, worker, métricas e webhooks. | Recovery uniforme de tokens/falhas e jornada audiência → lead → venda comprovada. | Recibos independentes de publicação, métricas e conversão atribuída; teste de token expirado e recuperação, isolamento/idempotência e Master Plan imutável. |
| 16 | E-mail, mensagens e nutrição | PARTIAL | Dispatchers, sequências, agenda, contatos, copy, e-mail, WhatsApp e webhooks parciais. | Entregabilidade, recebimento/resposta, opt-out, dead-letter e recovery ponta a ponta. | Recibos de aceitação/entrega e opt-out do provider, histórico reconciliado; deduplicação de envio, isolamento, falha/dead-letter/retomada e vínculo ao Master Plan. |
| 17 | Mídia paga | BLOCKED | Contas, providers, políticas, propostas, tentativas, ações, sync, scheduler e preflight parcial. | Prova de executor real de provider/sandbox para criar, aprovar e verificar campanha/métricas. | Recibos de API de sandbox/provider real para campanha, gasto/estado e métricas reconciliadas; isolamento/idempotência, falha/rollback/recovery e Master Plan imutável. |
| 18 | Execução coordenada do lançamento | PARTIAL | Filas, worker, fallback, checkpoint, dead-letter, replay, status e war room. | Cadeia ponta a ponta que governe ações externas pelo mesmo Master Plan com evidência uniforme. | Traço completo de lançamento material entre ações externas e plano aprovado; recibos por provider, isolamento/idempotência, falha injetada/replay/recuperação e hash imutável. |
| 19 | Atendimento, vendas e conversão | PARTIAL | Equipe de vendas, sugestões, WhatsApp, conversas, objeções, pipeline, checkout e receita. | Handoff, follow-up, recuperação, fechamento e atribuição confiáveis em todos os providers. | Conversa consentida até resultado no CRM/checkout com recibos independentes e atribuição reconciliada; isolamento/idempotência, falha/recovery e Master Plan imutável. |
| 20 | Monitoramento e otimização | PARTIAL | Métricas, health, status, analytics social, feedback de tráfego, otimização e relatórios. | Ciclo comprovado diagnóstico → decisão → ação externa → verificação. | Métrica externa reconciliada que dispara ação autorizada e mede efeito posterior; isolamento/idempotência, falha/recovery e vínculo imutável ao Master Plan. |
| 21 | Pós-lançamento e aprendizado | PARTIAL | Debriefing, memória, inteligência cross-campaign, logs, métricas, auditoria e self-proof. | Governança de qualidade e reaplicação automática/verificável no próximo ciclo. | Debrief com fontes externas reconciliadas e aprendizado aprovado consumido por ciclo posterior, com proveniência; isolamento, idempotência, falha/recovery e Master Plan imutável. |
| 22 | Continuidade, relançamento e perpétuo | PARTIAL | Perpetual launch manager, reengagement, campanhas, sequências, scheduler, memória e presença contínua. | Operação adaptativa orientada por resultados com decisão, gates, execução, verificação e encerramento. | Ciclo posterior material com decisão baseada em resultado externo, gate e execução verificados; isolamento/idempotência, falha/recovery e vínculo ao Master Plan aprovado. |

## Regra de comunicação pública

A landing apresenta **somente as capacidades** do Método GLP22; ela não deve
afirmar certificação, saúde operacional ou execução comprovada de uma linha
acima. A promoção pública do Método GLP22 como conjunto operacional integral
fica condicionada à certificação **HEALTHY de todas as 22 capacidades** por esta
matriz, sem exceções por teste unitário ou dry-run.