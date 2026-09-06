# Etapa 1 — Inventário Canônico do NexOS AI

**Versão:** 0.1
**Status:** inventário baseado em código concluído — aguardando gate da Etapa 1
**Data da auditoria:** 07 de setembro de 2026
**Fonte soberana:** `docs/ETAPA_0_CONGELAMENTO_CONCEITUAL.md`

---

## 1. Objetivo

Este documento registra o que existe no NexOS AI e classifica cada capacidade
em relação ao Global Launch Protocol congelado na Etapa 0.

Esta etapa não corrige, remove, integra ou implementa componentes. Ela separa:

- intenção documentada;
- prompt ou conhecimento;
- geração de entregável;
- workflow interno;
- ação externa;
- verificação independente;
- recuperação;
- autonomia operacional.

Existência de arquivo, tela, role ou prompt não é prova de execução integral.

---

## 2. Escala de evidência

| Nível | Nome | Critério |
|---|---|---|
| E0 | Ausente | Não foi encontrada capacidade correspondente |
| E1 | Declarado | Existe em documento, prompt, role ou interface sem fluxo comprovado |
| E2 | Gera | Produz e/ou persiste inteligência ou entregável |
| E3 | Workflow interno | Participa de pipeline, estado, aprovação, fila ou scheduler |
| E4 | Ação externa | Chama provider ou plataforma externa |
| E5 | Verificado | Confirma externamente que a ação ou resultado ocorreu |
| E6 | Recuperável/autônomo | Detecta falha, recupera, verifica e continua dentro da autoridade |

O nível atribuído representa a melhor evidência identificada no código. Uma
capacidade pode alcançar um nível alto apenas em parte de seu escopo.

---

## 3. Resumo executivo

O NexOS possui cobertura ampla do GLP, com maior maturidade em:

- arquitetura estratégica;
- geração de copy;
- integrações;
- Presença Digital;
- mídia paga;
- orquestração;
- interfaces de produção e operação.

Porém, a execução integral congelada na Etapa 0 ainda não está comprovada como
uma cadeia única e contínua.

Os principais cortes encontrados são:

1. inteligência de mercado existe, mas fontes e evidências externas não são
   uniformemente demonstradas;
2. o Master Plan é forte como documento, mas fraco como contrato operacional
   versionado que governa todas as ações;
3. funil, páginas, vídeos, CRM e grupos têm componentes, porém não formam uma
   execução ponta a ponta comprovada;
4. ações externas existem em social, mensageria, integrações e mídia, mas
   verificação e recuperação variam por canal;
5. monitoramento e recomendações não comprovam um ciclo automático completo de
   diagnóstico, correção e verificação;
6. continuidade, relançamento e perpétuo existem principalmente como agentes,
   memória, sequências e schedulers, sem prova de adaptação integral;
7. a documentação de agentes e workflows está atrasada em relação ao código.

---

## 4. Matriz das capacidades GLP

### 4.1 Imersão e intake

**Estado:** parcial — E3

**Existe:**

- questionário e intake conversacional;
- persistência;
- scoring e completude;
- clarificações;
- atualização de campanha e perfil.

**Evidência principal:**

- `artifacts/api-server/src/modules/intake/`
- `artifacts/app/src/pages/campaigns/intake.tsx`
- `artifacts/app/src/pages/campaigns/new.tsx`

**Lacuna:** provas, capacidade de entrega, riscos e contradições ainda não
aparecem como um gate único e completo do objetivo final.

### 4.2 Inteligência e análise de mercado

**Estado:** parcial — E3

**Existe:**

- agente e serviço de inteligência de mercado;
- relatório assíncrono;
- estados de geração;
- vínculo com campanha e workspace;
- reutilização de relatório recente;
- interface dedicada.

**Evidência principal:**

- `artifacts/api-server/src/modules/market-intel/`
- `lib/db/src/schema/market-intel.ts`
- `artifacts/app/src/pages/market-intel/`

