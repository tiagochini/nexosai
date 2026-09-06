# Etapa 1 — Revisão explicativa das 79 roles (snapshot-base)

## A) Escopo e escalas

Esta é uma leitura do código atual, não uma promessa de produto. A unidade censada é
a `AgentRole` de `artifacts/api-server/src/modules/ai-gateway/ai-gateway.service.ts`;
role, arquivo `.agent.ts`, prompt, serviço e executor determinístico são coisas
distintas. Os oito arquivos auxiliares sem role homônima não elevam o censo de 79.

**Escala canônica de evidência (E).** E0 = ausente; E1 = declarado (documento,
prompt, role ou interface sem fluxo provado); E2 = gera e/ou persiste inteligência
ou entregável; E3 = participa de workflow interno, estado, aprovação, fila ou
scheduler; E4 = chama plataforma/provider externo; E5 = confirma externamente a
ação ou resultado; E6 = detecta falha, recupera, verifica e continua dentro da
autoridade. O nível é a melhor evidência observada e pode cobrir só parte do escopo.

**Escala de autonomia (A).** A0 observa; A1 recomenda; A2 prepara rascunho; A3
executa após aprovação; A4 executa dentro de política; A5 verifica, recupera e
continua. Nesta revisão, LLM que produz plano, texto ou julgamento não recebe P5
só porque há um serviço externo no domínio.

**Prontidão (P).** P0 = só role registrada; P1 = prompt/especialidade declarada;
P2 = executor chamável e saída observável; P3 = conectado, com saída consumida em
workflow; P4 = contrato, observabilidade, idempotência/recovery e autoridade
robustos; P5 = resultado externo verificado e operação autônoma. Nenhuma role LLM
recebe P5 por mera existência de provider, FFmpeg, fila ou integração adjacente.

## B) Resumo

As contagens exatas são **79/79/72/8**: 79 `AgentRole`, 79 entradas no mapa de
provider, 72 arquivos `*.agent.ts` e 8 arquivos de agente sem role homônima. O
gateway sabe encaminhar todas as 79, mas isso sozinho é P0/P1, não execução.

Aqui, **conectado** quer dizer que o código atual chama a role por wrapper
(`runAgent`/função especializada) e a saída alimenta estado, peça, decisão ou
próximo passo; pode ser condicional e ainda falhar. **Ativo** é mais forte: há um
gatilho de fluxo atual (pipeline, serviço ou rota), não apenas arquivo, README
histórico ou provider configurado. Portanto, chamadas atuais por `command.agent.ts`
ou `content.service.ts` prevalecem sobre rótulos históricos de “experimental”.

## C) Censo por departamento

Cada linha abaixo corresponde a uma das 79 roles. “Gateway” indica que a evidência
é somente a identidade/provider atual; não infere prompt especializado nem call
site.

### D1 — Descoberta e Inteligência

