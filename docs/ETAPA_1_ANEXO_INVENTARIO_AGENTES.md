# Etapa 1 — Anexo Canônico: Inventário de Agentes

**Natureza:** anexo somente de inventário; não aprova arquitetura, não implementa
código e não congela a Etapa 1.  
**Status:** auditoria técnica concluída — aguardando aprovação formal da Etapa 1.
**Data:** 07/09/2026. **Reconciliação:** 08/09/2026.
**Subordinação:** Etapa 0 — Congelamento Conceitual.

## 1. Limite, evidências e método

Este anexo aplica a definição de produto e a regra de preservação de
`docs/ETAPA_0_CONGELAMENTO_CONCEITUAL.md`; não altera seus gates nem transforma
uma identidade registrada em capacidade operacional comprovada. As evidências
primárias são o tipo e o mapa em
`artifacts/api-server/src/modules/ai-gateway/ai-gateway.service.ts`, os arquivos
em `artifacts/api-server/src/modules/agents/`, o registro experimental em
`artifacts/api-server/src/modules/agents/experimental/README.md` e os documentos
históricos `INVENTARIO_AGENTES_NEXOS.md` e `NEXOS_AGENT_CONTRACTS.md`.

O método usa, sem redefinição por classe, a escala soberana: **E0** ausente;
**E1** declarado; **E2** gera/persiste; **E3** workflow interno; **E4** ação
externa; **E5** verificado externamente; **E6** recuperável/autônomo. Classes
de implementação são outra dimensão: prompt/biblioteca, gerador/analista,
decisor/verificador, orquestrador e executor determinístico externo. A escala de
autonomia é: **A0** observa; **A1**
recomenda; **A2** prepara rascunho; **A3** executa após aprovação; **A4**
executa dentro de política; **A5** verifica/recupera/continua. “Não comprovada”
significa que esta auditoria não encontrou integração estática suficiente; não
significa inexistência ou reprovação.

O vídeo de referência (37 agentes, 6 departamentos, base de conhecimento, SOPs,
skills, autonomia, dashboards e Hermes) saiu do stand-by agora **somente como
benchmark estrutural**. Não fornece nomes a copiar, não é prova de implementação
e não aprova arquitetura.

A explicação individual de missão, mecanismo, especialização, entrada, saída,
consumidor, conexão, atividade e prontidão das 79 roles do snapshot original está em
`docs/ETAPA_1_REVISAO_79_AGENTES.md`.

## 2. Contagens confirmadas

| Medida | Valor | Evidência |
|---|---:|---|
| `AgentRole` | 86 | `ai-gateway.service.ts` |
| provider map | 86 | `AGENT_PROVIDER_MAP` no mesmo path |
| arquivos `*.agent.ts` | 73 | diretório `modules/agents/` |
| arquivos auxiliares ou compartilhados sem role única homônima | 9 | lista na seção 4 |

## 3. Censo-base de roles (79)

**Legenda:** classe é a classificação predominante; integração estática é
conservadora. Todas as roles abaixo são LLM/identidades de gateway ou camadas de
orquestração; nenhuma é denominada aqui “executor externo”.