**Lacuna:** fontes externas, evidência, confiança, tendências, anúncios,
concorrência e atualização não estão comprovados uniformemente pelo código.

### 4.3 Avatar, segmentação e jornada

**Estado:** parcial — E2

**Existe:**

- profile builder;
- targeting;
- estado dinâmico de avatar;
- análise de perfil social;
- outputs subordinados à estratégia.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/profile-builder.agent.ts`
- `artifacts/api-server/src/modules/agents/targeting.agent.ts`
- `artifacts/api-server/src/modules/agents/dynamic-avatar-state.ts`

**Lacuna:** não há prova uniforme de audiências construídas, sincronizadas e
utilizadas por estágio e canal.

### 4.4 Posicionamento, mecanismo e narrativa

**Estado:** parcial — E3

**Existe:**

- identidade;
- strategic core e doctrine;
- arco emocional;
- coerência;
- alinhamento;
- gates internos.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/identity-architect.agent.ts`
- `artifacts/api-server/src/modules/agents/strategic-core.agent.ts`
- `artifacts/api-server/src/modules/campaign-brain/`

**Lacuna:** versionamento, aprovação e propagação para toda a execução não são
demonstrados de forma uniforme.

### 4.5 Engenharia da oferta

**Estado:** parcial — E3

**Existe:**

- agente de oferta;
- preço;
- escassez;
- objeções;
- upsell;
- validação de produto;
- produtos e checkout.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/offer.agent.ts`
- `artifacts/api-server/src/modules/agents/pricing-psychologist.agent.ts`
- `lib/db/src/schema/products.ts`
- `artifacts/app/src/pages/produtos/`

**Lacuna:** oferta publicada e verificada de ponta a ponta, incluindo bônus,
garantia, condições, escassez real e continuidade.

### 4.6 Arquitetura estratégica do lançamento

**Estado:** forte — E3

**Existe:**

- strategy;
- command;
- execution governor;
- launch manager;
- fases;
- pipeline;
- sequências;
- scheduler;
- war room.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/strategy.agent.ts`
- `artifacts/api-server/src/modules/pipeline/`
- `artifacts/api-server/src/modules/launch-sequence/`
- `artifacts/app/src/pages/war-room/`

**Lacuna:** coordenação comprovada de todos os canais, dependências, gates e
contingências.

### 4.7 Master Plan

**Estado:** parcial/fraco como contrato operacional — E2

**Existe:**

- visualização de estratégia e Master Plan;
- exportação em PDF;
- memória de campanha;
- rastros de decisão;
- validação cruzada;
- autocrítica.

**Evidência principal:**

- `artifacts/app/src/pages/campaigns/strategy-masterplan.tsx`
- `artifacts/app/src/lib/masterplan-pdf.ts`
- `artifacts/api-server/src/modules/campaign-brain/`

**Lacuna crítica:** não foi identificada uma entidade canônica de Master Plan
versionado que governe ações, orçamento, aprovações, gates, mudanças materiais
e rollback.

### 4.8 Construção do funil

**Estado:** parcial — E4 em componentes

**Existe:**

- captura;
- páginas públicas;
- sequências;
- bridge;
- contatos;
- calendário;
- pipeline;
- checkout;
- analytics.

**Evidência principal:**

- `artifacts/api-server/src/modules/launch-sequence/`
- `artifacts/api-server/src/modules/product-checkout/`
- `artifacts/app/src/pages/sequences/`
- `artifacts/app/src/pages/pipeline/`

**Lacuna:** prova de funil publicado e verificado de tráfego até conversão,
abandono, onboarding e ascensão.

### 4.9 Copy

**Estado:** forte em geração — E3

**Existe:**

