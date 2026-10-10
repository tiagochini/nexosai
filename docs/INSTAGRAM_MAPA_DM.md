# MAPA recebido no Direct — founder — 10/10/2026

A DM original chegou pelo webhook, porém não havia fluxo global/post-level para
MAPA. A política contextual encaminhou a conversa para humano por ausência de
campanha aprovada. Responder privadamente a um comentário não configura a regra
de resposta a uma nova DM enviada pelo interessado.

Foi implementada a política explícita `immediateDmKeywordReplies` na configuração
de moderação do workspace. Valor padrão vazio mantém a política desativada. O
founder configurou MAPA com o texto:

> Que bom! Você quer o mapa do sucesso. Recebi seu pedido por aqui no Direct.

O processamento usa a integração orgânica conectada associada à conta receptora;
roteamento ambíguo falha fechado. A regra usa palavras normalizadas e pode
reconhecer MAPA, mapa ou “quero o mapa”. Ela recebe precedência sobre sequência/IA
para evitar duas respostas à mesma mensagem. A resposta fixa não exige contexto
de campanha nem altera aprovações para respostas contextuais. Nenhum envio de
material ou e-mail é afirmado.

O Facebook Login usa `/me/messages` com token de Página e `recipient.id` do
remetente. O token permanece no cabeçalho e não entra no histórico de evidências.
Somente resposta HTTP aceita com ID de mensagem registra envio concluído;
falha ou recibo ausente registra falha. A mensagem recebida possui claim
idempotente por conta/providerEventId; replay não produz um novo envio. Eventos
da própria conta e contas sem integração não acionam a regra.

Testes em PostgreSQL/Redis Docker isolados cobrem processador real de webhook,
caso/frase, destinatário, vínculo de integração, recibo, falha, replay, conta
desconhecida e eco. Os seis testes de Instagram passaram e TypeScript passou.
O novo teste integra `scripts/test-p3-local.mjs`. Configuração foi salva e relida
pela API autenticada no workspace founder; runtime carregado e saúde/prontidão
retornaram HTTP 200. [Evidência de preparação](INSTAGRAM_MAPA_DM_RESULTS.json).

Próximo checkpoint: nova DM real “mapa teste direct” de @professorbruceallan para
@agencianexosai recebida via webhook e recibo da resposta. A mensagem antiga não
foi reenviada nem teve o histórico reescrito. Nenhum push executado.
