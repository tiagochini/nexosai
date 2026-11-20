# TikTok Ads: criação pausada, conversões e pixel

## O que está implementado

- Descoberta das contas autorizadas pelo OAuth TikTok for Business, usando a credencial da integração de mídia paga.
- Compilação do Master Plan aprovado para campanha, grupos e anúncios de vídeo, com orçamento ABO/CBO e datas em UTC.
- Verificação de pertencimento da conta, vídeo, identidade e pixel antes da primeira criação.
- Criação em DISABLE nos níveis de campanha, grupo e anúncio; no anúncio, o status é enviado dentro de cada creative, conforme o contrato nativo.
- Persistência de intenção e IDs, leitura posterior e comparação dos campos aprovados, orçamento, segmentação, pais, vídeo e destino.
- Compensação por exclusão e confirmação de ausência em falhas. Uma criação ambígua sem ID fica bloqueada para recuperação; não há nova criação automática após timeout.
- Upload por URL HTTPS pública na biblioteca da conta, com nome determinístico e consulta de disponibilidade. Upload não ativa anúncio nem autoriza troca de criativo de um plano aprovado.
- Eventos server-side pela Events API: PageView, ViewContent, Lead/SubmitForm, CompleteRegistration, InitiateCheckout, AddToCart e Purchase.
- Normalização e hash das chaves pessoais, conservação do event_id, consentimento, recibo persistido, reivindicação atômica e fila de retry criptografada. A fila preserva a identidade e o provedor do evento.
- Consulta dos pixels da conta e diagnóstico de acessibilidade, eventos locais, fila, falhas, consentimento e configuração do pixel nas páginas armazenadas.
- Tela em Mídia Paga → TikTok Pixels: consultar/vincular pixel, diagnóstico e upload do vídeo.

## Contrato de entrada do plano

O plano deve conter a configuração nativa antes de sua aprovação. Exemplo de `snapshot.strategy.paidMedia`:

```json
{
  "objective": "TRAFFIC",
  "destinationType": "WEBSITE",
  "destinationUrl": "https://seu-dominio.com/captura",
  "budget": { "amount": 150, "kind": "daily", "mode": "abo", "currency": "BRL" },
  "bidStrategy": "lowest_cost",
  "audiences": [{ "location_ids": ["ID_DE_LOCALIZACAO_DO_TIKTOK"] }],
  "creatives": [{
    "videoId": "VIDEO_APROVADO_NA_CONTA",
    "imageIds": ["CAPA_APROVADA_NA_CONTA"],
    "identityId": "IDENTIDADE_AUTORIZADA",
    "identityType": "CUSTOMIZED_USER",
    "adText": "Texto aprovado",
    "callToAction": "LEARN_MORE"
  }]
}
```

`snapshot.campaign.startTime` e `endTime` exigem ISO com fuso horário. Valores e moedas devem corresponder à conta e à autorização. Para `WEB_CONVERSIONS`, informe também `tracking.pixelId` (ID nativo da plataforma) e `tracking.conversionEvent` (enum nativo de otimização). O cadastro de dataset usa o **pixel code**, que é o identificador exigido pela Events API, e não presume que código e ID numérico sejam intercambiáveis.

Publicação segue os endpoints existentes de compilação, aprovação e execução de `/api/paid-media/launch-plans`. A execução cria a estrutura pausada; habilitar entrega e gasto segue a autorização operacional existente.

## Endpoints de suporte

- `GET /api/paid-media/accounts/tiktok_ads/:accountId/pixels`
- `POST /api/paid-media/accounts/tiktok_ads/:accountId/videos` com `videoUrl` HTTPS pública.
- `POST /api/paid-media/datasets` com provider `tiktok_ads`, conta local e pixel code.
- `GET /api/paid-media/datasets/:datasetId/diagnostics`
- `POST /api/paid-media/events/ingest` com a chave de ingestão do dataset no header `x-paid-media-ingestion-key`.

Na ingestão, use `source: server`, `eventId`, `eventName`, `occurredAt`, `payload.marketingConsent: true` e chaves consentidas em `matchKeys` (email, phone, externalId, ttclid, ttp, clientIpAddress e clientUserAgent). Compras aceitam `payload.currency`, `value` e `orderId`. Não inclua o token do TikTok na página ou na chave de ingestão.

Para deduplicação, use o mesmo identificador na tag do navegador e no servidor; registre `Lead` internamente e envie `SubmitForm` ao pixel TikTok. O recibo do provedor confirma aceitação, não comprova atribuição de venda ou deduplicação no navegador. Compra deve ser enviada somente após confirmação financeira; não inferir compra a partir de visita ao checkout. Este módulo não instala tags em checkouts de terceiros.

## Limites e homologação

- Fluxo manual de website, vídeo único, lance lowest_cost. Não habilita Smart+, Shop, catálogo, objetivo de aplicativo, restrições especiais ou criação de audiências.
- WEB_CONVERSIONS manual tem bloqueio de novas criações a partir de 01/01/2027. A migração para Upgraded Smart+ é outro contrato e não é simulada como suportada.
- A presença do script no HTML salvo é evidência de configuração, não de execução do pixel no navegador. O diagnóstico não faz uma alegação falsa de instalação ou EMQ.
- Mínimos comerciais, revisão de anúncios, escopos, identidades permitidas e disponibilidade dos endpoints dependem da conta e da plataforma.
- Upload repetido usa o mesmo nome de arquivo; em resultado ambíguo, confira a biblioteca antes de reenviar. Não existe retry automático de criação.
- Testes locais usam transportes simulados e banco em memória. Nenhuma campanha real foi criada ou ativada, nenhum evento real foi enviado e nenhum orçamento foi consumido durante esses testes. Homologação real ainda é necessária.

## Referências oficiais

- [Campaign Management e migração de janeiro de 2027](https://business-api.tiktok.com/portal/docs/campaign-management/v1.3)
- [SDK oficial: status no creative de cada anúncio](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/python_sdk/docs/AdcreateCreatives.md)
- [SDK oficial: upload do vídeo por URL](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/python_sdk/docs/AdUploadBody.md)
- [Events API](https://business-api.tiktok.com/gateway/docs/index?doc_id=1771100779668482)