### D1 — Descoberta e Inteligência
| role | implementação principal | classe | integração estática | estado conservador |
|---|---|---|---|---|
| market_intel | `agents/market-intel.agent.ts` | gerador/analista | `market-intel.service`/orquestração | E3; A2 |
| analytics | `ai-gateway.service.ts` | gerador/analista | serviços internos com role compartilhada | E3 parcial; A1 |
| business_intelligence | `agents/business-intelligence.agent.ts` | gerador/analista | `command.agent.ts` | E3; A1 |
| creator_growth | `agents/creator-growth.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| profile_builder | `agents/profile-builder.agent.ts` | gerador/analista | `orchestration.worker` | E3; A2 |
| traffic_intelligence | `agents/traffic-intelligence.agent.ts` | gerador/analista | `command.agent.ts` | E3; A1 |
| market_validator | `ai-gateway.service.ts` | decisor/verificador | `market-validation.service` e `command.agent.ts` | E3; A1 |
| offer_price_validator | `ai-gateway.service.ts` | decisor/verificador | `market-validation.service` e `command.agent.ts` | E3; A1 |
| brand_validator | `ai-gateway.service.ts` | decisor/verificador | `market-validation.service` e `command.agent.ts` | E3; A1 |
| product_validator | `agents/product-validator.agent.ts` | decisor/verificador | executor disponível; acionamento externo ao arquivo não comprovado | E2; A1 |

### D2 — Estratégia e Oferta
| role | implementação principal | classe | integração estática | estado conservador |
|---|---|---|---|---|
| strategy | `agents/strategy.agent.ts` | gerador/analista | `orchestration.worker` | E3; A2 |
| strategic_core | `agents/strategic-core.agent.ts` | gerador/analista | `command.agent.ts` | E3; A1 |
| strategic_doctrine | `agents/strategic-doctrine.agent.ts` | prompt/biblioteca | `command.agent.ts` | E3; A1 |
| conflict_detector | `agents/conflict-detector.service.ts` | decisor/verificador | serviço de detecção de conflitos | E3; A1 |
| strategic_core_validation | `agents/strategic-core.agent.ts` | decisor/verificador | validação do strategic core | E3; A1 |
| offer | `agents/offer.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| product_builder | `ai-gateway.service.ts` | gerador/analista | não comprovada | E1; A1 |
| financial_projector | `agents/financial-projector.agent.ts` | gerador/analista | `command.agent.ts` | E3; A1 |
| pricing_psychologist | `agents/pricing-psychologist.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| upsell_architect | `agents/upsell-architect.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| scarcity_engineer | `agents/scarcity-engineer.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| objection_killer | `agents/objection-killer.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| testimonial_curator | `agents/testimonial-curator.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| launch_manager | `agents/launch-manager.agent.ts` | orquestrador | `command.agent.ts` | E3; A2 |
| execution_governor | `agents/execution-governor.agent.ts` | orquestrador | `command.agent.ts` | E3; A2 |

### D3 — Conteúdo e Criativos
| role | implementação principal | classe | integração estática | estado conservador |
|---|---|---|---|---|
| copywriter | `agents/copywriter.agent.ts` | gerador/analista | `orchestration.worker` | E3; A2 |
| creative_director | `agents/creative-director.agent.ts` | gerador/analista | `creatives.service` | E3; A2 |
| creative_concept | `agents/creative-concept.agent.ts` | gerador/analista | direto/experimental | E2; A2 |
| ad_copy | `agents/ad-copy.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| ad_critic | `agents/ad-critic.agent.ts` | decisor/verificador | direto/experimental | E2; A1 |
| video | `ai-gateway.service.ts` | gerador/analista | não comprovada | E1; A1 |
| video_strategy | `agents/video-strategy.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| video_hook | `agents/video-hook.agent.ts` | gerador/analista | direto/experimental | E2; A2 |
| scene_director | `agents/scene-director.agent.ts` | gerador/analista | `video-production.service` | E3; A1 |
| media_brief | `agents/media-brief.agent.ts` | gerador/analista | `orchestration.worker` | E3; A2 |
| vsl_script | `agents/vsl-script.agent.ts` | gerador/analista | `orchestration.worker` | E3; A2 |
| cpl_script | `agents/cpl-script.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| webinar_script | `agents/webinar-script.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| live_script | `agents/live-script.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| stories_sequence | `agents/stories-sequence.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| content_calendar | `agents/content-calendar.agent.ts` | gerador/analista | conteúdo/pós-aprovação | E3; A2 |
| hook_factory | `agents/hook-factory.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| campaign_emotional_arc | `agents/campaign-emotional-arc.agent.ts` | gerador/analista | não comprovada | E2; A1 |
| emotional_coherence_checker | `agents/emotional-coherence-checker.agent.ts` | decisor/verificador | `content.service` | E3; A1 |
| social_media | `agents/social-media.agent.ts` | gerador/analista | `content.service` | E3; A1 |

