# Eventos de compra e checkout para Meta CAPI

O NexOS recebe eventos de navegador e servidor em `POST /api/paid-media/events/ingest`. A autenticação é uma chave opaca de ingestão do dataset, enviada em `x-paid-media-ingestion-key`; ela não é o token da Meta. O endpoint guarda um recibo idempotente por `eventId` e só encaminha eventos `server` para a CAPI se `payload.marketingConsent` for `true` e houver chave de correspondência permitida e consentida.

## Configuração

1. No NexOS, abra **Mídia paga → Integrações & Sync → Datasets** e registre o Pixel/Dataset da conta Meta correta.
2. Copie a chave de ingestão exibida no momento do registro e guarde-a em um secret manager do servidor do cliente. Ela não deve ir para código JavaScript público, analytics, logs ou repositório.
3. No backend do checkout/CRM do cliente, emita um evento no estado final real (pagamento aprovado para `Purchase`; checkout iniciado para `InitiateCheckout`). Use o ID imutável do pedido/checkout como `eventId`, com escopo por dataset.
4. Envie horário UTC, moeda ISO de três letras e valor em `payload`; inclua somente identificadores de correspondência que o cliente tem direito de compartilhar e para os quais há consentimento de marketing.

## Exemplo Node.js no servidor do cliente

```js
const response = await fetch(`${NEXOS_API_URL}/api/paid-media/events/ingest`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-paid-media-ingestion-key": process.env.NEXOS_META_DATASET_KEY,
  },
  body: JSON.stringify({
    source: "server",
    eventId: `purchase:${order.id}`,
    eventName: "Purchase",
    occurredAt: order.paidAt.toISOString(),
    matchKeys: {
      email: customer.marketingConsent ? customer.email : undefined,
      phone: customer.marketingConsent ? customer.phoneE164 : undefined,
      externalId: customer.marketingConsent ? customer.id : undefined,
      fbp: checkout.fbp,
      fbc: checkout.fbc,
    },
    payload: {
      marketingConsent: customer.marketingConsent === true,
      value: Number(order.total),
      currency: order.currency,
      order_id: order.id,
    },
  }),
});
if (!response.ok) throw new Error(`NexOS event ingestion failed: ${response.status}`);
const receipt = await response.json();
```

O servidor deve reenviar a mesma compra com o mesmo `eventId` se a chamada falhar; o endpoint impede a criação de recibos duplicados. Se também houver Pixel no browser, use exatamente o mesmo `eventId` no `eventID` do evento de navegador. `202` e um recibo local confirmam recepção pelo NexOS, não comprovam Event Match Quality nem a deduplicação no Events Manager. Confira os estados em **Datasets → Diagnósticos** e valide a entrega no Events Manager da Meta em homologação.

O NexOS não consegue instalar o hook dentro de um checkout/ERP externo sem acesso ao código ou aos webhooks do cliente. Essa configuração final depende do desenvolvedor/fornecedor do sistema de origem e do consentimento aplicável.