| Role | O que faz | Como faz/especialização observada | Entrada → saída/consumidor | Conexão e atividade atual | E/A/P |
|---|---|---|---|---|---|
| market_intel | Sintetiza mercado e concorrência. | Agente de inteligência de mercado. | Briefing → análise para serviço/orquestração. | Call site em serviço de mercado; ativo no domínio. | E3/A2/P3 |
| analytics | Interpreta métricas e sinais. | Role Gemini no gateway, sem arquivo homônimo. | Dados internos → leitura para serviços consumidores. | Uso compartilhado por serviços internos; consumidor específico não uniforme. | E3/A1/P3 |
| business_intelligence | Consolida inteligência de negócio. | `business-intelligence.agent.ts` produz saída estruturada. | Contexto da campanha → BI usado pelo command. | Chamado pelo pipeline principal atual. | E3/A1/P3 |
| creator_growth | Recomenda crescimento de creator. | Agente Gemini de crescimento. | Contexto/peças → recomendações de conteúdo. | `content.service.ts` o chama e persiste peças/resultado. | E3/A1/P3 |
| profile_builder | Modela produto, avatar, segmentos e mercado. | Executor especializado com saída tipada. | Intake → `audienceData` e `targetingData`. | Command o chama cedo; dados alimentam downstream. | E3/A2/P3 |
| traffic_intelligence | Diagnostica inteligência de tráfego. | Agente especializado de plano/sinais de tráfego. | Dados de campanha → plano para command. | Chamado no command e integrado ao plano. | E3/A1/P3 |
| market_validator | Julga viabilidade mercadológica. | Validador no `market-validation.service.ts`. | Intake → veredito que pode bloquear pipeline. | Chamado antes do command; saída consumida. | E3/A1/P3 |
| offer_price_validator | Avalia preço/oferta. | Validador de avaliação mercadológica. | Intake → veredito consolidado do mercado. | Chamado no mesmo gate atual; pode exigir ciência. | E3/A1/P3 |
| brand_validator | Avalia risco/adequação de marca. | Validador de avaliação mercadológica. | Intake → veredito consolidado e bloqueio crítico. | Call site atual no command; resultado decide continuidade. | E3/A1/P3 |
| product_validator | Revisa produto contra critérios. | Arquivo e executor chamável existem. | Entrada de produto → validação estruturada. | Não foi encontrado call site de workflow para a role. | E2/A1/P2 |

### D2 — Estratégia e Oferta

| Role | O que faz | Como faz/especialização observada | Entrada → saída/consumidor | Conexão e atividade atual | E/A/P |
|---|---|---|---|---|---|
| strategy | Formula estratégia de lançamento. | Agente especializado usa perfil e briefing estratégico. | Intake/perfil → `strategyData` e aprovação. | Pipeline command persiste e transiciona para `strategy_ready`. | E3/A2/P3 |
| strategic_core | Define identidade e restrições estratégicas. | Produz briefing global e scores de risco/coerência. | Perfil+intake → memória e agentes seguintes. | Command o chama antes de strategy; saída é consumida. | E3/A1/P3 |
| strategic_doctrine | Aplica doutrina de consciência e lógica de lançamento. | Engine com frameworks e saída de doutrina. | Brief/memória → doutrina injetada no contexto. | Command chama e persiste na memória quando aplicável. | E3/A1/P3 |
| conflict_detector | Detecta conflitos estratégicos. | Serviço decisor de conflito. | Dados estratégicos → alertas/decisão interna. | Serviço específico tem integração estática, fora do call chain principal visível. | E3/A1/P3 |
| strategic_core_validation | Valida o strategic core. | Usa implementação do core para julgamento. | Briefing → validação de consistência. | Integrado à validação do núcleo estratégico. | E3/A1/P3 |
| offer | Estrutura a oferta comercial. | Agente de oferta com memória, estratégia e restrições. | Contexto → análise de oferta para cérebro da campanha. | Command o chama por tipo de campanha; resumo alimenta memória. | E3/A2/P3 |
| product_builder | Propõe construção de produto. | Só role/provider no gateway observados. | Prompt eventual → resposta do provider. | Não há arquivo homônimo nem call site atual encontrado. | E1/A1/P1 |
| financial_projector | Projeta viabilidade financeira. | Agente especializado de projeção. | Dados de campanha → projeção para pipeline. | Command o chama e checkpointa a conclusão. | E3/A1/P3 |
| pricing_psychologist | Desenha ancoragem e psicologia de preço. | Especialista da camada de psicologia. | Oferta/contexto → dados de preço consumidos no fluxo. | Chamado por command e conteúdo atuais. | E3/A2/P3 |
| upsell_architect | Desenha ascensão e upsell. | Especialista de arquitetura de upsell. | Oferta/contexto → plano de upsell para pipeline. | Chamado pelo command e conteúdo. | E3/A2/P3 |
| scarcity_engineer | Propõe escassez e urgência. | Especialista da camada psicológica. | Contexto → plano de escassez usado no fluxo. | Chamado em sequência de psicologia atual. | E3/A2/P3 |
| objection_killer | Mapeia e responde objeções. | Especialista de objeções com saída tipada. | Oferta/contexto → mapa para síntese e conteúdo. | Call site atual no command e conteúdo. | E3/A2/P3 |
| testimonial_curator | Seleciona/projeta uso de prova social. | Especialista de depoimentos. | Contexto → curadoria para camada de psicologia. | Command o chama no fluxo atual. | E3/A2/P3 |
| launch_manager | Planeja etapas do lançamento. | Orquestrador especializado de plano. | Estratégia/oferta → plano e total de dias. | Chamado pelo command e checkpointado. | E3/A2/P3 |
| execution_governor | Seleciona modo e agentes do pipeline. | Orquestrador produz plano, custo e agentes pulados. | Prontidão → plano que o command respeita. | Chamado após command; falha tem plano padrão. | E3/A2/P3 |

