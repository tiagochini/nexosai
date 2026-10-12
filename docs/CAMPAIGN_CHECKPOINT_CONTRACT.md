# Tela da campanha — contrato de aprovações — 12/10/2026

Erro reportado: `Cannot read properties of undefined (reading 'includes')`.
A API de agentes retorna os registros com `checkpointType` e status `pending`.
A tela e o mapa esperavam `type` e `awaiting_review`. Ao abrir o mapa,
a classificação por fase acessava `type.includes` em um campo ausente.

Correção: tipo compartilhado e leitura do campo canônico `checkpointType`,
com compatibilidade para `type` em respostas antigas. Campo ausente produz
string vazia, sem derrubar a tela. Aprovações `pending` aparecem na revisão,
assim como respostas antigas `awaiting_review`. Nenhuma aprovação foi executada.

Evidências: dois testes de contrato aprovados; renderização do componente real
CampaignMindMap com checkpoint da API e com campo ausente aprovada. Typecheck
e build frontend passaram (485,4 KiB iniciais; orçamento 500 KiB).
Consulta somente leitura da campanha founder confirmou quatro checkpoints
pendentes: estratégia, cronograma, orçamento e conjunto de anúncios.
Dados da campanha e estratégia não foram alterados.

Aplicação de homologação reiniciada após detectar origem parada (502),
com Cloudflare já ativo. Portas 8090/8091 verificadas e origem pública
`https://agencianexos.vip` respondeu HTTP 200 após reinício.

Próximo checkpoint: usuário atualizar a campanha e abrir o mapa dos agentes.
Sem push; verificação autenticada no navegador e CI remoto pendentes.
