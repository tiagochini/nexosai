# Confirmação de pagamentos Academy

Atualização: 05/10/2026. Validação local com provedor e e-mail simulados.

## Correção

O webhook autenticado agora localiza a compra pelo `asaasPaymentId` já gravado,
nunca pelo `externalReference` enviado na notificação. Não substitui esse vínculo
com dados do evento. Antes de confirmar, consulta a cobrança no Asaas e confere:

- ID do pagamento e referência externa igual ao UUID da compra;
- cliente do provedor igual ao cliente já vinculado;
- valor em centavos igual ao preço registrado, sem usar o valor líquido após tarifas;
- cobrança não excluída e forma compatível: Pix, boleto ou cartão.

Pix/boleto exigem `RECEIVED`; cartão também aceita `CONFIRMED`. Aprovação de
análise de risco não basta: vale o estado consultado. Notificações de estados
ainda não elegíveis são reconhecidas sem liberar acesso. Eventos desconhecidos
continuam ignorados. Payload financeiro sem ID válido retorna 400 antes de consultar
compras/provedor. Webhook sem token continua bloqueado antes desse processamento.

## Atomicidade e privacidade

A consulta HTTP fica fora da transação, com limite de 10 segundos. A compra é
bloqueada e seu vínculo revalidado antes da alteração. Somente `pending` pode
virar `confirmed`. A confirmação e a marcação dos leads correspondentes como
convertidos são gravadas juntas. Isso evita uma confirmação parcialmente gravada
entre essas duas operações.

Entre webhooks concorrentes, somente o vencedor da transação agenda o e-mail.
Replay de compra confirmada não modifica o horário, não consulta o provedor e
não agenda outro envio. O reconhecimento HTTP não contém código de acesso,
e-mail ou nome. A resposta completa do provedor não é persistida nem registrada.

Falha/timeout HTTP ou JSON ilegível: 503; resposta incompleta: 502; divergência,
ID de pagamento duplicado, estado terminal ou vínculo alterado: 409. A compra e
o lead permanecem sem confirmação/conversão. Depois de corrigida uma falha
transitória, o evento pode ser reenviado e confirmado.

## Configuração e validação

A seleção de ambiente preserva a regra existente da Academy: `ASAAS_SANDBOX=true`
usa sandbox; caso contrário usa produção, com `ASAAS_API_KEY`. Ela não passa a
usar `ASAAS_ENV` do billing. Os testes injetam respostas e proíbem chamadas externas;
nenhum segredo privado foi gerado, exibido ou modificado.

```powershell
pnpm --filter @workspace/api-server run test:academy-settlement-db
```

O teste HTTP/banco cobre 16 notificações simultâneas, um único agendamento
simulado, replay, privacidade da resposta, notificações falsas, conferência de
ID/cliente/referência/valor, aprovação de risco, estados não elegíveis, cartão e
boleto, indisponibilidade/retry, objeto inválido, vínculo alterado durante consulta,
estado terminal, ID duplicado e pagamento desconhecido. Também verifica ambiente,
URL escapada, método GET e prazo no transporte com mocks. Fixtures são removidas
por seus UUIDs no `finally`. Incluído no job de banco do workflow, sem push.

Referências: [consulta pontual da cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca),
[criação e ressalva de Pix confirmado](https://docs.asaas.com/reference/criar-nova-cobranca),
[confirmação de cartão](https://docs.asaas.com/reference/pay-a-charge-with-credit-card).

## Limites e próximos passos

Sem migração de schema ou reparação automática de compras históricas. Compras
sem pagamento/cliente vinculado precisam de conciliação, não confirmação baseada
na referência da notificação. Registros já confirmados não são revalidados neste fluxo.

A confirmação por webhook agora cria uma [fila durável](./ACADEMY_ACCESS_EMAIL_OUTBOX.md)
na mesma transação. Itens não iniciados podem ser retomados; resultados ambíguos
não são reenviados cegamente. Isso não garante entrega na caixa do cliente. Rotas administrativas de confirmação
e reenvio continuam separadas e não têm essa mesma certificação de concorrência.
Estornos/revogação, reconciliação histórica, falha entre cobrança e persistência,
auditoria por sessão e teste ponta a ponta no sandbox continuam pendentes. O estado
remoto pode mudar após a consulta; não há transação distribuída com o Asaas.
