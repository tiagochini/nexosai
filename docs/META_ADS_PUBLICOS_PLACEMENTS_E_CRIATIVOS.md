# Meta Ads: públicos, Advantage+ Audience, placements e formatos

Implementação local de 23/10/2026. Não houve criação/upload/exclusão em conta real, deploy, aplicação de migration ou ativação de anúncios nesta execução. Os contratos foram exercitados com persistência e transporte simulados; a elegibilidade e os retornos concretos da Graph v26.0 precisam de homologação na conta.

## Recursos implementados

| Recurso | Contrato implementado |
| --- | --- |
| Custom Audience de website | Evento escolhido, pixel da conta, retenção entre 1 e 180 dias e filtro opcional de URL; esses limites delimitam o produto, não uma regra universal da Meta |
| Custom Audience CRM | Nova lista com até 1.000 contatos por operação, e-mail/telefone normalizados e SHA-256, consentimento individual e declaração de direitos sobre os dados |
| Lookalike | Origem acessível na conta, país e proporção entre 1% e 20%; elegibilidade/tamanho mínimo permanecem decisões da Meta |
| Inclusão/exclusão de públicos | IDs explícitos no Master Plan, incluindo Custom/CRM/Lookalike já disponíveis; conflitos de inclusão/exclusão são rejeitados |
| Advantage+ Audience | `targeting_automation.advantage_audience` explícito 0/1; no modo Advantage+ o contrato envia país, idade mínima, sugestões de público e exclusões, sem prometer gênero ou idade máxima rígidos |
| Placements manuais | Feed, Stories e Reels de Facebook/Instagram; plataformas e posições são validadas conjuntamente |
| Placements automáticos | Sem restrições manuais no payload; segue o comportamento padrão autorizado da Meta, sem certificar o conjunto Advantage+ inteiro |
| Vídeo | ID de vídeo já carregado na conta de anúncios, status `ready`, miniatura HTTPS e CTA para o destino aprovado |
| Catálogo | OUTCOME_SALES/Purchase, catálogo e conjunto de produtos existentes, conjunto não vazio e pertencente ao catálogo aprovado; `product_set_id` preservado no conjunto, no criativo, na leitura de confirmação e no hash de aprovação |

## Fluxo de públicos

Em **Mídia paga → Públicos Meta**, selecione uma conta Meta autorizada e prepare o público. Preparar, listar preparações, aprovar e cancelar não enviam dados à Meta. Consultar públicos existentes é uma consulta externa explícita, com paginação por cursor; URLs de paginação retornadas pelo provedor nunca são seguidas.

O resumo mostra conta, tipo, nome, parâmetros de website/Lookalike ou contagem CRM após deduplicação. A preparação fica vinculada ao workspace, conta externa, integração paga exata e hash do conteúdo. A chave de preparação impede recriar a mesma intenção em caso de perda da resposta local. Reutilizar a chave com outro conteúdo gera conflito.

Após **Aprovar este resumo**, a execução exige uma confirmação separada para criar o público e, em CRM, enviar os identificadores aprovados. O executor exige conta selecionada, política de conta habilitada e aceita, validade da preparação e ausência de pausa obrigatória global/de mídia/Meta. Verifica novamente esses controles antes de criar, enviar a lista ou excluir. Tokens orgânicos não são aceitos como credenciais de mídia paga.

Cada chamada que altera a Meta tem intenção durável antes do envio. O claim atômico e o proprietário da execução impedem duas requisições concorrentes de executar a mesma preparação. O ID criado é persistido antes da leitura de confirmação ou upload. Criação, upload e exclusão não têm repetição automática: um cabeçalho local de idempotência não é tratado como garantia de idempotência da Meta.

Se houver perda de resposta, interrupção, retorno incompatível ou upload sem confirmação de todas as linhas, a operação exige recuperação. Ela não é marcada como concluída nem reexecutada automaticamente. O scheduler move execuções sem atualização há cinco minutos para recuperação; o processo antigo perde a possibilidade de concluir a operação. Para vincular um ID visto na Meta, a leitura precisa conferir conta, nome, marcador exclusivo da operação e especificação aprovada. Essa recuperação nunca repete o upload CRM.

A exclusão é uma ação explícita, limitada ao público criado pela própria operação, com confirmação na tela, snapshot dos metadados anteriores e verificação independente de ausência. Não exclui públicos usados como origem de Lookalike nem públicos apenas referenciados na campanha. Se a exclusão já foi solicitada, **Conferir exclusão já solicitada** consulta a ausência sem repetir DELETE. Mudanças de conta/integração bloqueiam a recuperação para evitar verificar a conta errada.

O estado interno `ready` significa registro e recibos conferidos, não elegibilidade de entrega ou pessoas correspondentes. `num_received` é quantidade de linhas recebidas; o sistema não declara quantas pessoas foram associadas. Preenchimento, termos, permissões e disponibilidade do público continuam sujeitos à Meta.

## Dados CRM e retenção

O formulário aceita um arquivo JSON de até 1 MB com 1 a 1.000 contatos. Cada contato precisa de e-mail e/ou telefone E.164 com código do país, `marketingConsent: true`, `consentedAt` ISO não futuro e `consentReference` não vazia. Exemplo inteiramente fictício:

```json
[
  {
    "email": "pessoa@example.test",
    "phone": "+5511999999999",
    "marketingConsent": true,
    "consentedAt": "2026-10-22T12:00:00Z",
    "consentReference": "registro-interno-do-consentimento"
  }
]
```