### D3 — Conteúdo e Criativos

| Role | O que faz | Como faz/especialização observada | Entrada → saída/consumidor | Conexão e atividade atual | E/A/P |
|---|---|---|---|---|---|
| copywriter | Escreve copy de campanha. | Agente de copy com contrato de peça. | Estratégia/perfil → peça `email_sequence`. | Conteúdo persiste, valida e pode reprocessar saída. | E3/A2/P3 |
| creative_director | Define direção criativa. | Gera identidade visual, cores e guia. | Intake/perfil → `creative_direction` para aprovação. | `content.service.ts` o chama e persiste a peça. | E3/A2/P3 |
| creative_concept | Cria conceito criativo. | Arquivo especializado e executor chamável. | Briefing → conceito criativo. | Não há integração de workflow além de uso direto/experimental encontrada. | E2/A2/P2 |
| ad_copy | Cria textos de anúncios. | Agente por segmento/canal com contrato. | Contexto → peça `ad_copy` para aprovação. | Pipeline de conteúdo chama, valida e persiste. | E3/A1/P3 |
| ad_critic | Critica anúncios. | Executor de julgamento de criativo. | Anúncio → crítica estruturada. | Call site de pipeline não foi encontrado; uso direto/experimental. | E2/A1/P2 |
| video | Identidade genérica para vídeo. | Só role Gemini/provider no gateway. | Prompt eventual → texto do provider. | Sem arquivo homônimo ou call site atual encontrado. | E1/A1/P1 |
| video_strategy | Planeja estratégia de vídeo. | Agente de estratégia audiovisual. | Contexto de campanha → plano/brief de vídeo. | `content.service.ts` o chama no fluxo de conteúdo. | E3/A1/P3 |
| video_hook | Cria ganchos para vídeo. | Arquivo especializado chamável. | Briefing → opções de gancho. | Nenhum workflow integrado encontrado; uso direto/experimental. | E2/A2/P2 |
| scene_director | Converte roteiro em cenas/storyboard. | ATLAS descreve câmera, luz, paleta, ritmo e prompts. | Roteiro/configuração → cenas usadas por produção de vídeo. | `video-production.service.ts` o chama para storyboard. | E3/A1/P3 |
| media_brief | Redige briefing de mídia/criativo. | Agente de briefing estruturado. | Estratégia → `mediaBriefs`/consumidor de conteúdo. | Chamado por conteúdo/orquestração. | E3/A2/P3 |
| vsl_script | Escreve roteiro de VSL. | Especialista de roteiro persuasivo; CYRUS também o usa. | Campanha → VSL/roteiro para peça ou projeto de vídeo. | Conteúdo o chama; produção usa `completeWithAgent("vsl_script")`. | E3/A2/P3 |
| cpl_script | Escreve roteiro CPL. | Agente de scripts de pré-lançamento. | Contexto → peça de CPL. | Chamado e persistido por `content.service.ts`. | E3/A1/P3 |
| webinar_script | Escreve roteiro de webinar. | Especialista de roteiro de evento. | Contexto → peça de webinar. | Call site atual no pipeline de conteúdo. | E3/A1/P3 |
| live_script | Escreve roteiro para live. | Especialista de live. | Contexto → peça de live. | Chamado por conteúdo atual. | E3/A1/P3 |
| stories_sequence | Planeja sequência de stories. | Agente de sequência social. | Contexto → peça de stories. | Conteúdo o chama e persiste. | E3/A1/P3 |
| content_calendar | Calendaria conteúdo. | Arquivo especializado com executor chamável. | Contexto → calendário estruturado. | O calendário ativo é produzido por `social_media`; não foi encontrado call site do executor desta role. | E2/A2/P2 |
| hook_factory | Sintetiza ganchos da camada psicológica. | Executa após especialistas predecessores. | Saídas A+B → ganchos para campanha/conteúdo. | Chamado no command e conteúdo atuais. | E3/A2/P3 |
| campaign_emotional_arc | Mapeia progressão emocional. | Gerador de arco em fases. | Intake/estratégia → arco injetado em agentes de conteúdo. | Chamado por conteúdo e persistido em `brainData`. | E3/A1/P3 |
| emotional_coherence_checker | Verifica coerência emocional. | Validador de narrativa. | Peças/contexto → checagem para conteúdo. | `content.service.ts` o chama; resultado é consumidor interno. | E3/A1/P3 |
| social_media | Monta calendário e posts sociais. | Agente com validação de calendário. | Contexto → `content_calendar` para aprovação/reparo. | Ativo em conteúdo; saída vazia é rejeitada. | E3/A1/P3 |

