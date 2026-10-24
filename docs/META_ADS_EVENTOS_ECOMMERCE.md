# Eventos de funil e payloads de conversão

As rotas genéricas de servidor aceitam `AddToCart`, `CompleteRegistration`, `Schedule` e `Contact`, além dos eventos que já existiam. Elas continuam exigindo `marketingConsent: true` e um `eventId` opaco e estável. Esse ID é enviado sem alteração aos provedores com mapeamento para permitir deduplicação quando o cliente/browser enviar a cópia do mesmo evento.

## Campos de evento

O corpo aceita `currency` em três letras maiúsculas, `value` finito e não negativo, `contentName`, `contentCategory`, `contentIds`, `contentType` (`product` ou `product_group`), `numItems` inteiro positivo e `orderId`.

Meta recebe os nomes padronizados de `custom_data`: `content_name`, `content_category`, `content_ids`, `content_type`, `num_items` e `order_id`. TikTok recebe `contents` com IDs de conteúdo e seus nomes/categorias. `quantity` só é preenchido quando há exatamente um `contentId`, pois a API recebe apenas um total de itens e não há quantidades individuais para cada produto.

Mapeamento dos eventos:

- `AddToCart` mantém o nome para Meta e TikTok.
- `CompleteRegistration` mantém esse nome na Meta e usa `Registration` no transporte TikTok.
- `Registration` preserva seu mapeamento existente (`CompleteRegistration` na Meta e `Registration` no TikTok).
- `Schedule` é enviado à Meta; o adaptador não inventa um evento equivalente no TikTok.
- `Contact` é enviado como `Contact` aos dois provedores.
- `Purchase`, `InitiateCheckout`, `ViewContent` e `PageView` mantêm mapeamentos existentes.

O envio continua assíncrono e legado: `tracked: true` significa que o dispatch foi agendado, não que a Meta/TikTok recebeu ou atribuiu o evento. Este caminho não grava recibo local nem executa retry; Test Events, EMQ e deduplicação observada permanecem fluxos/evidências separados. A aceitação de cada evento pela conta real continua dependendo de homologação autorizada.

## Validação

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm --filter @workspace/api-server test:server-events-consent
pnpm --filter @workspace/api-server test:server-events-payload
pnpm --filter @workspace/api-server typecheck
```

## Referências primárias

[SDK oficial Meta para Node.js](https://github.com/facebook/facebook-nodejs-business-sdk) demonstra o transporte Conversions API e usa `CustomData` para os campos do evento. [Modelo oficial Meta para `custom_data`](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/custom_data.py) lista os nomes padronizados. [Exemplo oficial TikTok Events API](https://business-api.tiktok.com/portal/docs/verify-events-setup/v1.3) mostra `event_id`, `contents`, `content_id`, `content_name`, `content_category`, `quantity`, `currency` e `value`.
