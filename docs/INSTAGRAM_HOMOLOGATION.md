# Homologação Instagram do founder

Conta autorizada para posts: **@agencianexosai**. Conta externa autorizada para
mensagem e comentário `mapa`: **@professorbruceallan**. Conexão e automações
devem pertencer ao workspace do founder@nexos.ai.

## Verificação realizada

O Supabase de homologação e a rota autenticada `/api/social/review-readiness`
confirmaram que esse workspace ainda não possui integrações Instagram/Facebook.
Sessões abertas no navegador não constituem uma integração no NexOS.
App e webhook Meta estão configurados. Nenhum post, comentário ou DM real foi
enviado nesta verificação.

Docker/Redis de homologação estavam indisponíveis; foram iniciados e passaram
autenticação/isolamento, schema e segurança. A aplicação foi reiniciada no perfil
de homologação. Saúde, readiness e login público do founder retornaram 200.

O NexOS utiliza Facebook Login, mas os dois fluxos OAuth e a lista de análise
solicitavam `instagram_business_manage_messages`, da família Instagram Login.
Foram alinhados para `instagram_manage_messages`. Tipos da API passaram; as
URLs produzidas pelas rotas autenticadas de Instagram e Facebook foram
verificadas no servidor ativo: host Facebook, permissão correta e sem mistura
com a permissão de mensagens Instagram Login. A sessão temporária de auditoria
foi encerrada pelo logout normal (204).

[Evidência sanitizada](./INSTAGRAM_HOMOLOGATION_RESULTS.json).
[Referência Meta: permissões da Conversations API no Facebook Login](https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a).

## Resultado da jornada real

Conexão founder e publicação aprovadas. [Post autorizado](https://www.instagram.com/p/DeTIE6-DjHT/), provider ID 18121984933902161. O NexOS publicou e confirmou por leitura independente. Token de Página, vínculo Page→IG e limite de publicação foram verificados no provider. Corrigidos: alias pageId/accountId do OAuth, consulta inválida de tasks no Instagram, publicação manual sem vínculo de campanha e campos text/username dos comentários. Aprovações e bindings de campanha continuam obrigatórios.

Webhook público verificado pela Meta e objeto Instagram ativo para comments, messages e messaging_postbacks. Página vinculada instalada no aplicativo para feed; mensagens de Página são Messenger e exigem pages_messaging, distinto das permissões Instagram.

Duas DMs reais chegaram ao workspace founder. A ausência de campanha aprovada produziu human_handoff/campaign_not_resolved; isso comprova recebimento e isolamento, não resposta contextual enviada.

Comentários reais MAPA receberam resposta pública pelo sync autenticado. Repetição não enviou novamente. A regra determinística está limitada ao media ID do post de teste. O endpoint legado de private_replies falhou; foi corrigido para Send API com recipient.comment_id e recibo message_id. A nova resposta privada ainda está em validação. Tentativas anteriores falhas permanecem registradas.

Testes locais com provedores simulados em PostgreSQL/Redis isolados: ownership, governance, webhook routing, MAPA (incluindo exclusão de outro post) e leitura Instagram/Facebook. Tipos e boundary contracts passaram. São evidências locais, separadas das chamadas reais.

## Resultado da jornada real

Conexão founder e publicação aprovadas. [Post autorizado](https://www.instagram.com/p/DeTIE6-DjHT/), provider ID 18121984933902161. O NexOS publicou e confirmou por leitura independente. Token de Página, vínculo Page→IG e limite de publicação foram verificados no provider. Corrigidos: alias pageId/accountId do OAuth, consulta inválida de tasks no Instagram, publicação manual sem vínculo de campanha e campos text/username dos comentários. Aprovações e bindings de campanha continuam obrigatórios.

Webhook público verificado pela Meta e objeto Instagram ativo para comments, messages e messaging_postbacks. Página vinculada instalada no aplicativo para feed; mensagens de Página são Messenger e exigem pages_messaging, distinto das permissões Instagram.

Duas DMs reais chegaram ao workspace founder. A ausência de campanha aprovada produziu human_handoff/campaign_not_resolved; isso comprova recebimento e isolamento, não resposta contextual enviada.

Comentários reais MAPA receberam resposta pública pelo sync autenticado. Repetição não enviou novamente. A regra determinística está limitada ao media ID do post de teste. O endpoint legado de private_replies falhou; foi corrigido para Send API com recipient.comment_id e recibo message_id. A nova resposta privada ainda está em validação. Tentativas anteriores falhas permanecem registradas.

Testes locais com provedores simulados em PostgreSQL/Redis isolados: ownership, governance, webhook routing, MAPA (incluindo exclusão de outro post) e leitura Instagram/Facebook. Tipos e boundary contracts passaram. São evidências locais, separadas das chamadas reais.

## Resultado da jornada real

Conexão founder e publicação aprovadas. [Post autorizado](https://www.instagram.com/p/DeTIE6-DjHT/), provider ID 18121984933902161. O NexOS publicou e confirmou por leitura independente. Token de Página, vínculo Page→IG e limite de publicação foram verificados no provider. Corrigidos: alias pageId/accountId do OAuth, consulta inválida de tasks no Instagram, publicação manual sem vínculo de campanha e campos text/username dos comentários. Aprovações e bindings de campanha continuam obrigatórios.

Webhook público verificado pela Meta e objeto Instagram ativo para comments, messages e messaging_postbacks. Página vinculada instalada no aplicativo para feed; mensagens de Página são Messenger e exigem pages_messaging, distinto das permissões Instagram.

Duas DMs reais chegaram ao workspace founder. A ausência de campanha aprovada produziu human_handoff/campaign_not_resolved; isso comprova recebimento e isolamento, não resposta contextual enviada.

Comentários reais MAPA receberam resposta pública pelo sync autenticado. Repetição não enviou novamente. A regra determinística está limitada ao media ID do post de teste. O endpoint legado de private_replies falhou; foi corrigido para Send API com recipient.comment_id e recibo message_id. A nova resposta privada tem recibo real confirmado. Tentativas anteriores falhas permanecem registradas.

Testes locais com provedores simulados em PostgreSQL/Redis isolados: ownership, governance, webhook routing, MAPA (incluindo exclusão de outro post) e leitura Instagram/Facebook. Tipos e boundary contracts passaram. São evidências locais, separadas das chamadas reais.

## Próximo checkpoint

1. Comprovar entrega autônoma do callback de comentário. Sync manual de comentário real não encerra esse requisito.
2. Vincular uma campanha/flow aprovado para demonstrar resposta contextual de DM; preservar encaminhamento humano quando falta contexto.
3. Conferir contadores do painel Meta. Facebook Login não comprova as permissões instagram_business_* de Instagram Login.

Nenhum push executado.

Referência do fluxo Facebook Login: [exemplo oficial Instagram da Meta](https://github.com/fbsamples/original-coast-clothing-ig/blob/main/services/graph-api.js), com token de Página em `/me/messages` e instalação da Página em `/subscribed_apps` para `feed`. A resposta privada confirmada foi uma recuperação autorizada de comentário real, com claim separado; não representa callback autônomo de comentário nem resposta de IA a DM livre. As retentativas agora exigem workspace, integrationId e accountId correspondentes e aceitam recibos `message_id`.
