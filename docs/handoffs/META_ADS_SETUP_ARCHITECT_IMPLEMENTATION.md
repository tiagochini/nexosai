# Próximo chat: implementar o agente arquiteto de setup Meta Ads

Use este documento como prompt de execução no novo chat, com o repositório NexOS aberto. O objetivo é implementar o treinamento anexado no agente de mídia paga existente e integrar a saída dele ao fluxo de campanha. **Faça commit local das alterações próprias desta tarefa e não faça push.**

## Fonte de requisitos

Leia o documento completo do usuário em:

`C:\Users\tiago\.codex\attachments\64d3cccd-ab0d-4171-81f7-2163723548a6\Texto colado.txt`

Ele define o “Agente de IA Especialista em Setup de Meta Ads de Elite”: missão, sete perguntas diagnósticas, regras de decisão por volume/qualidade de tracking/tipo de negócio, processo em seis fases, saída em dez seções, guardrails e exemplos. Trate-o como requisito de produto para adaptar ao NexOS. Não cole cegamente o texto todo em um prompt se já houver contratos, políticas ou fontes canônicas que devam ser compostos.

## Primeiro: mapear o sistema atual

Leia `AGENTS.md` e instruções locais aplicáveis. Faça `git status` e revise diffs antes de editar. Há alterações de organização de documentação pendentes nesta árvore; preserve-as e **não inclua no commit**. Não restaure, reescreva, faça staging amplo ou descarte arquivos de outras tarefas.

Localize a fonte canônica do prompt/identidade e da base de conhecimento do agente. Pontos iniciais para investigação, que podem ter mudado:

- `artifacts/api-server/src/modules/agents/media-buyer.agent.ts`
- `artifacts/api-server/src/modules/agents/traffic-intelligence.agent.ts`
- `artifacts/api-server/src/modules/agents/cognitive-identity-system.ts`
- `artifacts/api-server/src/modules/paid-media/meta-launch.policy.ts`
- `artifacts/api-server/src/modules/paid-media/meta-assets.policy.ts`
- contratos, schemas, montagem do Master Plan e UI de planos de mídia paga.

Não duplique o agente se o NexOS já tiver um especialista adequado. Defina se o treinamento pertence ao Media Buyer, Traffic Intelligence ou a uma capacidade dedicada; escolha uma única fonte canônica e componha as instruções existentes sem apagar guardrails de consentimento, aprovação, autorização, créditos ou escopo por workspace.

## Comportamento que precisa existir

1. **Diagnóstico obrigatório antes do setup final.** Coletar e persistir, com origem e grau de confiança quando disponíveis: conversões de otimização por semana nos últimos 14–30 dias; estado/qualidade do Pixel e CAPI, deduplicação e comparação com backend; capacidade realista de produção criativa; orçamento mensal e diário; tipo de negócio e ciclo de venda; maturidade/fase da conta; restrições legais, de marca, região e posicionamento.
2. **Lacunas explícitas.** Quando dados críticos estiverem ausentes ou incertos, pedir as informações necessárias antes de emitir recomendação final. Não inventar conversões, Event Match Quality (EMQ), ROAS, CPA, volume, tamanho de audiência, configurações da conta ou status de tracking. Permitir diagnóstico preliminar identificado como incompleto, sem habilitar execução.
3. **Decisão contextual e justificável.** Adaptar concentração de campanhas/conjuntos, testes ABO, scaling CBO/Advantage+ Campaign Budget, remarketing e retenção à evidência do cliente. Expor os motivos, pressupostos, riscos e alternativas. Não impor todas as estruturas sugeridas pelo material se budget, volume, ciclo ou capacidade não justificarem.
4. **Tracking como gate de prontidão.** Distinguir evidência real de Pixel, CAPI, parâmetros, `event_id` e deduplicação. Se EMQ não vier de fonte Meta confiável, mostrar “não verificado”; um cálculo interno não pode ser rotulado como EMQ. Tracking fraco deve reduzir a prontidão para escala e gerar ações corretivas.
5. **Arquitetura técnica separada por nível.** Quando suportado pelo contrato e pela API, representar campanha, conjuntos e anúncios, objetivo, evento de otimização, orçamento ABO/CBO, bid strategy, público e exclusões, placements, Brand Safety e opções de criativo. Validar compatibilidades antes de compilar um plano de lançamento. Para capacidade inexistente ou não autorizada pela Meta/conta, indicar limitação sem alegar configuração.
6. **Criativo e otimização com controle.** Recomendar ângulos e volume compatíveis com a capacidade declarada; especificar hipótese, variável, métrica, janela, amostra/limite e critério de decisão. Não prometer significância sem volume. Regras automáticas devem ser conservadoras, justificadas, auditáveis e sujeitas às políticas e aprovações existentes.
7. **Plano acionável e legível.** A recomendação final deve seguir as dez seções do documento fonte: (1) resumo executivo, (2) diagnóstico das sete perguntas, (3) arquitetura recomendada, (4) configuração por Campaign → Ad Set → Ad, (5) públicos/exclusões, (6) Advantage+ Creative, (7) otimização/learning, (8) checklist, (9) riscos, (10) próximos passos em 7 e 14 dias. Se uma seção não se aplicar, justificar em vez de omitir silenciosamente.
8. **Separar recomendação de execução.** O agente pode propor o setup; a execução só usa configurações aprovadas e capacidades reais do NexOS. Preserve dry-run, revisão humana, idempotência, auditoria/readback e os anúncios pausados exigidos pelo fluxo atual. Não publicar, ativar campanha, alterar conta Meta, enviar dados reais ou gerar gasto como parte desta implementação.

