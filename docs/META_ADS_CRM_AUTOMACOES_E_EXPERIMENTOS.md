# Meta Ads: CRM recorrente, engajamento, criativos e Experiments

Implementação local em 23/10/2026. Esta atualização complementa [públicos, placements e formatos](META_ADS_PUBLICOS_PLACEMENTS_E_CRIATIVOS.md). Nenhuma chamada real à Meta, aplicação de migration, publicação, ativação ou gasto foi realizado. Os testes usam persistência e transporte simulados.

## Contrato disponível

| Recurso | Implementação e limite |
| --- | --- |
| Engajamento Facebook/Instagram | Custom Audience ENGAGEMENT, Page/conta profissional acessível pela conta paga, evento de engajamento e retenção de 1–365 dias. A regra e a elegibilidade precisam ser aceitas e conferidas pela Graph da conta |
| Lista CRM por valor | Consentimentos individuais, moeda declarada, valor por identidade e schema EMAIL/PHONE/LOOKALIKE_VALUE. Identificadores recebem SHA-256; valores numéricos não recebem hash. Moeda é contexto local, sem conversão monetária automática |
| Lookalike por valor | A origem precisa ser acessível e retornar is_value_based=true antes de qualquer criação. O tipo de origem é conferido; elegibilidade, tamanho e utilização efetiva pela Meta dependem de homologação |
| CRM recorrente | Sequência existente, semente vazia exclusiva, consentimento específico por contato, autorização explícita com validade de até 30 dias, política automática da conta e worker com lease/intenção durável |
| Aquisição/retenção | Exclusão de públicos de clientes na aquisição; inclusão somente de clientes e público original sem expansão na retenção. São regras explícitas de targeting; não ativam o recurso nativo Customer Lifecycle da Meta |
| Advantage+ Creative | Allowlist de seis opções OPT_IN/OPT_OUT, conteúdo aprovado/hash, envio e readback. Autorização local não comprova disponibilidade nem aplicação visual pela Meta |
| Experiments A/B | Cadastro de estudo SPLIT_TEST com dois anúncios existentes, sincronizados e pausados na mesma conta, células A/B de 50/50, aprovação e execução separadas. Não ativa anúncios, não inicia entrega e não escolhe vencedor |

Os limites de quantidade, duração e distribuição são escolhas deste contrato do NexOS. Não representam mínimos universais da Meta.

## Públicos de engajamento e valor

Em **Mídia paga → Públicos Meta**, o tipo Engajamento permite Facebook ou Instagram e o ID da origem. Antes da criação, a origem deve aparecer em promote_pages ou instagram_accounts da conta de anúncios selecionada. O executor usa somente a integração de mídia paga vinculada à conta, sem procurar credenciais orgânicas como alternativa.

A regra Facebook usa fonte page e evento page_engaged; Instagram usa ig_business e ig_business_profile_all. O exemplo oficial do SDK confirma a estrutura Facebook. A combinação Instagram, os termos, permissões e a normalização do readback ainda precisam de confirmação na Graph v26.0. Resposta incompatível bloqueia a conclusão; não há fallback para outro tipo de público.

Para lista CRM por valor, cada item do JSON deve incluir value numérico não negativo, além dos identificadores e evidências de consentimento já documentados. O formulário exige moeda de três letras, valores em todas as linhas e pelo menos dois valores distintos. Valores conflitantes para a mesma identidade são rejeitados. A moeda não é enviada como novo parâmetro de Graph nem converte os valores. Não misture moedas na mesma preparação.

No Lookalike, a opção de valor exige origem confirmada como lista por valor. Não é uma promessa de que qualquer origem ou proporção será aceita para entrega.

## Consentimento e sincronização CRM

Em **Mídia paga → CRM & Experiments**:

