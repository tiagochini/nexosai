# Meta Ads: Test Events e validação PostgreSQL

Atualização de 24/10/2026, complementar aos documentos anteriores. Nenhum evento real foi enviado à Meta; não houve ativação de anúncio, publicação de landing, deploy ou push.

## PostgreSQL de homologação

O runner `node scripts/meta-ads-homologation.mjs` carrega exclusivamente o perfil privado de homologação, valida host/TLS/papel SQL e o marcador `nexos_ops.environment`, bloqueia HTTP externo e executa os serviços reais com dados inteiramente fictícios.

Foram validados no Supabase: criação/aprovação/execução de semente vazia, consentimento e upsert, rejeição de outro workspace, exclusividade SQL da semente, remoção após revogação, claim de execuções intercaladas, intenção durável antes do transporte simulado, interrupção ambígua e cadastro/readback/cancelamento de Experiments. Após aplicar a política autorizada, o mesmo teste validou preparação/envio simulado de Test Events, isolamento por workspace, claim e ausência de inserção em recibos de produção. RLS, FKs, índices e triggers permanecem habilitados.

O teste usa uma única transação, redirecionando o acesso dos serviços para ela, e sempre a reverte. Uma consulta fora dessa transação confirma a ausência do workspace fictício. Não há limpeza destrutiva de tabelas ou alteração de registros reais. O teste prova a execução do SQL e os estados na conexão real; não certifica contenção entre processos/conexões independentes nem entrega à Meta.

## Test Events CAPI

Em **Mídia paga → Test Events**, o operador seleciona conta/pixel, informa o código copiado do Events Manager, o evento, a URL HTTPS de origem e identificadores consentidos. Parâmetros de consulta e fragmentos são removidos da URL antes de persistir/enviar; URLs com usuário/senha são rejeitadas. Preparar não envia. O servidor atribui um event_id exclusivo `nexos-test:...`, normaliza e hasha os identificadores, vincula conta/integração/pixel/workspace, criptografa a requisição e salva um resumo sem valores dos identificadores ou código de teste. A preparação vale por 30 minutos.

Enviar exige confirmação separada do hash e revalida conta selecionada, política vigente e pausas obrigatórias. O pré-check verifica o pixel nas permissões da conta paga. O claim e o proprietário da execução impedem envio concorrente da mesma preparação; a intenção é persistida antes da chamada.

O transporte diagnóstico exige código válido e envia `test_event_code` na raiz da requisição de eventos. Código ausente/inválido bloqueia a chamada. Endpoints públicos de produção continuam rejeitando códigos de teste; o transporte normal também rejeita marcadores de diagnóstico. Não existe fallback de teste para produção.

Os registros ficam em `meta_capi_tests`, separados de `paid_media_event_receipts`, conversões, métricas e retry CAPI de produção. Não há retry automático de teste. Resposta perdida ou inconsistente exige conferência manual do event_id; repetir a operação interrompida é bloqueado. Um novo teste exige nova preparação e nova autorização.

`sent_test` significa recibo de exatamente um evento de teste, sem comprovar visualização no Events Manager, EMQ, deduplicação browser/server, atribuição ou conversão. Esta etapa implementa diagnóstico server-side; a comparação com eventos do navegador é uma verificação separada no Events Manager.

Após conclusão/falha o envelope é apagado. Preparações expiradas e execuções interrompidas há mais de cinco minutos são tratadas pelo scheduler, sem enviar eventos. Resumo, hash, event_id e evidências sanitizadas permanecem. A limpeza depende do scheduler ativo. Referências de diagnóstico não são credenciais de anúncios, mas o código de teste também não é exibido em listas/logs.

## Identificadores adicionais

O contrato CAPI aceita, além de email/phone/externalId e dados de browser existentes, `firstName`, `lastName`, `city`, `state`, `postalCode` e `country`. O normalizador usa as chaves fn, ln, ct, st, zp e country, seguindo o SDK oficial para lower-case/trim, limpeza de cidade/estado, tratamento de código postal e SHA-256.

Não se separa nome completo automaticamente, não se infere localização pelo IP e não se enriquece um cadastro sem consentimento. A landing continua enviando somente os campos que efetivamente captura e autoriza. Os serviços de produção mantêm o bloqueio por consentimento e persistem hashes, sem guardar novos identificadores originais em recibos. Campos adicionais não garantem aumento de EMQ.

O controle de Automatic Advanced Matching do Pixel, a consulta automática de EMQ/diagnósticos da Meta e a instrumentação de todos os eventos do funil continuam pendentes. Test Events não substitui esses recursos.

## Implantação

A migration `0076_meta_capi_tests.sql` foi aplicada ao Supabase de homologação com o runner transacional e histórico de checksums. Ela cria a tabela isolada e seu índice. O Supabase ativou RLS automaticamente.

A política privada para `meta_capi_tests` foi aplicada após autorização específica do usuário em 24/10/2026. Mantém RLS e permite acesso a todas as linhas somente ao papel privado `nexos_homologation`; a aplicação continua responsável pelo isolamento por workspace. Não foram concedidos acessos públicos nem desativadas proteções. A revisão automática havia exigido aprovação separada por se tratar de uma nova tabela; ela foi obtida antes da alteração de acesso.

As verificações finais de schema e segurança passaram no Supabase após o ajuste. Os checks de tipos, builds da API/app, testes locais novos e regressões direcionadas também passaram. O teste transacional confirmou rollback e nenhum envio real à Meta.

Em outros ambientes, aplicar a migration antes de disponibilizar a aba e configurar as permissões do papel de backend conforme a política daquele ambiente.

## Verificação local

```powershell
$env:pnpm_config_verify_deps_before_run='false'
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/meta_unit_tests'
pnpm --filter @workspace/api-server test:meta-capi-diagnostics
pnpm --filter @workspace/api-server test:paid-media
pnpm --filter @workspace/api-server test:paid-media-events
pnpm --filter @workspace/api-server test:meta-reliability
pnpm --filter @workspace/api-server test:meta-advanced-workflows
pnpm --filter @workspace/api-server test:meta-operational-flow
pnpm --filter @workspace/api-server test:paid-media-launch
```

O teste novo cobre payload de teste separado, bloqueio de fallback, consentimento, escopo, política, troca de integração, integridade do envelope, datas reidratadas, hash único, claim concorrente, intenção, resposta ambígua, idempotência local, expiração e ausência de identificadores/códigos nos registros públicos. O transporte é simulado.

## Referências oficiais consultadas

O [EventRequest do SDK Meta](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event_request.py) documenta test_event_code. [UserData](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/user_data.py) e [Normalize](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/normalize.py) fundamentam os identificadores e a normalização. A aceitação e a visualização efetivas na Graph v26.0 precisam de homologação autorizada na conta Meta.