### D4 — Aquisição e Distribuição

| Role | O que faz | Como faz/especialização observada | Entrada → saída/consumidor | Conexão e atividade atual | E/A/P |
|---|---|---|---|---|---|
| media_buyer | Planeja orçamento e veiculação. | Especialista produz alocação, escala e cortes. | Estratégia+targeting → `media_buying_plan`. | Conteúdo chama condicionalmente e persiste para aprovação. | E3/A1/P3 |
| targeting | Configura audiências e UTMs. | Faz chamadas focadas Meta/Google/TikTok. | Perfil/orçamento → `targeting_config`, usado pelo media buyer. | Conteúdo chama e passa resumo explicitamente ao próximo agente. | E3/A1/P3 |
| landing_page | Estrutura página de vendas. | Agente CRO com contrato de seções. | Estratégia/perfil → `landing_page_structure`. | Conteúdo persiste/reprocessa; não publica página por si. | E3/A2/P3 |
| affiliate_campaign | Planeja campanha de afiliados. | Arquivo especializado chamável. | Briefing → plano de afiliados. | Não foi encontrado call site de workflow; uso direto/experimental. | E2/A2/P2 |
| launch_sequence_builder | Monta sequência de lançamento. | Agente de sequência. | Contexto → sequência consumida por rota/serviço. | Integração estática em rota de sequências. | E3/A2/P3 |
| prelaunch_warming | Prepara aquecimento pré-lançamento. | Agente de conteúdo de warming. | Contexto → peça/ações de aquecimento. | `content.service.ts` tem call site atual. | E3/A1/P3 |
| semente_launch | Planeja lançamento semente. | Especialista de rota alternativa. | Dados da campanha → plano semente. | Command o chama condicionalmente para esse tipo. | E3/A2/P3 |
| presence_planner | Planeja presença social contínua. | Agente de planejamento always-on. | Perfil/canais → plano para `social-presence.service`. | Serviço específico é consumidor atual. | E3/A1/P3 |
| bio_optimizer | Otimiza bio/perfil social. | Role de gateway usada pelo serviço social. | Dados de perfil → sugestão de bio. | `social-presence.service` a chama; não prova publicação. | E3/A1/P3 |
| organic_traffic | Planeja tráfego orgânico. | Agente de crescimento orgânico. | Contexto → recomendações/peças de conteúdo. | Chamado por `content.service.ts`. | E3/A2/P3 |
| reengagement | Desenha reengajamento. | Arquivo especializado chamável. | Briefing → plano de recuperação de audiência. | Sem integração encontrada; uso direto/experimental. | E2/A2/P2 |
| email_architect | Desenha arquitetura de e-mail. | Especialista de sequência também usado pelo helper `item-copy`. | Item da sequência → subject/body/CTA consumidos pela launch sequence. | `launch-sequence.service` chama `item-copy`, que usa esta role. | E3/A2/P3 |
| whatsapp_response | Prepara resposta de WhatsApp. | Agente para mensageria. | Contexto/mensagem → resposta do serviço WhatsApp. | Serviço específico integra a role; ação de envio não é atribuída à LLM. | E3/A2/P3 |

