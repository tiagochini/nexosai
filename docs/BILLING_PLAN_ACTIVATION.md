# Ativação e reversão de planos

Pagamento de plano aprovado ativa `workspaces.plan_id` e concede os créditos
incluídos na mesma transação do pagamento. O saldo existente é preservado:
comprar Agency acrescenta 2.000 créditos, sem apagar créditos de outras compras.
O catálogo do plano passa a fornecer os demais limites e capacidades do workspace.

Cartão aprovado na criação e confirmação posterior por webhook usam a mesma
ativação. O webhook consulta o estado canônico no Asaas e confere ID, valor,
moeda e método. Pagamento e workspace são bloqueados durante a transação; a
chave `billing-payment:<UUID>` concede os créditos uma única vez. Falha na
concessão desfaz pagamento, plano e ledger juntos. Nenhum bloqueio de banco é
mantido durante chamadas ao provedor.

Os créditos contratados ficam registrados na cobrança e os créditos realmente
concedidos e o plano base ficam no histórico de ativação. Estorno integral
remove os créditos daquela compra e restaura o plano pago mais recente ainda
válido, ou o plano base anterior às compras. Estornar uma compra antiga não
remove um plano pago mais recente nem ressuscita um predecessor já estornado.
Créditos consumidos podem produzir dívida, seguindo a política de reversão
existente. Estorno parcial reverte a proporção cumulativa dos créditos e mantém
o plano até estorno integral; chargeback suspende os benefícios da compra e a
recuperação canônica os restaura sem duplicação.

`/api/billing/status` considera apenas compras de plano, excluindo packs. Como
os planos do catálogo e da cobrança são de acesso vitalício, não aplica uma
expiração automática de 30 dias nem informa uma próxima mensalidade.

Pagamentos antigos já marcados pagos sem histórico de ativação não recebem
créditos automaticamente por replay: exigem reconciliação individual com prova
do que já foi concedido. Não foi executado backfill de históricos reais.

Regressão local: `node scripts/test-billing-local.mjs`, com Docker e a imagem
`nexos-api:p3-test` disponível. A fonte atual é montada somente para leitura em
containers descartáveis, com banco exclusivo e provedores simulados; a Supabase
não é utilizada. O teste de ativação também integra CI e o runner P3.

[Regressões locais](./BILLING_LOCAL_VALIDATION.json) e
[reteste Asaas sandbox](./ASAAS_BILLING_SANDBOX_RETEST_RESULTS.json) passaram.
O reteste externo cobre cartão aprovado, Agency, pack de 500 créditos, repetição,
isolamento e estornos integrais. PIX/boleto, estorno parcial, chargeback e cartão
rejeitado não estão comprovados externamente por essa rodada.