- copy de anúncios;
- páginas;
- VSL;
- webinar;
- conteúdos;
- social;
- e-mail;
- WhatsApp;
- aprovação;
- compliance;
- regeneração.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/copywriter.agent.ts`
- `artifacts/api-server/src/modules/content/`
- `artifacts/app/src/pages/campaigns/content.tsx`

**Lacuna:** derivação uniforme da versão vigente do Master Plan e comprovação
de publicação, envio e desempenho.

### 4.10 Direção criativa e produção visual

**Estado:** parcial — E3/E4

**Existe:**

- media brief;
- creative director;
- conceito;
- geração automática;
- previews;
- aprovação;
- rejeição;
- regeneração;
- geração standard/HD.

**Evidência principal:**

- `artifacts/api-server/src/modules/creatives/`
- `artifacts/api-server/src/modules/content/creative-auto-gen.service.ts`
- `artifacts/app/src/pages/campaigns/creatives.tsx`

**Lacuna:** exportação, distribuição, verificação visual e recuperação
uniformes por canal.

### 4.11 Direção e produção de vídeos

**Estado:** parcial — E3/E4

**Existe:**

- estratégia;
- hooks;
- filming brief;
- direção de cenas;
- storyboard;
- projetos;
- gravações;
- avatar e voz;
- geração;
- editor separado.

**Evidência principal:**

- `artifacts/api-server/src/modules/video-production/`
- `lib/db/src/schema/video-projects.ts`
- `artifacts/app/src/pages/recordings/`
- `artifacts/video-editor/`

**Lacuna:** cadeia uniforme de roteiro até render final, aprovação, publicação
e verificação em escala.

### 4.12 Páginas e ativos digitais

**Estado:** parcial — E2/E3

**Existe:**

- agente de landing page;
- site builder;
- conteúdo de páginas;
- VSL;
- checkout;
- rotas públicas;
- persistência de ativos.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/landing-page.agent.ts`
- `artifacts/app/src/pages/site-builder/`
- `artifacts/api-server/src/modules/vsl/`

**Lacuna:** deploy, domínio, responsividade, tracking, testes e verificação
pós-publicação.

### 4.13 Infraestrutura, tracking e integrações

**Estado:** forte, mas desigual — E4/E5

**Existe:**

- OAuth;
- integrações;
- validação;
- webhooks;
- segurança Meta;
- revenue events;
- telas para conectar, testar e remover;
- estados e evidência em partes.

**Evidência principal:**

- `artifacts/api-server/src/modules/integrations/`
- `artifacts/api-server/src/modules/social/meta-webhook.security.ts`
- `artifacts/api-server/src/modules/revenue/`
- `artifacts/app/src/pages/integracoes/`

**Lacuna:** atribuição, entregabilidade, permissões, expiração e recuperação
não seguem um padrão único em todos os canais.

### 4.14 CRM, leads, grupos e comunidades

**Estado:** parcial — E3/E4

**Existe:**

- captura;
- consentimento em partes;
- contatos;
- pipeline;
- conversas;
- segmentos;
- follow-up;
- atendimento;
- WhatsApp;
- planejador de grupos.

**Evidência principal:**

- `artifacts/api-server/src/modules/sales-team/`
- `artifacts/api-server/src/modules/launch-sequence/lead-capture.routes.ts`
- `artifacts/app/src/pages/pipeline/`
- `artifacts/app/src/pages/social/group-planner.tsx`

**Lacuna:** identidade e histórico unificados, deduplicação, lead scoring,
distribuição, sincronização e gestão autônoma de comunidades.

### 4.15 Presença Digital e audiência

**Estado:** forte em comparação aos demais — E5 parcial

**Existe:**

- planejamento;
- geração;
- aprovação;
- agendamento;
- publicação;
- worker;
- presença multiconta;
- métricas;
- moderação;
- grupos;
- webhooks.

**Evidência principal:**

- `artifacts/api-server/src/modules/social/`
- `artifacts/api-server/src/modules/social-presence/`
- `artifacts/app/src/pages/presence/`
- `artifacts/app/src/pages/social/`

**Lacuna:** recuperação uniforme de tokens e falhas por plataforma e
comprovação da jornada audiência → lead → venda.

### 4.16 E-mail, mensagens e nutrição

**Estado:** parcial — E4

**Existe:**