### D5 — Conversão, Atendimento e Comunidade

| Role | O que faz | Como faz/especialização observada | Entrada → saída/consumidor | Conexão e atividade atual | E/A/P |
|---|---|---|---|---|---|
| crisis_response | Orienta resposta a crise. | Especialista decisor chamável. | Situação → recomendação de crise. | Nenhum call site de workflow encontrado; uso direto/experimental. | E2/A1/P2 |
| sales_warmer | Prepara aquecimento de lead. | Role de vendas no gateway. | Dados de lead → sugestão para time de vendas. | `sales-team.service` é consumidor específico. | E3/A2/P3 |
| sales_desire | Desenvolve desejo de compra. | Role de vendas no gateway. | Contexto do lead → mensagem/argumento. | Integrada ao serviço de vendas. | E3/A2/P3 |
| sales_closer | Sugere fechamento consultivo. | Role de fechamento no gateway. | Lead/conversa → próxima abordagem. | Serviço de vendas a chama; fechamento externo não é verificado por role. | E3/A2/P3 |
| sales_objection | Trata objeções de venda. | Role de objeções no gateway. | Conversa → resposta recomendada. | Consumida por `sales-team.service`. | E3/A2/P3 |
| sales_consultant | Apoia venda consultiva. | Role de consultoria no gateway. | Contexto de lead → orientação de venda. | Integração estática no serviço de vendas. | E3/A2/P3 |
| buyer_onboarding | Propõe onboarding pós-compra. | Executor especializado chamável. | Dados de comprador → plano de onboarding. | Não há call site de workflow encontrado. | E2/A1/P2 |
| domino | Faz julgamento do núcleo Domino. | Agente decisor especializado. | Contexto → decisão/saída Domino. | Arquivo existe, mas integração atual não foi encontrada. | E2/A1/P2 |
| identity_architect | Trabalha posicionamento/identidade pessoal. | Executor especializado chamável. | Briefing → orientação de identidade. | Sem call site atual encontrado. | E2/A1/P2 |
| mental_frequency_coach | Oferece orientação de mentalidade. | Executor especializado chamável. | Contexto → recomendação de coaching. | Sem integração de workflow encontrada. | E2/A1/P2 |
| obstinacy_trainer | Propõe treino de persistência. | Executor especializado chamável. | Contexto → orientação de treino. | Sem call site atual encontrado. | E2/A1/P2 |
| continuous_sales_manager | Orquestra vendas contínuas. | Orquestrador de operação de vendas. | Campanha → plano/continuidade comercial. | Command o chama no fluxo atual. | E3/A1/P3 |

### D6 — Operações, Medição e Continuidade

