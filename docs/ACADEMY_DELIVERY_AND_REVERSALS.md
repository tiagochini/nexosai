# Entregas administrativas, brindes e estornos

Atualizado em 05/10/2026. [English](ACADEMY_DELIVERY_AND_REVERSALS.en.md).

## Escopo concluído

Confirmação administrativa, simulação local, reenvio do checkout, reenvio administrativo e brindes agora usam a fila persistente de acesso. Compra e intenção de envio são gravadas na mesma transação; confirmação repetida não gera outro envio. O histórico é preservado, com uma única tentativa ativa por compra. Resultados incertos (`sending`) exigem conciliação, inclusive quando um processo morre: não se força reenvio automático.

`sent` significa aceitação pelo provedor, não entrega na caixa de entrada. E-mails já enviados não podem ser recolhidos; a verificação do código passa a negar acesso revogado. Um envio já iniciado pode terminar durante o estorno.

## Contrato das rotas

Todas as rotas administrativas exigem `x-admin-secret` configurado; nunca passe o segredo na URL. Reenvios e lotes exigem também `Idempotency-Key` de 8 a 128 caracteres alfanuméricos, incluindo `:`, `_` ou `-`. Gere uma chave por intenção e reutilize-a nas tentativas da mesma solicitação. Conteúdo diferente com a mesma chave retorna 409.

| POST /api/academy | Corpo | Resultado |
| --- | --- | --- |
| `/admin/confirm` | `{ "purchaseId": "UUID" }` | Confirma e agenda o primeiro envio; repetição não reenvia. |
| `/admin/resend` | `{ "purchaseId": "UUID" }` | 202 com `jobId`; coalesce com envio agendado, rejeita envio incerto. |
| `/admin/gift-codes` | `{ "count": 3, "productId": "mini-guide" }` | 201 com códigos e IDs das compras; 1 a 50 brindes por lote. |
| `/admin/gift-delivery` | `{ "purchaseId": "UUID", "recipientEmail": "pessoa@example.com" }` | Atribui destinatário e agenda entrega; não permite trocar destinatário já atribuído. |

O lote aceita `recipientEmail` e `recipientName` opcionais. Sem destinatário, os códigos continuam disponíveis ao administrador, mas o envio fica `skipped/GIFT_RECIPIENT_NOT_ASSIGNED`; o endereço padrão nunca recebe e-mail. `recipientName` também é opcional na atribuição. Reenvio público do checkout tem intervalo de cinco minutos e não devolve código de acesso.

Clientes administrativos externos precisam enviar o novo cabeçalho nas rotas de brindes/reenvios. Nenhum consumidor dessas rotas foi encontrado no frontend deste repositório.

## Conciliação financeira

Nenhum estorno ou transferência financeira é iniciado por este código. Após webhook autenticado, consulta-se o estado atual no Asaas e valida-se a vinculação da cobrança. Apenas parcelas de estorno `DONE` entram no total acumulado; solicitações pendentes não são prova de devolução. `REFUNDED` exige comprovação integral. Divergências, regressão de valores e indisponibilidade não alteram saldo/acesso.

- Academy: estorno integral revoga o código e cancela trabalhos ainda agendados. Estorno parcial é registrado e mantém o acesso ao produto indivisível. Chargeback suspende o acesso; somente estado pago verificado remove a suspensão. Compra ainda não confirmada volta a pendente e percorre a confirmação normal antes de liberar acesso.
- Packs: estorno parcial reverte proporcionalmente os créditos, com arredondamento para baixo sobre o total acumulado; estorno integral reverte todo o pack. Chargeback retém os créditos do pack; liberação verificada restitui somente os créditos retidos. Transações e bloqueios de linha impedem débitos/créditos duplicados.
- Política autorizada pelo usuário: créditos já consumidos podem gerar saldo negativo. Novos consumos ficam bloqueados, inclusive em contas com crédito ilimitado, até repor o saldo. Renovação mensal abate a dívida, não a apaga; sua chave mensal impede concessão duplicada.
- Compras antigas sem concessão comprovada pela chave `billing-payment:<UUID>` recebem `reversalReview=LEGACY_CREDIT_GRANT_UNVERIFIED`. A situação financeira é registrada, mas não se presume um débito. Um operador deve conferir o extrato antes de qualquer ajuste manual.

Para listar pendências históricas sem expor e-mails ou credenciais:

```sql
SELECT id, workspace_id, status, metadata->>'reversalReview' AS reason
FROM subscription_payments
WHERE metadata->>'reversalReview' = 'LEGACY_CREDIT_GRANT_UNVERIFIED';
```

Garanta a assinatura dos eventos de estorno e chargeback em ambos os webhooks configurados no Asaas, incluindo `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_REFUND_DENIED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE` e `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`, além das confirmações existentes. A configuração externa não foi alterada nesta entrega.

## Operação e validação

Migrações: `0065_academy_delivery_intents.sql` e `0066_credit_refund_reversal.sql`. Pare a API antiga antes da 0065, pois muda a chave de conflito da fila; inicie a versão nova depois. A recuperação periódica segue desativada em `LOCAL_SAFE_MODE=true`; o despertar de pedidos interativos permanece ativo. Produção precisa do worker, de provedor configurado e de acompanhamento de trabalhos incertos.

Testes: `test:academy-delivery-lifecycle-db`, `test:billing-reversal-db`, `test:academy-access-outbox-db`, `test:academy-settlement-db`, `test:academy-admin-security`, `test:billing-credit-concurrency-db`, `test:billing-settlement`, `test:billing-webhook-security` e `test:academy-access-email`. Usam fixtures próprias e mocks: nenhum e-mail, cobrança ou estorno real. Tipos e build também validados. Testes sandbox ponta a ponta, configuração dos webhooks e conciliação histórica continuam verificações operacionais necessárias; isto não certifica todo o sistema para produção.

Referências oficiais: [estornos e estados das parcelas](https://docs.asaas.com/docs/estornos), [eventos de cobrança e chargeback](https://docs.asaas.com/docs/webhook-para-cobrancas).
