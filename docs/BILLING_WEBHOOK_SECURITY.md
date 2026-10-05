# Billing — autenticação financeira

Revisão local: 5 de outubro de 2026. [English](./BILLING_WEBHOOK_SECURITY.en.md).

## Webhook

`POST /api/billing/webhooks/asaas` não processa eventos sem token válido.
Credenciais ausentes, incorretas, em array, somente na URL ou configuração
vazia/com espaços nas extremidades retornam `401` e `UNAUTHORIZED_WEBHOOK`
antes de consultar pagamentos, alterar planos/créditos ou chamar provedores.

Enviar o token pelo cabeçalho `asaas-access-token`, por HTTPS. O segredo usado é:

1. `ASAAS_WEBHOOK_SECRET`, se a variável legada estiver definida;
2. `ASAAS_WEBHOOK_TOKEN`, somente quando a variável legada estiver ausente.

Uma variável legada definida como vazia bloqueia o billing, mesmo que a variável
compartilhada esteja preenchida. Para usar o token compartilhado, remover a
variável legada, não apenas esvaziá-la. Academy e checkout de produtos usam
`ASAAS_WEBHOOK_TOKEN`. O mesmo comparador de tempo constante é usado nos três
fluxos, sem registrar tokens. Tokens não vazios têm limite defensivo de 1.024
caracteres; o servidor não cria segredo padrão.

Configurar o mesmo token privado no endpoint do provedor e no servidor.
Nenhuma credencial ou configuração no Asaas foi alterada nesta etapa. Sem
configuração válida, webhooks ficam bloqueados após aplicar o novo código.

## Confirmação manual

`POST /api/billing/confirm/:paymentId` mantém autenticação do usuário e a
restrição do pagamento ao workspace, mas agora exige também
`BILLING_MANUAL_CONFIRM_SECRET` privado, aleatório, de 32–256 caracteres no
servidor e no cabeçalho `x-billing-admin-secret`. Sem isso, retorna `403` e
`MANUAL_CONFIRMATION_FORBIDDEN`, sem consultar ou confirmar o pagamento.

O fluxo anterior permitia a um usuário autenticado confirmar seu próprio
pagamento; esse comportamento foi bloqueado. Clientes antigos sem o novo
cabeçalho não poderão confirmar manualmente. Não colocar esse segredo no
JavaScript público, URLs, logs ou repositório. Nenhum segredo foi gerado ou
gravado no `.env.local`. Essa credencial adicional é provisória: autorização
por papel administrativo e trilha de auditoria continuam pendentes.

## Validação e limites

```powershell
pnpm --filter @workspace/api-server run test:billing-webhook-security
pnpm --filter @workspace/api-server run test:academy-admin-security
pnpm --filter @workspace/api-server run test:product-asaas-sandbox-unit
```

Testes HTTP locais exercitam bloqueios, precedência das variáveis e usuário
autenticado sem privilégio adicional. A verificação positiva de confirmação
manual testa somente o guard, não executa confirmação. Eventos autenticados
de teste sem ID de pagamento são ignorados, sem banco ou provedor. Não houve
pagamento real, alteração de assinatura, concessão de crédito ou e-mail real.

Typecheck, build e segurança dos logs passaram localmente. Workflow atualizado,
sem execução remota porque não houve push. A API em execução não foi reiniciada.
Sem migração de banco nem alteração de pagamentos existentes.

Autenticação de origem não garante que um pagamento foi liquidado. Permanecem
pendentes revisão de conciliação com o provedor, idempotência/concorrência na
concessão de créditos e confirmação manual, replay, autorização administrativa
por sessão e auditoria. Não considerar billing integralmente certificado.
Rollback do código pode reintroduzir os acessos inseguros; preferir correção
adiante e não reabrir rotas por ausência de segredo.