1. Registre, pelo UUID do contato, data não futura e referência documental de consentimento específico para compartilhar identificadores com públicos Meta. Cadastro, permissão de contato e consentimento CAPI não são convertidos nesse consentimento.
2. Crie e execute, na aba Públicos Meta, uma lista CRM marcada como semente vazia para sincronização. Ela não recebe membros na criação e não admite valores. Listas antigas ou com conteúdo desconhecido não podem ser vinculadas como sementes.
3. Prepare o vínculo da conta, sequência, semente e vencimento. A preparação fica desativada. O limite é de 1.000 contatos na sequência completa; sequências maiores bloqueiam o ciclo, sem usar uma lista parcial para remoções.
4. Autorize os ciclos até o vencimento exibido. A política vigente da conta também precisa permitir autoExecute; pausas obrigatórias e troca de conta/integração bloqueiam o envio. O programa não renova sua autorização automaticamente.

A prova criptografada vincula workspace, contato, hashes dos identificadores, data, hash da referência, finalidade e operador. Identificadores alterados exigem nova prova; os hashes anteriores são retirados no próximo ciclo autorizado. Contatos descadastrados, revogados, removidos ou sem prova válida não entram no conjunto desejado. O formulário permite revogar sem exigir que o operador confirme uma nova concessão.

O scheduler consulta programas vencidos para execução a cada minuto; após sucesso, agenda o próximo ciclo para aproximadamente cinco minutos. Remoções precedem inclusões. O worker assume um lease de cinco minutos por programa, relê autorização/consentimentos antes de cada lote e persiste intenção antes da chamada. O estado usa os hashes já normalizados, sem aplicar hash novamente. O recibo deve confirmar todas as linhas; correspondência de pessoas permanece desconhecida.

Uma resposta perdida ou interrompida após a intenção bloqueia o programa, sem repetir o lote. Não há recuperação automática de listas ambíguas: confira o público na Meta e resolva os membros pendentes antes de usar uma nova semente. O hash da preparação e o vínculo da semente não podem ser trocados para reutilizar a autorização anterior.

Pausar, expirar ou bloquear interrompe os próximos envios, inclusive remoções. Revogação local não comprova exclusão remota imediata. Pendências exigem um ciclo autorizado ou remoção conferida na Meta. Pausar aguarda o ciclo em andamento; não interrompe uma chamada já enviada. Excluir a semente pelo fluxo de públicos exige pausar o programa e aguardar seu lease; uma semente fora de ready bloqueia novas mutações de membros.

O estado de membros e a prova são criptografados, porém não são eliminados automaticamente ao vencer a autorização. Permanecem para auditoria/conferência de remoções; a expiração do programa não é uma política de descarte de dados nem exclusão do público na Meta. Hashes também são dados pessoais. Este fluxo administra apenas os membros cuja transferência ele registrou; alterações manuais externas não são um inventário verificável de membros pela API.

## Criativos e clientes

Na configuração dos anúncios, as opções standard_enhancements, text_optimizations, image_touchups, image_uncrop, video_auto_crop e product_browsing entram em degrees_of_freedom_spec.creative_features_spec. O valor padrão omite a configuração explícita, deixando o comportamento à Meta. Escolher OPT_IN autoriza a opção; escolher OPT_OUT solicita desativá-la. Isso não certifica uma transformação aplicada à imagem/vídeo.

Recorte de vídeo exige criativo de vídeo; tratamentos de imagem exigem imagem; product_browsing exige catálogo. Campos fora da allowlist são rejeitados. O compilador preserva as escolhas no hash e a leitura após criação precisa conter as opções aprovadas. Divergência impede sucesso e aciona a compensação do lançamento. A Meta pode rejeitar combinações indisponíveis por conta, objetivo ou formato.

As regras de clientes preservam IDs aprovados e verificados no pré-check de públicos. Aquisição exclui os clientes indicados. Retenção rejeita expansão Advantage+ e inclusões além dos clientes. Esses controles não implementam metas, classificação ou otimização nativas de Customer Lifecycle. Advantage+ Sales/Leads completo e outras opções de creative continuam fora deste contrato.

## Experiments

Prepare nome, conta, Business ID, dois Ad IDs e datas futuras com duração de até 30 dias. Os dois anúncios precisam existir na sincronização local da conta. Aprovar é local. Registrar na Meta verifica novamente Business da conta, propriedade dos anúncios e estado PAUSED, grava snapshot e intenção, cria o estudo e persiste seu ID antes da leitura independente.

