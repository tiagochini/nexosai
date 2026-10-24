# Meta Ads: contrato corrigido e validação local

Revisão: 23/10/2026. Sem homologação de criação em conta real nesta tarefa.

Atualização operacional: [configuração no produto, landing/CAPI e relatórios por objetivo](META_ADS_FLUXO_OPERACIONAL.md). As descrições de conexão e relatórios abaixo foram atualizadas para refletir essa etapa.

Atualização de ativos: [públicos, Advantage+ Audience, placements e anúncios de vídeo/catálogo](META_ADS_PUBLICOS_PLACEMENTS_E_CRIATIVOS.md). Implementação local com aprovação e execução explícitas; continua sem homologação na Meta.

## Fluxo e evidências de código

1. `modules/masterplan/masterplan.service.ts`, `materializeMasterplan`: o snapshot contém briefing, campanha, estratégia, oferta, targeting e timeline. A versão aprovada e seu hash são a autoridade. Prosa de estratégia não é configuração executável de anúncios.
2. `modules/paid-media/launch-plans.service.ts`, `compileMasterplanTree` / `compileLaunchPlan`: compila configuração explícita em árvore v2 e payload, guarda hash e bloqueios. `approveLaunchPlan` registra aprovação imutável. Versões v1 precisam ser recompiladas/reaprovadas; não há migração automática de autorização.
3. `activateLaunchPlan` revalida vínculo com o Master Plan, escopo da conta, moeda, integração e política de autonomia. `MetaAdsAdapter.preflightLaunch` consulta status/moeda atual, `/minimum_budgets`, acesso ao pixel e valida a campanha com `execution_options: ["validate_only"]` antes da primeira criação.
4. O executor cria campanha → conjunto → criativo → anúncio por etapas, com intenção durável, lease, leitura de confirmação e compensação. Campanha, conjuntos e anúncios permanecem **PAUSED**. Criativos não têm estado de veiculação pausável. `launchStage=active` significa estrutura criada e confirmada, não veiculação ativa; a interface foi corrigida. O método legado de criação em lote foi bloqueado.
5. `providers.ts` solicita campos específicos por tipo de ativo, evitando consultar orçamento/status de criativos. Insights usam `campaign_id`, `adset_id` ou `ad_id`; `paid-media.domain.ts` usa esses IDs para vincular os resultados locais. `sync.service.ts` observa CBO por orçamento positivo na campanha; campos ausentes não provam ABO.
6. `attribution.service.ts` registra recibos e envia somente eventos server com consentimento e identificadores aceitos. O registro guarda hashes, campos permitidos e estado real de entrega. Novos eventos elegíveis entram em fila criptografada para reenvio limitado da mesma ocorrência; claims/proprietário e IDs originais evitam envios concorrentes e troca de identidade. Recibos históricos sem envelope não são repetidos automaticamente. Um `eventId` reutilizado com outro nome é rejeitado; o esquema exige IDs únicos por ocorrência no dataset. Consulte o fluxo operacional para prazo e retenção.
7. `content/content.routes.ts` separa aprovação, configuração e publicação de landing. `landing-publication.service.ts` já publica HTML em domínio verificado e valida CTAs/pixel; portanto a afirmação do handoff de que publicação não existia não procede no código atual. O navegador envia PageView e Lead/CompleteRegistration com consentimento. Novas publicações com dataset Meta conectam PageView e Lead/CompleteRegistration ao CAPI, com consentimento e ID compartilhado. Publicações antigas não são alteradas automaticamente; publicar não comprova recebimento na Meta.

Os caminhos de módulos acima são relativos a `artifacts/api-server/src/`.

## Configuração aprovada

A tela de estratégia agora oferece Configuração dos anúncios Meta. Ela salva dados explícitos no briefing e materializa `strategy.paidMedia` na nova versão do Master Plan, exigindo nova aprovação. O compilador também aceita os campos legados equivalentes de campanha/targeting/tracking, mas não infere moeda, modo de orçamento ou categorias especiais de texto livre.

Exemplo do bloco `strategy.paidMedia` (IDs abaixo são ilustrativos):

```json
{
  "objective": "OUTCOME_LEADS",
  "destinationType": "WEBSITE",
  "destinationUrl": "https://exemplo.com/",
  "specialAdCategories": [],
  "budget": { "amount": 100, "kind": "daily", "mode": "abo", "currency": "BRL" },
  "tracking": { "pixelId": "123456", "conversionEvent": "Lead" },
  "audiences": [{ "geo_locations": { "countries": ["BR"] }, "age_min": 18, "age_max": 65 }],
  "creatives": [{ "object_story_spec": {
    "page_id": "987654",
    "link_data": { "link": "https://exemplo.com/", "message": "Texto aprovado", "image_hash": "HASH_APROVADO" }
  } }]
}
```

| Objetivo de website | Otimização | Cobrança | Conversão |
| --- | --- | --- | --- |
| OUTCOME_TRAFFIC | LINK_CLICKS | IMPRESSIONS | Sem promoted_object; não promete conversões |
| OUTCOME_LEADS | OFFSITE_CONVERSIONS | IMPRESSIONS | pixel_id e LEAD ou COMPLETE_REGISTRATION |
| OUTCOME_SALES | OFFSITE_CONVERSIONS | IMPRESSIONS | pixel_id e PURCHASE |

Outros objetivos, locais de conversão ou otimizações são bloqueados. Ausência de pixel ou evento incompatível bloqueia leads/vendas. Essa tabela é o contrato limitado do NexOS, sujeito à validação da Meta para a conta; a existência de um enum no SDK não garante elegibilidade.