## Tratamento de afirmações sujeitas a mudança

O treinamento contém heurísticas numéricas e afirmações com data (por exemplo, faixas semanais de conversões, EMQ, learning phase, recursos Advantage+, enhancements, Customer Lifecycle Strategy e disponibilidade de API). Antes de transformar qualquer uma em regra ou validação técnica:

- confira a documentação oficial atual da Meta e o contrato/versão de API usado pelo NexOS;
- classifique cada item como regra técnica da API, heurística de mídia ou preferência configurável;
- mantenha heurísticas como recomendações ajustáveis e explicáveis, nunca como fatos universais ou bloqueios rígidos sem evidência;
- registre quando a conta/versão da API não expõe a informação;
- não envie identificadores de pessoas para a Meta sem base de consentimento e política já implementadas.

Não use o texto anexado como fonte para afirmar que uma configuração foi executada ou aprovada pela Meta.

## Testes e critérios de aceite

Adapte os testes ao padrão existente e cubra, no mínimo:

- dados completos permitem gerar recomendação estruturada com as dez seções;
- volume baixo concentra sinal e evita fragmentação injustificada; volume maior permite testar mais, sem virar obrigação;
- negócio local, e-commerce, lead generation e high-ticket recebem decisões diferentes;
- tracking ausente/fraco impede recomendação de scaling agressivo e deixa EMQ como não verificado quando não houver fonte real;
- campos críticos ausentes resultam em perguntas de esclarecimento e estado incompleto, sem inventar dados;
- restrições de marca limitam as recomendações de criativo/placements;
- orçamento, objetivo, evento e modo ABO/CBO incompatíveis são bloqueados antes de chamadas ao provedor;
- saída do agente não consegue contornar revisão humana, autorização, escopo ou criação pausada;
- textos e estruturas legadas que dependem do agente continuam compatíveis ou são migrados com regressão coberta.

Rode testes direcionados, typecheck e build aplicáveis. Use mocks nos testes; nenhuma chamada real que altere ativos Meta ou consuma verba. Atualize a documentação canônica do agente e a capacidade/UI se a linguagem atual prometer recursos que continuam indisponíveis. Informe separadamente implementação local e homologação externa pendente.

## Commit

Antes do commit, confira `git status`, `git diff` e `git diff --cached`. Faça staging somente dos arquivos novos/alterados por esta implementação (agente, contratos, testes e documentação direta). Preserve fora do commit as alterações pendentes de organização de `docs/evidence` e qualquer outro trabalho preexistente. Crie um commit local com mensagem clara e **não execute `git push`**.

Na resposta final, descreva o comportamento implementado, os arquivos principais, testes e resultados, hash do commit, limites de API/conta e o que ainda depende de validação real. Confirme explicitamente que não houve push nem alteração em ativos ou gastos Meta.