Não inclua contatos cuja autorização não abranja esse uso. A declaração do operador não é inferida de um cadastro, consentimento de contato, captura anterior ou evento CAPI. O registro original de consentimento continua sob responsabilidade do CRM de origem; não há sincronização automática de listas, revogações ou dados de contatos da plataforma nesta etapa.

O servidor normaliza/hasha e-mail e telefone antes da persistência. O envelope criptografado contém hashes, datas de consentimento e hash das referências, nunca os identificadores CRM originais. As colunas públicas e logs não recebem listas de hashes nem credenciais. O envelope usa AES-256-GCM e as chaves atuais/anteriores de `INTEGRATION_TOKEN_ENCRYPTION_KEY`. O arquivo é retirado da tela após preparar.

A preparação é elegível por 24 horas. Cancelar ou concluir remove o envelope imediatamente; falhas/recuperações mantêm-no até expirar para permitir conferência. A limpeza física depende do scheduler ativo. Após expirar, a recuperação sem ID confirmado exige conferência manual na Meta, pois o payload foi descartado. O resumo, hash, aprovações, IDs e evidências sanitizadas permanecem para auditoria. Evite dados pessoais em nomes de públicos e filtros de URL.

## Configuração e lançamento de anúncios

Na estratégia da campanha, **Configuração dos anúncios Meta** oferece os novos campos. Salvar materializa uma nova versão do Master Plan e invalida a autorização anterior, como no fluxo existente. A compilação inclui targeting completo, formato e referências de catálogo no conteúdo aprovado; alterações nesses campos alteram o hash. Compile e aprove o plano de lançamento separadamente.

O pré-check verifica acesso da conta aos públicos e vídeos com paginação, processamento do vídeo, acesso ao conjunto de produtos e vínculo com o catálogo. A consulta ao conjunto usa a credencial paga exata da conta; a elegibilidade final do catálogo para aquele anunciante também precisa ser aceita na criação do conjunto pela Meta. O executor não promete que toda combinação de objetivo, público, placement e formato é elegível só por ter passado pela validação local.

Campanha, conjuntos e anúncios continuam sendo criados **PAUSED**, com orçamento ABO/CBO exclusivo, intenções persistidas, leitura de confirmação e compensação do lançamento. O `product_set_id` do criativo não é descartado e sua divergência bloqueia a confirmação. Referências inválidas, campos desconhecidos, placements sem plataforma, públicos conflitantes e formatos incompatíveis são rejeitados.

## Implantação e limites

- Aplicar `0074_meta_audience_operations.sql` antes de disponibilizar a aba de públicos. A migration anterior `0073_paid_media_capi_retry.sql` também deve estar aplicada para a fila CAPI.
- Manter a chave de criptografia e o scheduler `paid-media-audience-retention` ativos. A nova rotina apenas expira dados/execuções; ela nunca aprova públicos nem chama a Meta automaticamente.
- Vídeos e catálogo/feed precisam existir na Meta. Esta etapa implementa criação de anúncios nesses formatos, sem upload de vídeo, criação de catálogo ou administração de feed.
- Criação de públicos de engajamento Instagram/Facebook, Lookalike baseado em valor, sincronização contínua/revogação CRM, outras plataformas de placement, Customer Lifecycle Strategy, Advantage+ Creative/enhancements e Experiments não foram acrescentados. Os campos desconhecidos continuam bloqueados.
- Apps, mensagens, formulários nativos e categorias especiais continuam fora do contrato de criação. Não se promete implementar integralmente todas as recomendações operacionais do texto de referência.
- Para público sem direito de exclusão, com dependências criadas fora do NexOS ou cuja exclusão não seja confirmada, a recuperação permanece manual. Não há promessa de rollback de membros individuais nem remoção de audiências externas.
- A nova migração e os locks foram revisados no código, mas precisam de validação em PostgreSQL de homologação. Os testes não acessam banco ou conta Meta real.

## Verificação local

```powershell
$env:pnpm_config_verify_deps_before_run='false'
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/meta_unit_tests'
pnpm --filter @workspace/api-server test:meta-assets
pnpm --filter @workspace/api-server test:paid-media-launch
pnpm --filter @workspace/api-server test:meta-operational-flow
pnpm --filter @workspace/api-server test:meta-reliability
pnpm --filter @workspace/api-server test:paid-media-events
pnpm --filter @workspace/api-server test:integration-security
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/app typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/app build
```

Os testes de ativos exercitam o formulário validado, o compilador e os payloads reais de imagem/vídeo/catálogo, a política de targeting, acesso/paginação, status do vídeo, catálogo divergente/vazio, consentimento e normalização. O teste do serviço exercita preparação criptografada, aprovação, isolamento, política/pausas, concorrência, intenção antes da chamada, persistência do ID antes do upload, interrupção ambígua, recuperação, exclusão verificada, cancelamento e expiração com DB/Graph simulados. Também verifica a seleção da integração paga exata e ausência de retries HTTP nas mutações.

## Referências consultadas

Foram consultados os campos e métodos do SDK oficial Meta: [Targeting](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/targeting.py), [TargetingAutomation](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/targetingautomation.py), [AdAccount/customaudiences e advideos](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py), [CustomAudience](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/customaudience.py), [LookalikeSpec](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/lookalikespec.py), [AdCreativeVideoData](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativevideodata.py), [AdPromotedObject](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adpromotedobject.py) e [ProductSet](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/productset.py).

As páginas de referência em developers.facebook.com retornaram 429. O SDK confirma nomes/tipos de campos e endpoints; isso não certifica a disponibilidade para uma conta, a normalização exata de regras/readback nem combinações de parâmetros na Graph v26.0. Essas condições permanecem parte explícita da homologação.
