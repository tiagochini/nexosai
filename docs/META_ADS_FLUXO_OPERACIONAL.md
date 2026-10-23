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
- A falha de mensuração não desfaz uma captura concluída. Recibos guardam estados seguros e hashes; IP/UA consentidos não ficam em texto aberto. A fila abaixo mantém esses dados temporariamente criptografados para reenvio. A URL de origem enviada não inclui query string ou fragmento.
- As travas locais, modo de simulação, aprovação, lease, compensação e política de anúncios pausados permanecem. Nenhuma nova rotina ativa campanhas ou aprova planos automaticamente.

## Relatórios

`meta-reporting.domain.ts` classifica o evento pelo objetivo da campanha e pelo destino/promoted_object do conjunto observado na sincronização. Tráfego usa cliques no link; leads/cadastros/vendas usam os eventos correspondentes. Configurações de conversão não reconhecidas ficam indisponíveis, em vez de serem tratadas como Purchase.

Quando a Meta retorna nomes genéricos e de website para a mesma ação, o cálculo escolhe uma representação, priorizando a de website; não soma aliases. O relatório informa os tipos de ação usados na resposta da API. Valor de compra e ROAS só aparecem para Purchase e quando há valor disponível. Falta de métrica aparece como `null`/“—”, não como um zero presumido.

O relatório usa somente anúncios, uma conta/moeda por consulta e separa janelas de atribuição. Assim não soma novamente gastos e conversões dos níveis de campanha e conjunto. O agregado de `conversions` persistido pela sincronização passa a seguir o evento identificado; cliques não são gravados como conversões. Registros antigos precisam de nova sincronização para ganhar essa classificação.

A classificação é uma fotografia da configuração observada na sincronização, não um histórico certificado de mudanças feitas fora do NexOS. Atribuição permanece a da Meta (`provider_default` quando não informada). Este relatório não declara receita de CRM, EMQ nem deduplicação confirmada. A reconciliação CRM separada está descrita abaixo.

## Reenvio persistente do CAPI

Novos eventos server com consentimento e chaves válidas persistem um envelope AES-256-GCM antes de qualquer chamada ao provedor. Ele contém o evento normalizado, com e-mail/telefone já em hash e IP/user-agent temporariamente criptografados, sem credenciais. Usa a chave `INTEGRATION_TOKEN_ENCRYPTION_KEY` e suporta as chaves anteriores da integração. O envelope é apagado ao concluir ou encerrar o envio; o recibo sanitizado permanece.

O scheduler `paid-media-capi`, independente do sync de anúncios, consulta a fila a cada minuto. Um claim atômico com lease de cinco minutos e contador de tentativas impede workers concorrentes de enviar a mesma tentativa; respostas de um lease antigo não sobrescrevem o novo estado. A requisição CAPI tem timeout de 60 segundos. Falhas transitórias (429, 5xx, erro de transporte ou aceitação ambígua) usam o mesmo nome, ID, horário, URL e dados já normalizados, sem hash duplo. A política local limita a cinco tentativas e 24 horas, com esperas de 1, 5, 15 e 60 minutos. Falhas definitivas de autorização/validação encerram a fila. Recibos históricos sem envelope não são reprocessados automaticamente.

Essa política não comprova deduplicação na Meta nem garante entrega. Eventos encerrados ficam visíveis como failed/capability_blocked; o diagnóstico também informa queued. O prazo é de elegibilidade para envio e a limpeza ocorre no primeiro tick após expirar; um worker desligado adia a limpeza física. A aplicação precisa da migration `0073_paid_media_capi_retry.sql` antes do deploy. Nenhuma migration foi aplicada ao banco real nesta execução.

## Reconciliação CRM

`GET /paid-media/attribution/reconciliation` retorna `groups` por conta/moeda e `excludedFromPaidMetrics` por moeda. A resposta substitui os totais monetários globais antigos. `accountId` é um filtro opcional; a aba Resultados consulta a conta escolhida. A consulta usa anúncios diários, remove cópias da mesma entidade/data pela sincronização mais recente e escolhe uma única janela por conta/moeda (padrão/null primeiro, senão ordem lexical), informando as demais como ignoradas.