ABO divide o total aprovado em unidades mínimas inteiras entre conjuntos, preservando a soma exata. CBO envia orçamento apenas na campanha. Ambos aceitam daily/lifetime; lifetime exige `campaign.startTime/endTime` ou `timeline.startTime/endTime`. O compilador suporta BRL/USD/EUR/GBP com duas casas decimais; outras moedas são bloqueadas. Campos de orçamento concorrentes e configurações desconhecidas são rejeitados, sem descarte silencioso. Não se usa R$ 80/100 ou um número de conversões como mínimo universal.

O pré-check usa o mínimo de impressões informado pela conta. Para lifetime, exige conservadoramente esse mínimo por dia ou fração do período. Sem mínimo consultável o lançamento é bloqueado. Validações adicionais específicas de objetivo, conjunto, criativo e conta ainda podem ser rejeitadas pela Meta: nesse caso o executor compensa os ativos pausados e não declara sucesso. O pré-check não prova elegibilidade futura nem substitui a leitura após criação.

Atualização: [CRM recorrente, engajamento, opções de creative e Experiments](META_ADS_CRM_AUTOMACOES_E_EXPERIMENTOS.md) documenta o contrato adicional e a migration 0075. Aquisição/retenção usam targeting explícito; Customer Lifecycle nativo continua fora do contrato.

## Capacidades e estados reais

| Item | Estado |
| --- | --- |
| Objetivos da tabela, ABO/CBO e anúncios de imagem/vídeo/catálogo | Implementados no contrato documentado de ativos; vídeo e catálogo/feed existentes, acesso e validação da Meta são necessários |
| Públicos | Países, idade 18–65 e gêneros 1/2 no modo original; Advantage+ usa o contrato de idade mínima sem máximo/gênero rígidos |
| Custom/Lookalike, listas CRM, Advantage+ Audience, placements manuais | Implementados com limites explícitos, aprovação, minimização de CRM e validação por conta; consultar a documentação de ativos. Nenhuma operação real foi executada nesta tarefa |
| Advantage+ Sales/Leads e Customer Lifecycle | Não são ativados nem certificados pelo NexOS; CBO não comprova ativação do conjunto de automações |
| Categorias especiais, apps, mensagens e formulários nativos | Não suportados neste contrato; exigem implementação própria |
| Pixel na landing | Configurado quando há dataset; browser condicionado ao consentimento; tracking não verificado |
| CAPI | `sent` significa recibo `events_received` da Meta, não atribuição/conversão confirmada |
| EMQ / deduplicação na Meta | Não consultados/verificados. `matchRate` (compatibilidade) e `localMatchKeyCoverage` medem apenas presença local de chaves |
| Eventos de teste CAPI | Não suportados; testEventCode/test_event_code são rejeitados para evitar envio acidental como produção |
| Estado da landing | draft → approved → configured → published, com tracking/CTA não verificados separadamente |
| Pausa de criativo | Não suportada; campanha/conjunto/anúncio são as fronteiras de segurança |

Deduplicação browser/server exige que a mesma ocorrência compartilhe `event_name` e `event_id`/Pixel `eventID`. A trava local de envio não comprova deduplicação no Events Manager. Os recibos existentes não são reescritos: os hashes/minimização valem para novas gravações. Não foi executada limpeza de dados antigos nesta tarefa.

Os relatórios preservam ações e valores brutos da Meta. A sincronização agora classifica resultados pelo objetivo/evento observado e a aba Resultados separa cliques, leads, cadastros e compras, usando somente o nível de anúncio; dados antigos exigem nova sincronização. Janela de atribuição continua `provider_default`; não se impôs 7 dias clique/1 dia visualização. Recomendações de learning phase, EMQ, volume, criativos e orçamento do texto de referência continuam recomendações operacionais, sem garantias no produto.

## Fontes oficiais consultadas

- [SDK oficial: AdSet](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adset.py): campos, destinos, optimization goals e validate_only.
- [SDK oficial: Campaign](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/campaign.py): objetivos, orçamento e bid strategy.
- [SDK oficial: AdAccount](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py) e [MinimumBudget](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/minimumbudget.py): consulta de mínimos por conta/moeda.
- [SDK oficial: evento server](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event.py): identidade compartilhada entre browser/server.

As páginas oficiais de referência em developers.facebook.com retornaram HTTP 429 nesta sessão. O SDK oficial confirmou nomes e campos, mas não certifica combinações para uma conta específica. A integração existente usa Graph v26.0; não houve troca de versão nem consulta/criação de ativos reais para homologação.

## Validação

Testes com mocks e URL de banco fictícia em porta local inválida, sem conexão com banco ou conta Meta:

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/meta_unit_tests'
$env:pnpm_config_verify_deps_before_run='false'
pnpm --filter @workspace/api-server test:paid-media
pnpm --filter @workspace/api-server test:paid-media-launch
pnpm --filter @workspace/api-server test:paid-media-events
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/app typecheck
```

O override do pnpm evita a instalação automática ao detectar a nova entrada de script; as dependências instaladas são suficientes. Testes cobrem objetivos, rejeição sem chamadas externas, ABO/CBO daily/lifetime, moeda/mínimo, orçamento exclusivo, leitura divergente, estados/CTAs da landing e serviço real de recibos com persistência mockada, consentimento, hashes, concorrência, replay e colisão de nome.

Homologação real permanece pendente de autorização específica para criar ativos pausados em conta de teste. Ela deve confirmar permissões, pixel atribuído, mínimos, elegibilidade ABO/CBO, payloads/readback, recebimento de eventos e compensação. Testes de EMQ e deduplicação no Events Manager são separados. Nenhuma ativação de anúncios, publicação real de landing, alteração de ativos reais ou gasto foi executado nesta tarefa.
