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
pendentes conciliação com o provedor, proteção de replay do evento, autorização
administrativa por sessão e auditoria. Não considerar billing integralmente certificado.
Rollback do código pode reintroduzir os acessos inseguros; preferir correção
adiante e não reabrir rotas por ausência de segredo.

## Confirmação e créditos atômicos — 05/10/2026

A confirmação manual e a confirmação pelo ID externo agora compartilham uma
transação: bloqueiam o pagamento, alteram seu status e concedem o pack junto com
o extrato. O saldo também é bloqueado para evitar perda de atualizações. A chave
`billing-payment:<UUID>` usa o índice único de idempotência já existente; não
exige migração. Concessões diretas de crédito passaram a ser transacionais.
Cartão aprovado recebe créditos antes do commit, sem tarefa assíncrona silenciosa.

Somente estados `pending` e `processing` podem virar `paid`. Estados terminais
retornam conflito e precisam de conciliação explícita. ID externo associado a
mais de um pagamento é bloqueado. Repetir um pagamento já pago não muda o
registro nem reaplica créditos, inclusive nos registros históricos sem chave.
Isso não corrige automaticamente eventuais saldos históricos inconsistentes.

Teste `test:billing-credit-concurrency-db`: 16 confirmações simultâneas entre
caminhos manual/provedor; 8 pagamentos distintos; grants concorrentes; chave
repetida; conflito entre workspaces; valor inválido; overflow; rollback e retry;
isolamento de workspace; estado terminal; ID externo ambíguo; cartão aprovado
com provedor simulado e replay. Fixtures próprias são removidas no `finally`.
Chamadas externas são proibidas no teste. Incluído no job de banco do workflow.

Limites: uma cobrança aceita pelo provedor seguida de falha no banco ainda exige
conciliação; esta transação local não torna o provedor transacional. Reset
mensal de saldo e reversão de créditos não foram corrigidos nesta etapa. Nenhuma
cobrança real foi feita; API não reiniciada, sem push e sem alterar segredos.

## Consulta canônica e reinício local — 05/10/2026

Antes da confirmação por ID externo, o billing consulta `GET /v3/payments/{id}`
na conta Asaas configurada. O corpo do webhook é uma notificação, não prova de
pagamento. ID, `value` convertido em centavos, moeda local BRL e forma de
pagamento precisam corresponder ao registro. Não se compara `netValue`, que
desconta tarifas. Consulta com prazo de 10 segundos; indisponibilidade, resposta
HTTP não bem-sucedida ou JSON ilegível retornam 503 sem confirmar ou conceder.
Objeto incompleto retorna 502; divergência ou cobrança excluída retorna 409.

Pix e boleto só são liberados em `RECEIVED`; cartão também aceita `CONFIRMED`.
Pix `CONFIRMED` pode estar em bloqueio cautelar, portanto aguarda o evento de
recebimento. Estados ainda não elegíveis são reconhecidos sem mutação local.
A confirmação manual continua separada, protegida pelo guard administrativo.

A consulta ocorre fora da transação para não bloquear o banco durante HTTP.
Depois, o ID do registro e o vínculo de ID/valor/forma são conferidos novamente
sob bloqueio. A prova salva contém somente ID, status, valor em centavos, forma
e horário da consulta; novos fluxos não persistem o objeto completo nem o corpo
bruto da notificação. Dados históricos não foram apagados. Replay de registro
já pago não consulta o provedor nem refaz a concessão.

`test:billing-settlement` cobre contrato, estados, valores, identificação, moeda,
prazo, URL escapada, erros HTTP, timeout e respostas inválidas usando mocks.
O teste de banco também cobre notificação falsa, queda do provedor, retry e
mudança do valor durante a consulta. Nenhuma chamada real ao Asaas é realizada.

Referências oficiais: [consulta da cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca),
[criação e ressalva Pix](https://docs.asaas.com/reference/criar-nova-cobranca),
[retorno de cartão e campos de valor](https://docs.asaas.com/reference/pay-a-charge-with-credit-card).

Projeto iniciado pelo script `scripts/dev-local.mjs`, preservando o modo seguro
local existente: sem schedulers/recuperação automática. API na 8080 e frontend
na 8081. Esta etapa não altera segredos nem habilita rotas sem credenciais.
Continuam pendentes conciliação de entregas incertas Academy, estornos/reversões, recuperação entre cobrança e
persistência, conciliação histórica, auditoria por sessão e validação ponta a ponta
no sandbox. O estado remoto ainda pode mudar após a consulta; não há transação
distribuída com o provedor, nem certificação integral de billing.