### D4 — Aquisição e Distribuição
| role | implementação principal | classe | integração estática | estado conservador |
|---|---|---|---|---|
| media_buyer | `agents/media-buyer.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| targeting | `agents/targeting.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| landing_page | `agents/landing-page.agent.ts` | gerador/analista | `content.service` | E3; A2 |
| affiliate_campaign | `agents/affiliate-campaign.agent.ts` | gerador/analista | direto/experimental | E2; A2 |
| launch_sequence_builder | `agents/launch-sequence-builder.agent.ts` | gerador/analista | rota de sequências | E3; A2 |
| prelaunch_warming | `agents/prelaunch-warming.agent.ts` | gerador/analista | `content.service` | E3; A1 |
| semente_launch | `agents/semente-launch.agent.ts` | gerador/analista | `command.agent.ts` | E3; A2 |
| presence_planner | `agents/presence-planner.agent.ts` | gerador/analista | `social-presence.service` | E3; A1 |
| bio_optimizer | `ai-gateway.service.ts` | gerador/analista | `social-presence.service` | E3; A1 |
| organic_traffic | `agents/organic-traffic.agent.ts` | gerador/analista | `content.service` | E3; A2 |
| reengagement | `agents/reengagement.agent.ts` | gerador/analista | direto/experimental | E2; A2 |
| email_architect | `agents/email-architect.agent.ts` | gerador/analista | direto/experimental | E2; A2 |
| whatsapp_response | `agents/whatsapp-response.agent.ts` | gerador/analista | serviço de WhatsApp | E3; A2 |

### D5 — Conversão, Atendimento e Comunidade
| role | implementação principal | classe | integração estática | estado conservador |
|---|---|---|---|---|
| crisis_response | `agents/crisis-response.agent.ts` | decisor/verificador | direto/experimental | E2; A1 |
| sales_warmer | `ai-gateway.service.ts` | gerador/analista | `sales-team.service` | E3; A2 |
| sales_desire | `ai-gateway.service.ts` | gerador/analista | `sales-team.service` | E3; A2 |
| sales_closer | `ai-gateway.service.ts` | gerador/analista | `sales-team.service` | E3; A2 |
| sales_objection | `ai-gateway.service.ts` | gerador/analista | `sales-team.service` | E3; A2 |
| sales_consultant | `ai-gateway.service.ts` | gerador/analista | `sales-team.service` | E3; A2 |
| buyer_onboarding | `agents/buyer-onboarding.agent.ts` | gerador/analista | não comprovada | E2; A1 |
| domino | `agents/domino.agent.ts` | decisor/verificador | não comprovada | E2; A1 |
| identity_architect | `agents/identity-architect.agent.ts` | gerador/analista | não comprovada | E2; A1 |
| mental_frequency_coach | `agents/mental-frequency-coach.agent.ts` | gerador/analista | não comprovada | E2; A1 |
| obstinacy_trainer | `agents/obstinacy-trainer.agent.ts` | gerador/analista | não comprovada | E2; A1 |
| continuous_sales_manager | `agents/continuous-sales-manager.agent.ts` | orquestrador | `command.agent.ts` | E3; A1 |

### D6 — Operações, Medição e Continuidade
| role | implementação principal | classe | integração estática | estado conservador |
|---|---|---|---|---|
| command | `agents/command.agent.ts` | orquestrador | `orchestration.worker` | E3; A2 |
| memory_compression | `agents/memory-compression.agent.ts` | gerador/analista | `command.agent.ts` | E3; A1 |
| optimization | `agents/optimization.agent.ts` | gerador/analista | `metrics.service` | E3; A1 |
| launch_debriefing | `agents/launch-debriefing.agent.ts` | gerador/analista | direto/experimental | E2; A2 |
| integrations_specialist | `ai-gateway.service.ts` | gerador/analista | `integration-chat.routes`/prompt | E3; A1 |
| ux_simplification | `agents/ux-simplification.agent.ts` | gerador/analista | não comprovada | E2; A1 |
| perpetual_launch_manager | `agents/perpetual-launch-manager.agent.ts` | orquestrador | `command.agent.ts` | E3; A1 |
| ab_test_designer | `agents/ab-test-designer.agent.ts` | gerador/analista | direto/experimental | E2; A2 |
| compliance | `agents/compliance.agent.ts` | decisor/verificador | `command.agent.ts` | E3; A2 |

## 4. Nove arquivos auxiliares ou compartilhados sem role única homônima

`avatar-voice-file.agent.ts`, `audiovisual-ensemble.agent.ts`,
`context-refinement.agent.ts`,
`cpl-scripts.agent.ts`, `ethics-autocorrect.agent.ts`,
`filming-brief.agent.ts`, `item-copy.agent.ts`, `output-judge.agent.ts` e
`social-profile-analyzer.agent.ts` existem sob
`artifacts/api-server/src/modules/agents/`. Não são automaticamente agentes
independentes: podem ser helper, alias, implementação compartilhada ou lacuna
contratual. Em particular, `item_copy` aparece no contrato histórico, mas não é
uma das 79 `AgentRole` do snapshot original. O ensemble audiovisual implementa
uma cadeia compartilhada pelas sete roles adicionadas posteriormente; não é uma
87ª role.

