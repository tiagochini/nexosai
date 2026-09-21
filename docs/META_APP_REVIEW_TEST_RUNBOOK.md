# Runbook de revisão do Meta App — NexOS

## Antes da gravação
No painel Meta, configure o produto **Instagram Graph API** e Webhooks. Use a URL de callback de produção `https://<SEU_DOMINIO_DE_PRODUCAO>/api/social-moderation/webhooks/meta` (ou a URL legada `https://<SEU_DOMINIO_DE_PRODUCAO>/api/social/webhooks/meta`) e o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN` configurado no ambiente. Não coloque tokens na gravação.

Solicite/aprove: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_business_manage_messages`, `instagram_manage_comments`, `pages_show_list`, `pages_read_engagement`, `pages_manage_engagement`, `pages_manage_posts`, `pages_manage_metadata` e `business_management`. Assine os campos de webhook Instagram/Page necessários para `messages`, `messaging_postbacks`, `comments` e `feed`.

O revisor precisa de uma conta de teste Meta, um Business Manager, uma Página Facebook e uma conta Instagram profissional vinculada à Página. Conecte essa conta em NexOS pela tela de integrações e confirme que está **connected**.

## Demonstração
1. Na configuração de moderação, ative a política de resposta privada se ela será demonstrada e cadastre `immediateKeywordReplies`, por exemplo `MAPA → Aqui está o material prometido!`.
2. Envie uma DM `MAPA` da conta de teste para o Instagram conectado. Mostre a resposta determinística chegando em menos de 30 segundos.
3. Comente `MAPA` em um post da conta. Mostre a resposta pública.
4. Com a política privada ativa, mostre também a DM privada criada pela operação Private Replies.
5. No NexOS, abra a evidência de revisão autenticado: `GET /api/social-moderation/review-evidence`. Mostre `providerEventId`, conta/workspace, endpoint, status, `receivedAt`, `sendStartedAt`, `sentAt`, `latencyMs`, `slaStatus`, resposta do provedor e eventual retry. Confirme visualmente que não há token.

### Conversas contextuais (comentário e DM)

1. Materialize e aprove um Master Plan para a campanha e publique um post
   alinhado a ela. Confirme que o post salvo contém o `platformPostId`.
2. A partir da conta de teste, faça um comentário com uma pergunta específica
   do negócio (por exemplo: “como isso se conecta ao meu CRM e ao restante da
   operação?”). O NexOS resolve post → campanha → versão aprovada e responde
   em até três frases usando o contexto canônico; a evidência mostra a
   impressão digital do contexto e a versão do Master Plan.
3. Envie uma DM livre com a mesma pergunta. Após os fluxos de palavra-chave
   terminarem, somente mensagens sem sequência ativa entram no orquestrador.
   A resposta é enviada pela Messaging API e o ID retornado aparece em
   `conversationTurns.providerResponseId`.
4. Demonstre uma pergunta sobre preço, reembolso, saúde/legal ou “quero falar
   com uma pessoa”. A decisão deve ser `human_handoff`, sem chamada ao
   provedor. Sem Master Plan aprovado, contexto ambíguo ou confiança baixa o
   comportamento também é handoff (nunca resposta genérica).

O endpoint de evidência retorna eventos Meta e turnos contextuais sem tokens:
`GET /api/social-moderation/review-evidence`. Os turnos incluem canal,
direção, campanha, versão/fingerprint do Master Plan, decisão, confiança,
handoff, resposta do provedor, status, erro sanitizado e timestamps.

## Checklist da gravação
- URL de callback e assinatura de webhook configuradas;
- login da conta de teste e conexão da Página/IG;
- DM e resposta em menos de 30 segundos;
- comentário e resposta pública;
- comentário e private reply, quando habilitado;
- evidência correlacionada e sem credenciais;
- uma falha controlada/retry, se o ambiente de teste permitir.

## Itens que exigem acesso do usuário
Não é possível concluir sem o acesso Meta do usuário: criar/associar Business, Página e IG profissional; configurar callback/subscrições; solicitar ou aprovar permissões; fornecer conta de teste ao revisor; e fazer a gravação real. O teste local não usa chamadas Meta reais.