| Role | O que faz | Como faz/especialização observada | Entrada → saída/consumidor | Conexão e atividade atual | E/A/P |
|---|---|---|---|---|---|
| command | Avalia prontidão e coordena campanha. | Orquestrador chama validadores e especialistas. | Intake → estado, checkpoints e próximos agentes. | Pipeline principal atual, com logs e retomada parcial. | E3/A2/P3 |
| memory_compression | Resume memória de campanha. | Agente Gemini de compressão. | Memória/contexto → resumo para command. | Call site atual no command. | E3/A1/P3 |
| optimization | Recomenda otimizações de métricas. | Agente analítico de melhoria. | Métricas → recomendações para serviço. | `metrics.service` é integração atual; aplicação automática não provada. | E3/A1/P3 |
| launch_debriefing | Faz debrief pós-lançamento. | Executor especializado chamável. | Dados do lançamento → debrief. | Nenhum workflow atual encontrado; uso direto/experimental. | E2/A2/P2 |
| integrations_specialist | Orienta integrações. | Role/provider no gateway para chat de integrações. | Pergunta → resposta de `integration-chat.routes`. | Rota de chat atual, não pipeline de campanha. | E3/A1/P3 |
| ux_simplification | Recomenda simplificação de UX. | Executor especializado chamável. | Contexto → recomendações de UX. | Sem call site integrado encontrado. | E2/A1/P2 |
| perpetual_launch_manager | Coordena lançamento perpétuo. | Orquestrador de continuidade. | Campanha → plano contínuo para command. | Chamado no command conforme tipo. | E3/A1/P3 |
| ab_test_designer | Desenha experimento A/B. | Executor especializado chamável. | Hipótese → desenho de teste. | Sem workflow encontrado; uso direto/experimental. | E2/A2/P2 |
| compliance | Revisa conformidade de conteúdo. | Validador especializado. | Peças/contexto → parecer para conteúdo/command. | Chamado por command e conteúdo atuais. | E3/A2/P3 |

## D) Cadeia audiovisual e editor interno

**Especialistas reais.** Há especialistas chamáveis em roteiro: `vsl-script.agent.ts`,
`cpl-script.agent.ts`, `webinar-script.agent.ts`, `live-script.agent.ts` e
`copywriter.agent.ts`; em estratégia/ganchos: `video-strategy.agent.ts`,
`video-hook.agent.ts` e `media-brief.agent.ts`; e em direção de cena:
`scene-director.agent.ts` (ATLAS), com apoio de `creative-director.agent.ts` e
`filming-brief.agent.ts`. Cinematografia, direção de imagem/fotografia, câmera,
luz, paleta e montagem/ritmo aparecem como competência textual na biblioteca/prompt
ATLAS de `artifacts/api-server/src/modules/agents/scene-director.agent.ts`, não como
especialistas executores independentes.

Há uma análise real, porém consultiva: `video-editor.routes.ts` extrai frames e usa
ATLAS para pontuar composição, iluminação, enquadramento e mood; o `director-chat`
aconselha sobre tomada, ritmo, cor e montagem. Isso não altera a mídia, não constitui
color grading executável e não equivale a direção fotográfica autônoma.

**Competências ausentes ou apenas textuais.** Não foram encontradas pipelines
dedicadas de figurino, direção de arte/set/props, atuação/blocking, direção de voz,
som, música/SFX, mix/master, continuidade, color grading executável ou QC audiovisual
verificável. ElevenLabs é apenas fluxo separado de clone de voz em
`video-generation.service.ts`; referências como `musicStyle` são textuais. Não há
teste de loudness, sincronismo, safe area, conform, continuidade entre cenas, LUT ou
aprovação humana formal de QC.

**Ensemble atual.** É um conjunto parcialmente coordenado, não um ensemble
cinematográfico por departamentos. `video-production.service.ts` cria projeto,
carrega contexto de campanha e chama CYRUS via `completeWithAgent("vsl_script")`;
depois chama `runSceneDirectorAgent` para storyboard. Não há loop colaborativo de
roteiro, fotografia, arte, som, atuação, montagem e revisão de dailies.

**Fluxo roteiro → provider.** Em
`artifacts/api-server/src/modules/video-production/video-production.service.ts`,
`createVideoProject` guarda seed de VSL e `generateScript` lê intake, estratégia,
audiência e oferta, grava roteiro e requer aprovação. `generateStoryboard` passa
roteiro, configuração, arco, tom, ritmo e paleta ao Scene Director. As cenas/prompt
seguem para `video-generation.service.ts`, que submete clips a Runway ou Kling; HeyGen
é para avatar/talking-head e há polling dos jobs. Providers geram clips, não a
montagem final.

