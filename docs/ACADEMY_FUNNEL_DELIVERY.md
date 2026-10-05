# Academy — estado real de envio

Atualizado em 4 de outubro de 2026. [English](./ACADEMY_FUNNEL_DELIVERY.en.md).

## Correção

Sem `RESEND_API_KEY` nem o par `GMAIL_USER`/`GMAIL_APP_PASSWORD`, o e-mail
permanece `scheduled`, com `EMAIL_PROVIDER_NOT_CONFIGURED`, `sentAt` e
`resendId` nulos. Não existe mais envio fictício `dev-no-provider`. O scheduler
pode tentar novamente após a configuração do provedor e reinício da API.

Resend tem prioridade. Gmail funciona quando apenas Gmail está configurado.
O resultado `sent` exige um identificador válido retornado pelo Resend ou
aceitação do destinatário pelo Gmail com identificador da mensagem.
**Isso significa aceitação pelo provedor, não entrega na caixa de entrada.**
Falhas ficam `failed`, com códigos limitados; corpos de resposta e mensagens
de exceção do provedor não são persistidos. Não há fallback após falha do
Resend, pois a aceitação pode ter ocorrido antes de uma interrupção de rede.

O lead começa em `funnelStep = -1`. Boas-vindas e scheduler só avançam após
aceitação, sem regredir uma etapa posterior. Boas-vindas respeitam descadastro
e não reenviam registros `sent` ou `skipped`. O scheduler mantém as regras de
descadastro e exclusão das ofertas para leads convertidos.

## Concorrência e interrupção

A inscrição é transacional e idempotente por ID de lead: somente uma atualização
condicional de `funnelEnrolledAt` nulo cria os cinco e-mails. Chamadas repetidas
não reiniciam a sequência nem apagam o progresso. Isso não deduplica leads
distintos com o mesmo endereço de e-mail ou registros duplicados históricos.

Antes do envio, um compare-and-set no PostgreSQL reserva o registro, passando
de `scheduled` para `sending`. Somente o vencedor envia; as outras chamadas
de boas-vindas/scheduler não processam o mesmo registro. As regras de
descadastro/conversão são consultadas novamente após a reserva. Uma mudança
de consentimento depois dessa consulta ainda pode coincidir com o envio.

O resultado do e-mail e o avanço do lead são gravados na mesma transação.
Se houver interrupção ou falha de persistência, o registro pode ficar `sending`
com `DELIVERY_IN_PROGRESS_OR_UNKNOWN`. Não existe retomada automática desse
estado: é preciso conferir o provedor antes de qualquer reprocessamento.
O campo `sending` nas estatísticas do funil permite identificar esses casos,
mas não diferencia sozinho envio ativo de envio interrompido.

O teste de banco cobre oito inscrições concorrentes, disputa simultânea entre
16 chamadas de boas-vindas/scheduler, envio mantido em andamento e interrupção
simulada. São conexões PostgreSQL concorrentes no mesmo processo de teste;
testes de queda real entre múltiplas instâncias continuam pendentes.

## Validação

```powershell
pnpm --filter @workspace/api-server run test:academy-funnel-delivery
pnpm --filter @workspace/api-server run test:academy-funnel-db
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
pnpm run security:check-runtime-logging
```

O teste de banco exige `DATABASE_URL` e configuração válida da API. Cria um
lead temporário e remove-o com seus e-mails no `finally`. Todos os transportes
são simulados; o scheduler é limitado ao lead de teste. Nenhum e-mail real é
enviado. As verificações locais acima passaram; o workflow foi atualizado,
mas não executado remotamente nesta etapa, porque não houve push.

## Operação e limites

- Reiniciar a API com o novo build para aplicar a correção. Não foi realizado
  reinício automático nem teste de envio real.
- Sem mudança de schema. Registros históricos não foram alterados. Para localizar
  falsos sucessos antigos, usar somente leitura:

  ```sql
  SELECT count(*) FROM academy_funnel_emails
  WHERE resend_id = 'dev-no-provider';
  ```

  Não reenviar em massa. Revisar consentimento, conversão, idade e duplicação
  antes de decidir qualquer reprocessamento.
- `failed` e `sending` não são retentados automaticamente, nem por chamadas
  de boas-vindas. Antes de reabrir um registro como `scheduled`, conferir
  aceitação no provedor, consentimento, conversão e duplicação. Não foi criado
  endpoint de reprocessamento nesta etapa.
- Permanecem pendentes: deduplicação de leads/histórico, idempotência no provedor,
  retentativas com backoff, limite de idade dos pendentes, webhooks de entrega/bounce,
  alertas para envios interrompidos e conciliação operacional quando
  o provedor aceita mas a gravação no banco falha e revisão completa do fluxo
  de consentimento/descadastro. Esta correção não certifica entrega exatamente uma vez.
- Rollback: restaurar somente o código anterior e reconstruir a API. Não exige
  rollback de banco, mas reintroduziria os falsos sucessos; preferir correção
  adiante. Código antigo não reconhece `sending`; esses registros precisam de
  conciliação, não conversão em massa para pendentes. Não modificar registros aceitos.
