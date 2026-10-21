# Dados de homologação Instagram / Meta

Conjunto de entradas preparadas para completar a homologação de `@agencianexosai`.
Os valores abaixo são dados de teste; IDs e resultados devem ser capturados das
respostas reais da Meta. Não usar IDs inventados para preencher evidências.

## Conta e mídia

| Campo | Valor |
| --- | --- |
| Conta de teste | `@agencianexosai` |
| Mídia de homologação | `https://agencianexos.vip/homologacao-instagram-20261014.jpg` |
| Acesso à mídia verificado | HTTP 200, `image/jpeg`, 79.237 bytes |
| Legenda proposta para publicação | `Teste técnico de integração NexOS com Instagram. Conteúdo temporário de homologação; sem oferta comercial.` |
| Tipo recomendado | Post de imagem no feed |

Antes de publicar, confirmar que a arte é apropriada para o perfil. Após publicar,
guardar o `creation_id`, o media ID retornado, URL do post e timestamp. Excluir o
post de teste depois de guardar a evidência, se a Meta permitir e a conta aprovar.

## Casos por operação/permissão

| Caso | Entrada de teste | Operação no NexOS/Meta | Evidência esperada |
| --- | --- | --- | --- |
| Identidade (`instagram_business_basic`) | Conectar diretamente como `@agencianexosai` | Testar conexão | HTTP 200, username e ID de conta; token nunca entra no relatório |
| Publicação (`instagram_business_content_publish`) | Legenda acima + URL JPEG | Publicar post de feed | IDs reais de container e mídia, post visível no perfil e timestamp |
| Insights (`instagram_business_manage_insights`) | Post publicado ou mídias existentes; janela dos últimos 30 dias | Atualizar analytics | Resposta Graph 200, nome das métricas suportadas e timestamp; indisponível permanece indisponível, sem inventar zero |
| Comentário público/privado (`instagram_business_manage_comments`) | Publicar `mapa homologação NexOS` como conta de teste sob o post | Receber webhook, responder publicamente e enviar resposta privada ao comentário | ID real do comentário, IDs das respostas e leitura posterior confirmando publicação |
| Direct (`instagram_business_manage_messages`) | Enviar `mapa homologação NexOS` de uma conta de teste para `@agencianexosai` | Receber webhook e responder pela conversa | ID do evento, ID da resposta, entrega visível no Direct e timestamp |
| Curtir mídia/comentário (`instagram_manage_engagement`, Facebook Login) | Curtir uma única vez um comentário de homologação na conta conectada | OAuth Facebook Login; `POST /{ig-user-id}/likes?comment_id={comment-id}` | ID real, sucesso Graph e estado curtido |
| Excluir mídia (`instagram_manage_contents`, Facebook Login) | Excluir somente a publicação temporária de homologação preparada para esse teste | `DELETE /{ig-media-id}` | ID real, HTTP/Graph 200 e confirmação de remoção |

## Evidências ao vivo — 15–16/10/2026

- O usuário concedeu `instagram_manage_engagement` e `instagram_manage_contents` no Facebook Login. `GET /me/permissions` retornou ambos com status `granted`.
- Conta Página resolvida pela API: DasKapital.io, com a conta profissional Instagram vinculada `17841448570547453`.
- `instagram_manage_engagement`: `POST /17841448570547453/likes?comment_id=18119664329055593` retornou `{"success":true}`. A tentativa em `/{comment-id}/likes` falhou com Graph code 100/subcode 33; o endpoint da IG User acima foi o que funcionou.
- Container temporário criado: `18065706113619019`; `status_code=FINISHED`.
- Post de homologação publicado em `2026-10-15T11:34:06Z`: media ID `17902019661376123`, permalink `https://www.instagram.com/p/Deg3EwqnA3Y/`, legenda conforme fixture.
- O usuário confirmou a exclusão específica; `DELETE /17902019661376123` retornou `success=true` e `deleted_id=17902019661376123`. A consulta GET seguinte retornou Graph code 100/subcode 33 (objeto não mais disponível).
- Na primeira captura, o painel ainda mostrava 0/1; a Meta informa que as métricas podem levar até 24 horas para aparecer.
- Reconsulta do painel Testing em 16/10/2026: `instagram_manage_engagement` = Completed e `instagram_manage_contents` = Completed. “Manage messaging & content on Instagram” aparece como Testing complete.

Os cinco casos `instagram_business_*` usam Instagram Login direto. Os dois casos
`instagram_manage_*` antigos são do Facebook Login; não atribuir resultados do
token direto a essas permissões. O estado atual do repositório registra identidade,
webhooks de comentário/Direct e insights reais como concluídos; publicação da
versão corrigida no servidor continua pendente.

## Separação de contadores Meta

O Founder confirmou em 15/10/2026 que o limiar de Marketing API Access Tier (500
chamadas e taxa de sucesso mínima de 85%) foi concluído. Ele não é mais uma
pendência desta homologação. O relatório de 14/10/2026 registra a captura anterior
do painel (`0/500`) e deve ser lido como histórico daquele momento.

O painel de permissões Instagram pode levar até 24 horas para refletir chamadas
reais. A janela já passou e a reconsulta de 16/10/2026 registra os dois escopos
como concluídos. Não repetir operações para inflar contadores.

## Checklist de captura

- [ ] Produção contém o commit com a correção do host de validação do Instagram Login.
- [ ] Reconectar/testar `@agencianexosai` no NexOS; registrar HTTP/status e username, sem token.
- [x] Founder revisa arte e legenda antes de publicar o post temporário.
- [x] Rodar uma vez cada operação aplicável e guardar IDs/timestamps reais.
- [x] Confirmar comentários, respostas e mensagens pela API/leitura da plataforma (IDs e readbacks registrados em `EXECUTION_INTEGRATIONS_VALIDATION.md`).
- [x] Para `instagram_manage_engagement`, conectar Facebook Login e concluir uma curtida legítima.
- [x] Para `instagram_manage_contents`, excluir apenas a publicação temporária, após confirmação do usuário.
- [x] Reconsultar o painel Instagram após até 24 horas; os dois contadores constam como Completed (16/10/2026).
- [x] Remover a publicação temporária de homologação após salvar as evidências.

