# Meta Ads: relatórios avançados

Implementação local de 24/10/2026. Esta atualização acrescenta uma consulta de leitura em **Mídia paga → Resultados → Relatório detalhado — consulta Meta**. O relatório por objetivo, baseado na sincronização diária, permanece disponível. Nenhuma consulta real à Meta, alteração de anúncio, deploy ou push foi realizada durante esta implementação.

## Recursos

| Área | Campos |
| --- | --- |
| Entrega e custos | Gasto, impressões, alcance, frequência, cliques totais, cliques no link, CTR total, CPC total e CPM |
| Funil e retorno | Leads, cadastros, AddToCart, InitiateCheckout, Purchase, valor de compras, CPL, CPA de Purchase e ROAS de Purchase |
| Vídeo | Reproduções retornadas em video_play_actions, visualizações a 75% e ThruPlay |
| Qualidade | quality_ranking, engagement_rate_ranking e conversion_rate_ranking, quando retornados pela Meta |
| Detalhamentos | Anúncio no período, idade/gênero, plataforma/posição, plataforma, hora no fuso da conta ou anúncio por dia com indicação do dia da semana |
| Atribuição da leitura | Configuração da conta Meta ou uma janela explícita: 1-day click, 7-day click ou 1-day view |

A atribuição escolhida modifica somente a consulta. Não altera configurações de campanha/conjunto, lances, orçamento ou entrega. Não são somadas janelas sobrepostas; combinações customizadas de janelas não foram implementadas. action_report_time é fixado em impression para manter o mesmo critério no resumo e nas linhas.

O contrato limita o período a 31 dias inclusivos. Cada clique em **Consultar Meta** faz uma nova consulta; não há polling, repetição automática, refetch ao focar a janela ou uso silencioso de um relatório antigo como nova resposta. A listagem de contas continua sendo uma leitura local. Uma falha na consulta não apresenta o resultado anterior como se fosse o atual.

## Grão e significado dos números

O resumo vem de uma consulta dedicada no nível account, com o período inteiro e sem breakdown. As linhas vêm do nível ad, com os filtros escolhidos. O código não soma alcance entre anúncios/dias/segmentos e não calcula frequência ou rankings por média. Pessoas podem aparecer em vários anúncios ou segmentos; somar suas linhas não produz alcance único da conta.

Resumo e detalhamento são consultas separadas, não um snapshot atômico da Meta. Atualizações de atribuição, modelagem, privacidade e elegibilidade podem produzir diferenças entre os números. A data de consulta, período, conta, moeda, fuso e janela são exibidos. complete refere-se ao término da paginação retornada, sem certificar a ausência de supressão de dados pela Meta.

As taxas CTR/CPC/CPM usam o valor retornado quando válido, com cálculo a partir de gasto/cliques/impressões quando o campo está ausente. CPL, CPA e ROAS usam os dados daquele grão e janela. Divisão por zero, valores inválidos ou métricas ausentes retornam null, exibido como **—**. Receita ausente não vira zero só porque há compras conhecidas.

Aliases de ações podem descrever o mesmo evento; o código escolhe uma representação preferida, sem somá-las. São priorizados os aliases de website documentados no código, com alternativa genérica quando disponível. Eventos atribuídos em Insights não são recibos CAPI nem vendas confirmadas no CRM. Não há mistura de moeda nem combinação de campanha/conjunto/anúncio para produzir um total.

## Limites dos detalhamentos

- Rankings são solicitados apenas no anúncio sem breakdown. Valores indisponíveis, históricos não elegíveis ou restrições da Meta permanecem indisponíveis; não se fabrica um score.
- No detalhamento por hora, alcance, frequência e campos de vídeo são omitidos das linhas. O resumo da conta mantém sua consulta independente do período. A hora usa o fuso do anunciante, não o fuso do servidor.
- No modo diário, cada linha deve retornar uma única data. O dia da semana é derivado dessa data de relatório, sem deslocá-la pelo fuso local da aplicação. Não há soma de alcance por dia da semana.
- Reproduções, visualizações a 75% e ThruPlay têm nomes próprios. **video_play_actions não é rotulado como visualização de três segundos.** Essa métrica específica ainda precisa de mapeamento/validação oficial e homologação; não foi inferida de métricas diferentes.
- As combinações efetivamente aceitas dependem da Graph v26.0, da conta e das restrições de privacidade. Uma rejeição interrompe a consulta com mensagem acionável; nenhum filtro, campo ou janela é trocado automaticamente.
- O relatório não determina significância, fadiga, pausa ou escala por limites fixos. Critérios de otimização continuam sendo outro fluxo.

## Acesso e paginação

O endpoint autenticado GET `/api/paid-media/reports/meta-advanced` aceita somente a allowlist de filtros. Exige conta Meta selecionada do workspace e usa sua integração paga exata. Credenciais orgânicas não são alternativas. O transporte de Insights aceita somente GET na conta selecionada, sem payload de mutação. O serviço não grava relatórios, entidades, insights ou dados de negócio no banco.

Há limite de dez consultas por minuto por usuário/workspace. A paginação usa apenas cursores, com até 25 páginas e 5.000 linhas por consulta. URLs next retornadas pelo provedor não são seguidas. Cursor ausente/repetido, excesso de linhas, prazo excedido, agregado de conta dividido ou linha duplicada interrompem o relatório inteiro, sem sucesso parcial.

Um orçamento de tempo de 60 segundos é conferido entre páginas; uma chamada já em andamento pode terminar depois dele e seu resultado será rejeitado como incompleto. O transporte mantém seu próprio timeout. Conta, moeda, datas, IDs e dimensões retornados são validados antes de apresentar os dados. Erros refletidos do provedor não expõem tokens ou detalhes privados.

Não há migration ou política RLS nova nesta etapa: a consulta utiliza o cadastro existente da conta. As alterações preexistentes de outras tarefas foram preservadas.

## Validação

```powershell
$env:pnpm_config_verify_deps_before_run='false'
$env:DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/meta_unit_tests'
pnpm --filter @workspace/api-server test:meta-advanced-report
pnpm --filter @workspace/api-server test:meta-operational-flow
pnpm --filter @workspace/api-server test:meta-assets
pnpm --filter @workspace/api-server test:integration-security
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/app typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/app build
```

Os testes executam o serviço e o transporte com DB/HTTP simulados: isolamento e conta selecionada, integração paga exata, ausência de writes, campos/níveis de consulta, janela única, agregado de alcance/frequência, valores ausentes, aliases, paginação sem seguir URLs, duplicatas, escopo incompatível, excesso de linhas, restrições por hora/dia e ausência de fallback. O teste novo, as regressões listadas, a segurança de logs, os checks de tipos e os builds da API/app passaram. Eles não certificam disponibilidade da API real nem homologação de métricas.

## Referências oficiais consultadas

[AdsInsights no SDK oficial Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py) confirma campos, enums de breakdown e janelas. [AdAccount.get_insights](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py) confirma os parâmetros do endpoint. As páginas de referência em developers.facebook.com retornaram 429 nesta sessão. A presença no SDK não comprova aceitação de cada combinação pela conta; a homologação real permanece pendente.