- dispatchers;
- sequências;
- agenda;
- contatos;
- copy;
- e-mail;
- WhatsApp;
- webhooks e histórico em partes.

**Evidência principal:**

- `artifacts/api-server/src/modules/email-dispatch/`
- `artifacts/api-server/src/modules/whatsapp/`
- `artifacts/app/src/pages/sequences/`

**Lacuna:** entregabilidade, recebimento, resposta, opt-out, dead-letter e
recuperação ponta a ponta.

### 4.17 Mídia paga

**Estado:** forte em estrutura operacional — E4 parcial

**Existe:**

- contas;
- providers;
- políticas;
- propostas;
- tentativas;
- ações;
- sync;
- scheduler;
- orçamento e preflight em partes.

**Evidência principal:**

- `artifacts/api-server/src/modules/paid-media/`
- `artifacts/app/src/pages/paid-media/`

**Lacuna:** comprovação uniforme de criação, aprovação, gasto, resultado,
otimização, rollback e recuperação em plataformas externas.

### 4.18 Execução coordenada do lançamento

**Estado:** forte no runtime interno — E3/E4

**Existe:**

- filas;
- worker de orquestração;
- fallback;
- checkpoint;
- dead-letter;
- replay;
- status operacional;
- launch room;
- launcher;
- war room;
- central administrativa.

**Evidência principal:**

- `artifacts/api-server/src/modules/orchestration/`
- `artifacts/api-server/src/modules/operations/`
- `artifacts/app/src/pages/launcher/`
- `artifacts/app/src/pages/admin/operations.tsx`

**Lacuna:** cadeia fim a fim que governe todas as ações externas pelo mesmo
Master Plan, com idempotência e evidência uniforme.

### 4.19 Atendimento, vendas e conversão

**Estado:** parcial — E3/E4

**Existe:**

- equipe de vendas;
- sugestões;
- WhatsApp;
- conversas;
- objeções;
- pipeline;
- checkout;
- eventos de receita;
- atendimento.

**Evidência principal:**

- `artifacts/api-server/src/modules/sales-team/`
- `artifacts/api-server/src/modules/revenue/`
- `artifacts/app/src/pages/atendimento/`
- `artifacts/app/src/pages/revenue/`

**Lacuna:** handoff, follow-up, recuperação, fechamento e atribuição confiável
em todos os provedores.

### 4.20 Monitoramento e otimização

**Estado:** parcial — E3

**Existe:**

- métricas;
- health;
- status operacional;
- analytics sociais;
- feedback de tráfego;
- agente de otimização;
- relatórios.

**Evidência principal:**

- `artifacts/api-server/src/modules/metrics/`
- `artifacts/api-server/src/modules/operations/`
- `artifacts/api-server/src/modules/agents/optimization.agent.ts`
- `artifacts/app/src/pages/social/analytics.tsx`

**Lacuna:** ciclo comprovado diagnóstico → decisão → ação externa → verificação.
O relatório semanal ainda contém envio simulado.

### 4.21 Pós-lançamento e aprendizado

**Estado:** parcial — E2/E3

**Existe:**