**Fluxo upload → Smart Edit → FFmpeg.** Em
`artifacts/video-editor/src/App.tsx`, a UI envia takes para
`/video-editor/upload`; `video-editor.routes.ts` faz `ffprobe`, extrai áudio e
transcreve com Whisper. `/smart-edit` usa roteiro e transcrições timestampadas para
retornar um plano JSON de clips. A UI pode ajustar clips/legendas e `/process` corta
cada take, concatena e opcionalmente muxa SRT com FFmpeg, entregando MP4/WebM por job
em memória.

Não há ponte automática `video-production` → `video-editor`: storyboard/clips
gerados não viram timeline do editor nem export final por esse caminho. Também não há
timeline persistente, multitrack, keyframes, EDL/XML/OTIO, áudio multilayer ou
transições executáveis; os objetos `ClipSpec` e `SubtitleSpec` são payload efêmero.
O editor processa cortes, concatenação e legendas, sem Runway ou ElevenLabs; estes
providers geram clips/voz em subsistemas distintos. Assim, a qualidade “Hollywood”
não é comprovada: o que há é pré-produção promptada, geração de clips dependente de
provider e edição linear básica.

## E) Topologia de requisição

**LLM (decisão/geração).** HTTP ou chat entra por rota/serviço; wrappers
especializados ou `runAgent` montam contexto; o AI gateway escolhe
provider/modelo pelo `AGENT_PROVIDER_MAP`; a resposta é parseada e, quando há fluxo,
persistida ou entregue a um consumidor. Exemplo principal:
`HTTP/intake → command.agent.ts → runAgent/funções especializadas → ai-gateway →
provider → campaignsTable/campaign brain → próximo agente, aprovação ou UI`.

**Command/orquestração.** `command.agent.ts` chama validação mercadológica antes do
command, depois Governor, Profile Builder, Strategic Core/Doctrine, Strategy, Offer e
camada psicológica conforme condições. Há eventos, audit log, checkpoints em
`brainData`, retomada de passos e alguns caminhos de falha; isso não torna cada role
E4–E6 nem P4 automaticamente.

**Conteúdo.** `content.service.ts → executores de conteúdo → provider via gateway →
contentPiecesTable/mediaBriefsTable → aprovação, consumidor ou reprocessamento`.
O serviço valida contratos, registra eventos, usa heartbeat e possui retries/fallback
para certos erros. A saída de targeting é explicitamente consumida pelo media buyer.

**Social, paid media e domínios.** Serviços como `social-presence.service`,
`sales-team.service`, `metrics.service`, WhatsApp e rotas de integração chamam roles
ou consomem suas recomendações. Quando existir publisher/API externo, ele é executor
determinístico separado; plano LLM não prova que a ação, publicação ou métrica foi
verificada.

**Vídeo.** `video-production.service.ts → scene director/gateway → Runway, Kling ou
HeyGen` é a cadeia de geração de clips. Separadamente, `video-editor` recebe upload,
Whisper/Claude/ATLAS para análise ou plano, e FFmpeg para corte/concatenação/legenda.
FFmpeg é executor determinístico, não role LLM.

**Retries, logs e checkpoints.** O command salva checkpoint, lock e falhas por etapa;
conteúdo tem heartbeat, classificação de erro, reprocessamento e modo de fallback;
vídeo de produção tem estados e algumas chaves de idempotência. O editor mantém jobs,
arquivos e caches em memória e `/tmp`, portanto não fornece persistência/recovery
robustos de uma operação audiovisual.

## F) Cinco estados mutuamente exclusivos do censo

Classificação individual baseada nos call sites atuais, e não no README histórico.
“Conectados” inclui especialistas chamados hoje por command/conteúdo, como psychology,
Strategic Core/Doctrine e validadores. As contagens somam 79.

