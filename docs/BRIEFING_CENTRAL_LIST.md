# Briefing Central — catálogo correto

Verificado em 11/10/2026 no ambiente público de homologação.

A tela `/intake` consultava `/api/products`, catálogo de produtos de checkout.
Por isso mostrava o produto fictício Asaas em vez do lançamento do founder e
usava um ID de checkout em uma rota que espera um produto comercial.

Agora lista `/api/campaigns`, respeitando o workspace autenticado, apresenta o
título da campanha e abre `/campaigns/:id/intake` para continuar a conversa.
As chaves de cache incluem o workspace; falhas de consulta têm opção de repetir.
A visualização canônica de produto permanece disponível pelas rotas existentes.
Nenhum produto, campanha ou registro financeiro foi excluído.

Validação: tipos do frontend e build passaram (485,4 KiB de JavaScript inicial,
limite 500 KiB). Consulta autenticada pública confirmou apenas a campanha
“Primeiro Lançamento NexOS 2026”. Fonte servida pelo frontend público confirmou
uso do endpoint de campanhas e remoção do endpoint de checkout nesta tela.
Não foi executada uma nova conversa de IA nem inspeção visual automatizada.

[Resultados](./BRIEFING_CENTRAL_LIST_RESULTS.json).
Próximo checkpoint: founder continuar o briefing e validar as respostas reais.
Commit local, sem push.