## 5. Matriz de classes

| classe | escopo | conta como agente operacional? |
|---|---|---|
| identidade de gateway | role/provider/modelo | não, isoladamente |
| prompt/biblioteca | instrução, doutrina, checklist | não |
| gerador/analista | produz análise, plano ou rascunho | não, sem fluxo E3–E6 |
| decisor/verificador | julga, bloqueia ou aponta condição | não, sem ação/evidência |
| orquestrador | seleciona/encadeia trabalho | não, sem contrato integral |
| executor determinístico externo | API, worker ou serviço que efetiva ação | é componente operacional; não é role LLM |

Serviços determinísticos externos devem ser inventariados separadamente dos
agentes LLM: publishers de `social-presence`, ações/providers/workers de mídia
paga, provider de vídeo/HeyGen, mensageria e sequência. `creatives.service` e
`metrics.service` são serviços internos nesta classificação, não evidência
automática de ação externa. A presente evidência não demonstra para eles um
contrato único E5–E6 por role.

## 6. Slots funcionais comparativos (37; não são arquitetura aprovada)

Formato: **slot — missão; componentes atuais; E; A máximo; lacuna**.

### D1 (6)
S01. Intake e fatos — consolidar dados; `profile_builder`; E3; A2; proveniência.
S02. Mercado e concorrência — pesquisar; `market_intel`; E3; A2; evidência externa.
S03. Avatar e segmentos — modelar público; `profile_builder`; E3; A2; versionamento.
S04. Validação de mercado — testar hipótese; validators; E3; A1; ação/resultado.
S05. Inteligência de tráfego — diagnosticar canal; `traffic_intelligence`; E3; A1; integração.
S06. BI de contexto — sintetizar sinais; `analytics`, `business_intelligence`; E3; A1; ciclo fechado.

### D2 (7)
S07. Estratégia GLP — formular caminho; `strategy`; E3; A2; contrato runtime.
S08. Master Plan — consolidar operação; `command`, `launch_manager`; E2; A2; versão soberana.
S09. Doutrina e coerência — orientar decisão; `strategic_doctrine/core`; E3; A1; gate.
S10. Oferta — estruturar proposta; `offer`, `product_builder`; E3; A2; aprovação rastreada.
S11. Preço e viabilidade — estimar; `financial_projector`, pricing; E3; A2; execução autorizada.
S12. Ascensão — desenhar upsell; `upsell_architect`; E3; A2; checkout integrado.
S13. Plano de lançamento — fases e contingência; `launch_manager/governor`; E3; A2; continuidade.

### D3 (7)
S14. Copy central — gerar mensagens; `copywriter`; E3; A2; publicação/verificação.
S15. Conceito visual — dirigir criativo; `creative_director/concept`; E3; A2; aprovação.
S16. Anúncios — copy/crítica; `ad_copy/ad_critic`; E2; A2; deploy.
S17. Vídeo — estratégia a cena; vídeo roles; E4 parcial; A2; render/publicação.
S18. Eventos GLP — VSL/CPL/webinar/live; scripts; E2; A2; execução de evento.
S19. Social — calendário, stories e hooks; social roles; E4 parcial; A2; medição.
S20. Coerência emocional — validar narrativa; arco/checker; E3; A1; bloqueio verificável.

### D4 (6)
S21. Mídia paga — planejar aquisição; `media_buyer/targeting`; E4 parcial; A1; API/política.
S22. Páginas e funil — preparar landing; `landing_page`; E3; A2; publicação/teste.
S23. Pré-lançamento — aquecer; `prelaunch_warming`; E3; A1; disparo.
S24. Sequências — email/mensagens; builder/email; E3; A2; entrega/evidência.
S25. Social sempre ativo — presença/orgânico; planner/organic; E4 parcial; A2; ciclo de métricas.
S26. Recovery de audiência — reengajar; `reengagement`; E2; A2; acionamento e resultado.