1. **Pipeline principal (38):** `command`, `strategy`, `offer`, `profile_builder`,
`strategic_core`, `strategic_doctrine`, `strategic_core_validation`,
`market_validator`, `offer_price_validator`, `brand_validator`,
`execution_governor`, `financial_projector`, `pricing_psychologist`,
`upsell_architect`, `scarcity_engineer`, `objection_killer`,
`testimonial_curator`, `hook_factory`, `launch_manager`, `semente_launch`,
`traffic_intelligence`, `business_intelligence`, `memory_compression`,
`continuous_sales_manager`, `perpetual_launch_manager`, `compliance`, `copywriter`,
`creative_director`, `ad_copy`, `video_strategy`, `media_brief`, `vsl_script`,
`cpl_script`, `webinar_script`, `live_script`, `stories_sequence`,
`emotional_coherence_checker`, `campaign_emotional_arc`.

2. **Domínio/serviço específico (22):** `market_intel`, `analytics`,
`creator_growth`, `conflict_detector`, `scene_director`, `email_architect`,
`social_media`, `media_buyer`, `targeting`, `landing_page`,
`launch_sequence_builder`, `prelaunch_warming`, `presence_planner`, `bio_optimizer`,
`organic_traffic`, `whatsapp_response`, `sales_warmer`, `sales_desire`,
`sales_closer`, `sales_objection`, `sales_consultant`, `optimization`.

3. **Direto/chat (7):** `creative_concept`, `ad_critic`, `video_hook`,
`affiliate_campaign`, `reengagement`, `content_calendar`,
`integrations_specialist`.

4. **Implementação chamável sem integração encontrada (10):**
`product_validator`, `crisis_response`, `buyer_onboarding`, `domino`,
`identity_architect`, `mental_frequency_coach`, `obstinacy_trainer`,
`launch_debriefing`, `ux_simplification`, `ab_test_designer`.

5. **Somente gateway (2):** `product_builder`, `video`.

**Validação do censo:** 79 roles únicas listadas nas tabelas C; nenhuma role do
`AgentRole` ausente; estados 38 + 22 + 7 + 10 + 2 = **79**. A lista de oito auxiliares
permanece fora do censo: `avatar-voice-file`, `context-refinement`, `cpl-scripts`,
`ethics-autocorrect`, `filming-brief`, `item-copy`, `output-judge` e
`social-profile-analyzer`.

## G) Conclusão e decisões para a Etapa 2

O produto possui um mapa completo de 79 identidades de gateway e vários workflows
internos realmente conectados, sobretudo command, estratégia, oferta, psicologia e
geração de conteúdo. Isso é diferente de provar agentes autônomos: a maioria produz
plano, texto, validação ou estado interno; autoridade, executor, evidência externa e
recovery ainda são heterogêneos. Vídeo também contém geração e edição reais, porém em
cadeias separadas e sem pós-produção audiovisual profissional demonstrada.

Perguntas de decisão para a Etapa 2:

1. Quais saídas P3 devem virar ações externas com autoridade explícita e aprovação?
2. Para quais roles o contrato deve exigir input/output versionado, idempotência,
   observabilidade, retry/rollback e evidência E5?
3. O Master Plan deve se tornar o contrato soberano que liga decisão, executor,
   consumidor e checkpoint?
4. Quais domínios justificam operação autônoma e quais devem permanecer assistivos?
5. Vídeo deve priorizar uma ponte storyboard→clips→timeline persistente, ou primeiro
   o escopo de áudio, cor, continuidade e QC?

Validações executadas no snapshot-base: censo de 79 roles sem duplicatas, soma dos cinco estados
igual a 79 e `git diff --check` sem erros. Essas validações não foram usadas para
inferir atividade operacional.

## Atualização posterior — núcleo audiovisual

O snapshot-base permanece preservado para rastreabilidade. A implementação do
estúdio audiovisual adicionou sete roles operacionais: `art_direction`,
`wardrobe_appearance`, `performance_voice`, `sound_design`, `editor`,
`color_continuity` e `av_qc`. O total atual é **86 roles únicas**, todas com entrada
no provider map e no enum persistente. A cadeia persiste manifesto, assets, timeline,
renders, QC, revisões e correções; geração de mídia e FFmpeg continuam como
executores determinísticos separados dos agentes de decisão.