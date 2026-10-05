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
- `failed` não é retentado automaticamente pelo scheduler. Boas-vindas podem
  ser retentadas por chamada explícita. Interrupções com resultado ambíguo
  exigem conciliação com o provedor antes de nova tentativa.
- Permanecem pendentes: claim atômico entre processos/boas-vindas/scheduler,
  idempotência de inscrição e envio, retentativas com backoff, ordenação e
  limite de idade dos pendentes, webhooks de entrega/bounce, conciliação quando
  o provedor aceita mas a gravação no banco falha e revisão completa do fluxo
  de consentimento/descadastro. Esta correção não certifica entrega exatamente uma vez.
- Rollback: restaurar somente o código anterior e reconstruir a API. Não exige
  rollback de banco, mas reintroduziria os falsos sucessos; preferir correção
  adiante. Não modificar os registros de envio aceito.