CPA/ROAS usam somente conversões reconciliadas, com touchpoint anterior à conversão, vinculadas à mesma conta e moeda do gasto. Conversões sem conta, sem gasto correspondente, em outra moeda ou sem vínculo válido ficam fora dos indicadores pagos. Não há soma de moedas nem conversão cambial. Os valores são totais do período, não coortes: CRM usa datas UTC e a mídia preserva a data no fuso da conta. A atribuição CRM não certifica a atribuição da Meta. O filtro por conta exclui registros sem conta; consulte sem filtro para auditar esses registros do workspace.

## Revisão de landings publicadas

Na própria campanha, edite e salve o plano, mantendo o domínio publicado. “Gerar prévia da revisão” cria uma revisão imutável, sem alterar a página pública. A prévia usa iframe sem execução de scripts; seus pixels e formulários não enviam eventos. “Aprovar e publicar esta revisão” envia o ID e o hash dessa prévia, preservando página, campanha e URL.

A publicação usa transação e bloqueio de campanha/página, verifica hash/base publicada, plano salvo, data planejada, estrutura ainda aprovada, DNS, dataset Meta, sequência e compatibilidade com o contrato de anúncios atual. Uma mudança exige nova prévia. A mesma revisão publicada tem resposta idempotente. O deploy legado não aceita revisões desse fluxo. Ao publicar, a chave pública de eventos é renovada: clientes com HTML antigo deixam de ser aceitos no endpoint server. A aprovação fica registrada com o usuário e hash no audit log. Nenhuma landing real foi publicada nesta execução.

## Limitações restantes

- EMQ, deduplicação efetiva e recebimento no Events Manager continuam pendentes de verificação na Meta; ID compartilhado e recibo de aceitação não comprovam esses resultados.
- Páginas já publicadas precisam de uma revisão aprovada pelo novo fluxo para incorporar o script novo. Esta tarefa não publicou nem alterou páginas reais.
- Recibos CAPI antigos, falhas definitivas e eventos fora do prazo não são reenviados automaticamente. Uma nova captura duplicada não recria a conversão antiga.
- A conexão implementada é Meta CAPI. O Pixel TikTok existente permanece browser; ele não ganhou envio server nesta tarefa. Compras não são simuladas a partir de cadastro.
- Continuam fora do executor: públicos Custom/Lookalike/CRM, Advantage+ Audience configurável, placements manuais, anúncios de vídeo/catálogo, aplicativos, mensagens e categorias especiais.
- A validação final de permissões, disponibilidade por conta, imagem, domínio/HTTPS e payloads depende da homologação autorizada. O cadastro local do pixel não prova acesso ao ativo.

## Verificação local

Usar as dependências instaladas e banco fictício, sem conexão com a Meta:

```powershell
$env:pnpm_config_verify_deps_before_run='false'
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/meta_unit_tests'
pnpm --filter @workspace/api-server test:meta-operational-flow
pnpm --filter @workspace/api-server test:meta-reliability
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

O teste de confiabilidade acrescenta criptografia/escopo do envelope, replay exato, recuperação antes do primeiro envio, concorrência/lease, resposta tardia, erro transitório/definitivo, consentimento, expiração, grão/moeda/vínculo CRM e hash/base da revisão. O serviço real de revisão também é exercitado com transação mockada para provar ausência de alteração pública na prévia, rejeição de mudanças e publicação idempotente na mesma URL. A migration nova foi revisada como arquivo, sem execução em banco real; esses mocks não substituem validação de SQL/locks em PostgreSQL de homologação.

Referências oficiais consultadas: [evento CAPI e identidade browser/server no SDK Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event.py), [campos de estatísticas de ações](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsactionstats.py). Os campos específicos efetivamente retornados precisam ser confirmados na conta; a implementação não declara homologação por existir no SDK.

Todos esses testes e os dois checks de tipos passaram nesta sessão. O teste de logs precisou de execução fora do sandbox para conectar ao servidor temporário de loopback; ele não usou banco ou provedor real.