O readback confere nome, marcador exclusivo, Business, SPLIT_TEST, datas e as duas células com seus anúncios e percentuais. Estado ready significa cadastro conferido, sem ativar campanha, conjunto ou anúncio. Anúncios pausados não entregam só porque o estudo foi registrado. Permissões, elegibilidade e compatibilidade desse desenho precisam ser homologadas na conta.

Chamadas ambíguas ficam em manual_recovery. Um ID observado pode ser vinculado somente se o estudo corresponder integralmente ao desenho e marcador. Execuções antigas são interrompidas localmente após cinco minutos sem atualização, sem repetir criação. A conferência mostra registro e data de disponibilidade retornada; resultados estatísticos, significância e vencedor devem ser consultados na Meta. Não há endpoint de resultados implementado ou vencedor calculado localmente.

Cancelar um rascunho/aprovação sem ativo é local. Cancelar um estudo existente exige confirmação explícita, validação do vínculo e snapshot antes de DELETE. Exclui apenas o estudo, preservando anúncios. A confirmação consulta a listagem completa de estudos do Business, com paginação por cursor. Após uma exclusão pendente, a operação disponível é conferir a ausência: outro DELETE é bloqueado. Não são seguidas URLs de paginação retornadas pela Meta.

## Implantação e validação

Aplicar 0075_meta_advanced_operations.sql depois de 0074_meta_audience_operations.sql. Esta tarefa apenas criou/revisou os arquivos; SQL, índices, FKs, concorrência e locks ainda precisam ser exercitados em PostgreSQL de homologação. Manter INTEGRATION_TOKEN_ENCRYPTION_KEY e o scheduler ativos. O worker não habilita programas nem aprova experimentos por conta própria.

Testes direcionados:

```powershell
$env:pnpm_config_verify_deps_before_run='false'
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/meta_unit_tests'
pnpm --filter @workspace/api-server test:meta-advanced-workflows
pnpm --filter @workspace/api-server test:meta-assets
pnpm --filter @workspace/api-server test:paid-media-launch
pnpm --filter @workspace/api-server test:meta-operational-flow
pnpm --filter @workspace/api-server test:meta-reliability
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/app typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/app build
```

Os testes novos exercitam os serviços reais com persistência/Graph simulados: engajamento e origem por valor, schema de upload, prova e escopo de consentimento, mudança de identificador/revogação, autorização automática separada, claim concorrente, intenção antes da chamada, hashing único, bloqueio após ambiguidade, anúncios pausados, persistência de ID, leitura divergente e recuperação de criação/exclusão. Os testes de ativos exercitam também a passagem dos enhancements e regras de aquisição pelo formulário, compilador, payload e readback.

Validação local concluída: testes novos e regressões de públicos, lançamento, fluxo operacional, confiabilidade, eventos, domínio de mídia, integração e logs passaram, assim como os checks de tipos e os builds da API e do app. O bundle inicial ficou dentro do orçamento configurado.

Antes de publicar, faltam aplicação/validação das migrations no ambiente de destino e homologação autorizada dos contratos reais. Recursos nativos não implementados e a apuração estatística de Experiments não podem ser apresentados como concluídos.

## Fontes oficiais

Campos/endpoints consultados no SDK oficial Meta: [AdAccount](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py), [exemplo de público de engajamento](https://github.com/facebook/facebook-python-business-sdk/blob/main/examples/AdAccountCustomAudiencesPostPlatformEngagementCustomAudience.py), [CustomAudience](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/customaudience.py), [AdCreativeDegreesOfFreedomSpec](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativedegreesoffreedomspec.py), [AdCreativeFeaturesSpec](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativefeaturesspec.py), [AdCreativeFeatureDetails](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativefeaturedetails.py), [Business/ad_studies](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/business.py), [AdStudy](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adstudy.py) e [AdStudyCell](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adstudycell.py).

developers.facebook.com retornou 429 durante a pesquisa. A existência de campos/métodos no SDK não comprova aceitação pela Graph v26.0, pela conta ou pelo objetivo. O documento distingue implementação local de homologação real.
