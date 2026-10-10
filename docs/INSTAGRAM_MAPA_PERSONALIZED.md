# MAPA personalizado — founder — 10/10/2026

O workspace de founder@nexos.ai já possui plano Agency, status ativo e 2.000
créditos. O estado foi conferido no banco e em `/api/auth/me`; nenhum pagamento
ou crédito adicional foi criado para este teste.

A configuração autenticada de moderação foi salva e relida com a regra MAPA
limitada ao post https://www.instagram.com/p/DeTIE6-DjHT/ da conta @agencianexosai.

Texto privado: “Que bom, {nome}, que você quer o mapa do sucesso!”

Texto público após recibo do Direct: “Que bom, {nome}, que você quer o mapa do
sucesso! Já encaminhei uma mensagem no seu Direct.”

`{nome}` usa o nome/usuário fornecido pela Meta; ausência usa “amigo(a)”. O envio
privado ocorre primeiro. `{confirmacao_direct}` só aparece no texto público se
a Meta devolver um ID de mensagem sem erro. Uma falha ou política privada
desabilitada mantém o agradecimento público sem afirmar envio. Não há envio de
arquivo ou e-mail: este teste confirma a solicitação por texto.

As cinco regressões de publicação, governança, roteamento, MAPA e leitura de
comentários passaram em PostgreSQL/Redis Docker isolados. O teste MAPA cobre
personalização, nome literal, fallback, falha privada sem confirmação falsa,
política privada desabilitada, replay e isolamento entre contas/workspaces.
TypeScript passou. Redis de homologação foi iniciado e verificado; endpoints
públicos de saúde e prontidão retornaram HTTP 200.

Evidência: [estado e configuração](INSTAGRAM_MAPA_PERSONALIZED_RESULTS.json).
As respostas reais históricas estão em
[homologação anterior](INSTAGRAM_HOMOLOGATION_RESULTS.json); elas não comprovam
o novo texto nem callback automático de comentário.

Próximo checkpoint: receber um novo comentário de @professorbruceallan sem
sincronização manual, conferir evento do webhook no workspace founder, recibos
público/privado e conteúdo final. Para Meta App Review, coletar captura/gravação
do comentário, resposta pública e Direct e conferir os contadores no painel Meta.
Nenhuma aprovação do App Review é inferida a partir das regressões locais.