- debriefing;
- memória;
- inteligência cross-campaign;
- logs;
- métricas;
- auditoria;
- self-proof.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/launch-debriefing.agent.ts`
- `artifacts/api-server/src/modules/memory/`
- `artifacts/api-server/src/modules/agents/cross-campaign-intelligence.service.ts`
- `artifacts/app/src/pages/memory/`

**Lacuna:** governança da qualidade do aprendizado e reaplicação automática e
verificável no próximo ciclo.

### 4.22 Continuidade, relançamento e perpétuo

**Estado:** parcial — E3

**Existe:**

- perpetual launch manager;
- reengagement;
- criação de campanhas;
- sequências;
- scheduler;
- memória;
- Presença Digital contínua.

**Evidência principal:**

- `artifacts/api-server/src/modules/agents/perpetual-launch-manager.agent.ts`
- `artifacts/api-server/src/modules/agents/reengagement.agent.ts`
- `artifacts/api-server/src/modules/launch-sequence/`
- `artifacts/app/src/pages/campaigns/`

**Lacuna:** continuidade adaptativa orientada por resultados, com decisão,
gates, execução, verificação e encerramento.

---

## 5. Censo de agentes

Os números anteriores não mediam a mesma coisa.

| Medida | Quantidade encontrada | O que significa |
|---|---:|---|
| `AgentRole` no AI gateway | 79 | Identidades aceitas pelo roteador de IA |
| Entradas no provider map | 79 | Roles com provider/modelo configurado |
| Arquivos `*.agent.ts` | 72 | Implementações nomeadas como arquivos de agente |
| Seções/famílias no contrato antigo | 17 | Cobertura documental, não quantidade real |

Há oito arquivos de agente cujo nome não corresponde diretamente a uma role de
mesmo nome:

- `avatar-voice-file.agent.ts`;
- `context-refinement.agent.ts`;
- `cpl-scripts.agent.ts`;
- `ethics-autocorrect.agent.ts`;
- `filming-brief.agent.ts`;
- `item-copy.agent.ts`;
- `output-judge.agent.ts`;
- `social-profile-analyzer.agent.ts`.

Isso pode representar helpers especializados, alias, role compartilhada ou
lacuna contratual. A Etapa 1 não presume que cada arquivo corresponda a um
agente operacional independente.

### 5.1 Estado geral por família

| Família | Estado observado |
|---|---|
| Runner e governança transversal | Integrados, com logs e fallback parcial |
| Intake e mercado | Integrados em partes; contrato documental incompleto |
| Estratégia, comando e perfil | Pipeline principal ativo |
| Oferta e psicologia | Oferta integrada; vários especialistas sem acionamento uniforme |
| Copy e conteúdo | Forte geração; execução depende de módulos posteriores |
| Criativos e vídeo | Geração e aprovação parciais; último quilômetro desigual |
| Tráfego e audiência | Planejamento e operação em partes; evidência externa desigual |
| Compliance e crítica | Amplo conhecimento; bloqueio e recovery não uniformes |
| Vendas e mensageria | Integrações e interfaces parciais |
| Métricas, memória e debrief | Produzem análise; aplicação automática não comprovada |
| Experimentais/especiais | Role/prompt não equivale a pipeline operacional |

---

## 6. Estado dos documentos existentes

### `INVENTARIO_AGENTES_NEXOS.md`

- é anterior ao congelamento canônico;
- informa 64 agentes, número que não corresponde às 79 roles atuais;
- é profundo em doutrinas e frameworks;
- não diferencia consistentemente prompt, pipeline, executor, evidência e
  recovery;
- permanece válido como catálogo intelectual, não como inventário operacional
  soberano.

### `NEXOS_AGENT_CONTRACTS.md`

- afirma cobrir todos os agentes ativos, mas cobre apenas uma fração;
- omite market intelligence;
- possui divergências de input/output para strategy;
- não registra executor, idempotência, evidência, retry, retomada ou rollback;
- deve ser tratado como contrato parcial.

### `NEXOS_WORKFLOW_MAP.md`

- omite capacidades atuais;
- não representa todo o pipeline de inteligência;
- registra fluxos fire-and-forget;
- não cobre mídia paga, continuidade e recuperação de forma suficiente;
- deve ser reconciliado na etapa apropriada.

### `NEXOS_MASTER_ARCHITECTURE.md`

- está conceitualmente subordinado à Etapa 0;
- sua contagem “70+ roles” é imprecisa diante das 79 roles atuais;
- declara execução integral em amplitude maior do que a comprovação reunida;
- permanece válido como visão técnica, com necessidade de atualização factual.

### `NEXOS_STATE_MACHINE.md`

- é válido para estado de campanha;
- não representa estado de ações, agentes, jobs e integrações;
- não invalida a Etapa 1, mas não comprova autonomia integral.

### `NEXOS_GUARDRAILS.md`

- contém regras importantes e reconhece riscos reais;
- sua cobertura não está demonstrada uniformemente nos workflows;
- evidência externa e recovery precisam de contrato mais preciso.

---

## 7. Comparação com o congelamento canônico

### Alinhamentos fortes

- o sistema está centrado em lançamentos;
- análise, estratégia, conteúdo, mídia, social e vendas existem como domínios;
- há automação, filas, schedulers e ações externas;
- Presença Digital pode sustentar preparação e continuidade;
- isolamento, autorização, logs e controles já receberam hardening;
- existe base suficiente para evoluir sem reconstrução total.

### Alinhamentos parciais

- o conhecimento é amplo, mas nem sempre chega à execução;
- o Master Plan existe como saída, não como contrato soberano de runtime;
- há produção, mas publicação e verificação variam por ativo;
- há métricas, mas otimização aplicada não fecha o ciclo em todos os canais;
- há continuidade conceitual, mas não uma operação perpétua comprovada.

### Contradições ou riscos

- documentos podem chamar roles registradas de agentes operacionais;
- a arquitetura declara execução integral antes de sua comprovação uniforme;
- algumas capacidades críticas terminam em recomendação;
- fire-and-forget pode ocultar falhas e quebrar continuidade;
- logs internos podem ser confundidos com evidência externa;
- agentes especializados podem existir sem acionamento no pipeline.

---

## 8. Regra de preservação

Este inventário não desfaz trabalho anterior.

### Compatível e preservado

- hardening;
- isolamento multicliente;
- filas e schedulers;
- dead-letter e replay;
- checkpoint e retomada;
- créditos e idempotência já implementados;
- contratos de autonomia;
- máquinas de estado existentes;
- publicação social;
- vídeo e HeyGen;
- integrações;
- mídia paga;
- observabilidade;
- interfaces;
- agentes e bibliotecas intelectuais.

### Compatível, mas parcial

Componentes classificados como parciais devem ser completados nas etapas
correspondentes, sem reconstrução automática.

### Válido em outra etapa

Invariantes, state machines, runtime, threat model, schema, gates e hardening
serão reaproveitados quando o fluxograma chegar às etapas oficiais
correspondentes.

### Contraditório

Uma contradição exige correção explícita e demonstrada. Ela não autoriza
remoção ampla nem reescrita sem análise de impacto.

---

## 9. Principais lacunas inventariadas

1. Master Plan não governa o runtime como contrato versionado central.
2. Não há cadeia única comprovada do intake à continuidade.
3. Inteligência de mercado não tem evidência externa uniforme.
4. Agentes registrados não equivalem a agentes integrados.
5. Contratos documentais cobrem apenas parte das 79 roles.
6. Funil completo não está comprovado ponta a ponta.
7. Produção e publicação de páginas e vídeos são desiguais.
8. CRM, leads e grupos estão fragmentados.
9. Verificação externa não segue padrão único.
10. Recovery não cobre todos os canais.
11. Otimização nem sempre executa a correção recomendada.
12. Aprendizado não fecha comprovadamente o próximo ciclo.
13. Continuidade/perpétuo ainda não é uma operação adaptativa comprovada.
14. Documentação está defasada em relação ao código.

---

## 10. Gate da Etapa 1

A Etapa 1 poderá ser congelada quando o responsável do produto confirmar que:

- [ ] as 22 capacidades GLP foram inventariadas;
- [ ] código, interface e documentação foram considerados;
- [ ] role, arquivo, prompt e agente operacional foram diferenciados;
- [ ] geração, execução, verificação e recovery foram diferenciados;
- [ ] capacidades existentes foram preservadas;
- [ ] lacunas foram registradas sem implementação prematura;
- [ ] contradições documentais foram explicitadas;
- [ ] o inventário foi comparado ao congelamento canônico;
- [ ] o inventário pode alimentar o Contrato Arquitetural da Etapa 2.

Após aprovação, o status muda para “congelado”. A Etapa 2 deverá usar este
inventário como entrada, sem reinterpretar uma role registrada como capacidade
operacional comprovada.
