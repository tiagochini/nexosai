# Meta Ads: configuração, landing/CAPI e resultados por objetivo

Implementação local de 23/10/2026, posterior ao commit `3431da78`. Não inclui homologação, publicação ou operação em conta real.

## Como usar

1. Abra a estratégia da campanha e expanda **Configuração dos anúncios Meta**. Escolha a conta autorizada, pixel, objetivo/evento, orçamento ABO/CBO diário ou do período, destino, país/idades, Página do Facebook, imagem e texto. A conta precisa estar selecionada em Mídia paga. É possível registrar o ID de um pixel existente na própria tela; esse cadastro é somente local e não instala nem cria ativos na Meta.
2. Salve. A configuração entra no briefing executável e em uma nova versão do Master Plan. Versões anteriores, inclusive pendentes, são substituídas para não autorizar o lançamento com dados antigos. Revise o resumo da versão e aprove o Master Plan. Essa aprovação também pode ser feita pelo painel de anúncios, sem regenerar conteúdo de campanhas que já avançaram de fase.
3. Compile o plano de anúncios. A compilação continua sem chamadas à Meta. Em Mídia paga, revise bloqueios e simulação e aprove o plano de lançamento separadamente. A criação real continua sendo uma ação posterior, com validação de conta/pixel/orçamento e ativos pausados. Nada nessa implementação foi acionado em conta real.
4. Na configuração da landing aprovada, escolha o dataset Meta e o evento da captura (`Lead` ou `CompleteRegistration`). Se o Master Plan aprovado aponta para esse mesmo domínio, o servidor exige pixel/evento compatíveis antes de publicar. Novas publicações incorporam a conexão CAPI; páginas já publicadas não são reescritas automaticamente.
5. Em **Mídia paga → Resultados**, escolha conta e período. Sincronize a conta antes de consultar períodos que ainda não tenham métricas ou registros anteriores a esta versão.

## Contratos e segurança preservados

- `paid-media-setup.service.ts` valida os campos, escopo da conta/dataset e moeda. A gravação usa `jsonb_set` e transação para preservar outros campos do briefing e invalidar versões antigas. A aprovação usa a mesma trava da campanha e compara os dados atuais com o snapshot, impedindo restaurar uma aprovação antiga em uma corrida com edição/materialização. Não modifica as alterações locais da tarefa de diagnóstico social.
- `materializeMasterplan` incorpora a configuração explícita em `snapshot.strategy.paidMedia` e as datas em `snapshot.campaign`. O conteúdo entra no hash/aprovação. `approvedAccountId` impede compilar para outra conta sem revisão.
- A edição do formulário bloqueia a aprovação na tela até salvar. O painel mostra o resumo executável da versão atual; salvar, aprovar o Master Plan, compilar e aprovar o lançamento são ações distintas.
- A publicação gera uma chave pública aleatória limitada à página. Ela não é token da Meta nem chave genérica de ingestão do dataset. O endpoint de PageView verifica página publicada, chave, origem e dataset do workspace; o Lead também precisa corresponder à sequência da página.
- Requisições públicas feitas no mesmo domínio HTTPS verificado da landing passam pela política de origem. A exceção é restrita aos endpoints públicos de evento/captura e não amplia o CORS das APIs autenticadas.
- Sem consentimento de marketing, a landing não dispara Pixel nem CAPI. O consentimento para contato do formulário permanece separado. Leads/cadastros são enviados somente após captura bem-sucedida; duplicatas não geram nova conversão.
- PageView usa UUID por visita, com namespace da página, igual no Pixel e no CAPI. Lead/cadastro usa ID derivado da página e do contato, retornado pelo servidor ao navegador. Mesmo se o registro do recibo falhar após envio, o ID devolvido continua o mesmo, evitando criar outro ID no browser.
- A falha de mensuração não desfaz uma captura concluída. Recibos guardam estados seguros e hashes; IP/UA consentidos podem compor o envio CAPI, mas não são persistidos nos novos recibos de mídia paga. A URL de origem enviada não inclui query string ou fragmento.
- As travas locais, modo de simulação, aprovação, lease, compensação e política de anúncios pausados permanecem. Nenhuma nova rotina ativa campanhas ou aprova planos automaticamente.

