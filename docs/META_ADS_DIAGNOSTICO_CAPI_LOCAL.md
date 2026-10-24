# Diagnóstico local de eventos CAPI

O painel **Mídia paga → Test Events → Diagnóstico local de eventos CAPI** lê os recibos locais de um pixel/dataset Meta selecionado. O botão dispara uma leitura autenticada do endpoint `/api/paid-media/datasets/:datasetId/diagnostics`; não há polling do diagnóstico.

## O que o painel mostra

- Quantidade de recibos locais e quantidade que contém pelo menos uma chave de correspondência armazenada.
- Cobertura por chave (`em`, `ph`, `external_id`, nome, cidade, estado, CEP, país, `fbp`, `fbc`) como contagem e proporção dos recibos do dataset.
- Estados locais de entrega: enviado, na fila, bloqueado por capacidade, sem consentimento e falha.
- Data do último evento registrada para o dataset.

O serviço agrega contagens no banco. Não retorna valores de identificadores, hashes, IP, user agent, payload de evento, URLs nem eventos individuais. A consulta e a gravação de `lastDiagnosticAt` são limitadas ao dataset pertencente ao workspace autenticado.

## Limites de interpretação

Esta é uma medida de presença de campos nos recibos do NexOS. Não mede se a Meta conseguiu associar pessoas, não é Event Match Quality (EMQ) e não valida qualidade ou resultado da correspondência. `fbp` e `fbc` são contados como chaves presentes; a contagem não verifica se são atuais ou aceitos.

Os recibos persistidos não comprovam deduplicação browser/server no Events Manager. O fluxo de teste continua separado; um evento de teste confirmado pelo endpoint comprova a resposta de recebimento reportada pelo transporte, mas não substitui a inspeção no Events Manager. Testes automatizados usam banco/transportes simulados e não enviam eventos reais.

## Validação

```powershell
$env:pnpm_config_verify_deps_before_run='false'
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/meta_unit_tests'
pnpm --filter @workspace/api-server test:meta-capi-local-diagnostics
pnpm --filter @workspace/api-server test:paid-media-events
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/app typecheck
```