### D5 (5)
S27. Atendimento WhatsApp — responder; `whatsapp_response`; E3; A2; política/evidência.
S28. Vendas consultivas — sugerir conversa; sales roles; E3; A2; fechamento externo.
S29. CRM, leads, objeções e desejo — preparar resposta; objection/desire; E3; A2; resultado CRM.
S30. Onboarding/comunidade/grupos — preparar pós-compra; `buyer_onboarding`; E2; A1; operação.
S31. Crise e recovery — orientar correção; `crisis_response`; E2; A1; execução/recovery.

### D6 (6)
S32. Comando/orquestração — coordenar; `command`; E3; A2; contrato Hermes único.
S33. Compliance — revisar limite; `compliance`; E3; A2; enforcement uniforme.
S34. Métricas/otimização — recomendar correção; analytics/optimization; E3; A1; aplicar/verificar.
S35. Experimentos — preparar A/B; `ab_test_designer`; E2; A2; execução/prova estatística.
S36. Debrief/memória — preservar aprendizado; debrief/memory; E3; A2; próximo ciclo.
S37. Perpétuo — coordenar continuidade; perpetual manager; E3; A1; operação adaptativa.

## 7. Comparação explícita, lacunas e subgate

- conhecimento embutido **!=** base central versionada;
- prompt/checklist **!=** SOP executável;
- arquivo/role **!=** skill;
- checkpoint/configuração **!=** nível de autonomia provado;
- telas **!=** dashboard operacional por agente;
- command/workers **!=** contrato Hermes único.

Há E5 parcial e não uniforme nas capacidades compostas que efetivamente fazem
ação externa; nenhuma role ou capacidade recebe E6 integral neste inventário.
E4–E6 pertencem à capacidade composta com executor determinístico separado, e
não decorrem de `command` apenas por orquestrar.

Lacunas: Master Plan ainda não é contrato versionado soberano de runtime; não há
cadeia única comprovada intake→continuidade; prova externa, recovery, CRM/grupos,
funil, páginas/vídeo, otimização aplicada e perpétuo são desiguais. O
`INVENTARIO_AGENTES_NEXOS.md` (64) é catálogo intelectual histórico, e
`NEXOS_AGENT_CONTRACTS.md` é parcial, diverge em provider de `offer` e registra
`item_copy` fora do `AgentRole`; ambos exigem reconciliação documental.

Preservar implementações, hardening, filas, checkpoints, integrações e
bibliotecas conforme a regra da Etapa 0: classificar como compatível completo,
compatível parcial, válido em outra etapa ou contraditório; não remover nem
refazer sem lacuna/contradição demonstrada e análise de impacto.

**Subgate adicional de agentes (não aprovado):** antes de chamar uma role de
agente operacional, registrar por role/ação o gatilho, input/output versionado,
autoridade A, executor E4, aprovação aplicável, idempotência, verificação externa
E5, retry/rollback, recuperação E6, isolamento de workspace e vínculo à versão
do Master Plan. Este subgate apenas informa o gate da Etapa 1; não o substitui.

## 8. Contagem automática

Contagem automática do censo-base: **79 linhas de role** (D1 10 + D2 15 + D3 20 +
D4 13 + D5 12 + D6 9), sem duplicatas. O suplemento audiovisual adiciona **7 roles**,
totalizando **86**; slots comparativos: **37**. O anexo inventaria identidades e
evidências, preserva o que existe e mantém a Etapa 1 aguardando revisão e gate.

## 9. Suplemento operacional audiovisual

| Role | Função operacional | Mecanismo e consumidor |
|---|---|---|
| `art_direction` | Define linguagem visual, cenários, composição e props. | Planejamento estruturado consumido pela cadeia audiovisual e pelo editor. |
| `wardrobe_appearance` | Define figurino, aparência e continuidade de apresentação. | Consome direção de arte; orienta takes filmados, clone e geração sintética. |
| `performance_voice` | Dirige interpretação, voz, ritmo e presença. | Consome roteiro e direção; orienta gravação, clone consentido e montagem. |
| `sound_design` | Planeja voz, música, ambiência e transições sonoras. | Entrega especificação ao editor; execução determinística permanece separada. |
| `editor` | Constrói plano de montagem e decisões de timeline. | Consome as decisões anteriores; timeline e render são persistidos. |
| `color_continuity` | Define tratamento de cor e verifica continuidade visual. | Orienta normalização e revisão; não substitui o executor de render. |
| `av_qc` | Avalia evidências técnicas e narrativas do render. | Produz relatório e issues persistentes; ausência de evidência falha para revisão humana. |