## Relatórios

`meta-reporting.domain.ts` classifica o evento pelo objetivo da campanha e pelo destino/promoted_object do conjunto observado na sincronização. Tráfego usa cliques no link; leads/cadastros/vendas usam os eventos correspondentes. Configurações de conversão não reconhecidas ficam indisponíveis, em vez de serem tratadas como Purchase.

Quando a Meta retorna nomes genéricos e de website para a mesma ação, o cálculo escolhe uma representação, priorizando a de website; não soma aliases. O relatório informa os tipos de ação usados na resposta da API. Valor de compra e ROAS só aparecem para Purchase e quando há valor disponível. Falta de métrica aparece como `null`/“—”, não como um zero presumido.

O relatório usa somente anúncios, uma conta/moeda por consulta e separa janelas de atribuição. Assim não soma novamente gastos e conversões dos níveis de campanha e conjunto. O agregado de `conversions` persistido pela sincronização passa a seguir o evento identificado; cliques não são gravados como conversões. Registros antigos precisam de nova sincronização para ganhar essa classificação.

A classificação é uma fotografia da configuração observada na sincronização, não um histórico certificado de mudanças feitas fora do NexOS. Atribuição permanece a da Meta (`provider_default` quando não informada). Este relatório não declara receita de CRM, EMQ nem deduplicação confirmada. O endpoint legado de reconciliação CRM não foi redesenhado nesta etapa.

## Limitações restantes

- EMQ, deduplicação efetiva e recebimento no Events Manager continuam pendentes de verificação na Meta; ID compartilhado e recibo de aceitação não comprovam esses resultados.
- Páginas já publicadas precisam de uma nova revisão/publicação pelo fluxo existente para incorporar o script novo. Esta tarefa não publicou nem alterou páginas reais.
- Falhas/aceitações ambíguas de CAPI continuam registradas para recuperação; não foi acrescentada uma fila de reenvio automático. Uma nova captura duplicada não reenvia uma conversão antiga.
- A conexão implementada é Meta CAPI. O Pixel TikTok existente permanece browser; ele não ganhou envio server nesta tarefa. Compras não são simuladas a partir de cadastro.
- Continuam fora do executor: públicos Custom/Lookalike/CRM, Advantage+ Audience configurável, placements manuais, anúncios de vídeo/catálogo, aplicativos, mensagens e categorias especiais.
- A validação final de permissões, disponibilidade por conta, imagem, domínio/HTTPS e payloads depende da homologação autorizada. O cadastro local do pixel não prova acesso ao ativo.

## Verificação local

Usar as dependências instaladas e banco fictício, sem conexão com a Meta:

```powershell
$env:pnpm_config_verify_deps_before_run='false'
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/meta_unit_tests'
pnpm --filter @workspace/api-server test:meta-operational-flow
pnpm --filter @workspace/api-server test:paid-media-events
pnpm --filter @workspace/api-server test:paid-media-launch
pnpm --filter @workspace/api-server test:paid-media
pnpm --filter @workspace/api-server exec tsx src/scripts/test-landing-materializer.ts
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/app typecheck
pnpm --filter @workspace/api-server test:masterplan-unit
pnpm --filter @workspace/api-server test:integration-security
pnpm --filter @workspace/api-server test:log-security
```

O teste operacional executa o JavaScript real da landing em VM com DOM/rede simulados e verifica consentimento, PageView único, IDs compartilhados, Lead/CompleteRegistration e supressão de duplicatas. Também exercita persistência transacional mockada da configuração, isolamento conta/dataset, substituição de aprovação e relatórios com aliases, moedas e níveis diferentes. O teste de recibos exercita os serviços reais da landing/CAPI com persistência e provedor mockados.

Referências oficiais consultadas: [evento CAPI e identidade browser/server no SDK Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event.py), [campos de estatísticas de ações](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsactionstats.py). Os campos específicos efetivamente retornados precisam ser confirmados na conta; a implementação não declara homologação por existir no SDK.

Todos esses testes e os dois checks de tipos passaram nesta sessão. O teste de logs precisou de execução fora do sandbox para conectar ao servidor temporário de loopback; ele não usou banco ou provedor real.
