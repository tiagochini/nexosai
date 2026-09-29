# Runbook de revisão do Meta App — NexOS

Este documento separa prova técnica interna de evidência aceita pela Meta. Testes locais protegem contra regressões, mas a submissão exige a aplicação publicada, contas reais de teste, callbacks reais e gravações da interface.

## 1. Critério de liberação

Antes de gravar, abra **Configurações → Integrações → Meta App Review Diagnostic**. A submissão só está pronta quando:

- o cabeçalho mostra `Pronto para Submissão`;
- a URL pública usa HTTPS;
- o Instagram profissional está conectado;
- a Página do Facebook está conectada quando houver permissões de Página;
- existe evidência de callback e envio com ID real da Meta;
- existe resposta contextual com `providerResponseId`;
- privacidade, termos e exclusão de dados abrem sem login.

O painel é deliberadamente token-free. Nunca abra variáveis de ambiente, DevTools, banco de dados ou o painel de segredos durante a gravação.

## 2. Configuração externa

No Meta App Dashboard:

1. Cadastre as URLs OAuth usadas pelas integrações solicitadas:
   - `https://SEU_DOMINIO/api/integrations/oauth/callback/instagram`
   - `https://SEU_DOMINIO/api/integrations/oauth/callback/facebook`
2. Configure o webhook principal como `https://SEU_DOMINIO/api/social-moderation/webhooks/meta`.
   A rota histórica `https://SEU_DOMINIO/api/social/webhooks/meta` permanece
   compatível e usa o mesmo processador. Não é necessário cadastrar ambas para
   o mesmo objeto; se ambas receberem a mesma entrega, a idempotência evita uma
   segunda resposta.
3. Use o mesmo verify token configurado no servidor.
4. Assine os campos necessários de Instagram/Page: `messages`, `messaging_postbacks`, `comments` e `feed`.
5. Cadastre:
   - Privacy Policy: `https://agencianexos.vip/privacy`
   - Terms of Service: `https://agencianexos.vip/terms`
   - Data Deletion: `https://agencianexos.vip/data-deletion`
6. Prepare uma Página de teste e uma conta Instagram profissional vinculada à Página.
7. Prepare duas identidades: a conta profissional conectada e uma conta externa que enviará comentários/DMs.
8. Crie uma conta de login exclusiva para o revisor. Informe usuário e senha somente no campo seguro da Meta. Não dependa de MFA, convite pendente ou intervenção do proprietário.

Para desenvolvimento local, não substitua essas URLs de produção por
`localhost`. Use um App Meta de desenvolvimento, um túnel HTTPS e o gateway
restrito descritos em [META_WEBHOOK_LOCAL_DEV.md](META_WEBHOOK_LOCAL_DEV.md).

## 3. Matriz de permissões

Solicite somente permissões realmente demonstradas. Cada linha mantida na submissão precisa de uma gravação que mostre a ação no NexOS e o resultado na Meta.

| Permissão | Caso de uso | Evidência obrigatória |
| --- | --- | --- |
| `instagram_basic` | Conectar e identificar a conta profissional | Consentimento OAuth e perfil conectado |
| `instagram_business_manage_messages` | Receber e responder DMs | DM externa, callback, resposta recebida e ID da mensagem |
| `instagram_manage_comments` | Ler, moderar e responder comentários | Comentário externo, resposta pública e IDs reais |
| `pages_show_list` | Selecionar Página autorizada | Lista/seleção da Página durante OAuth |
| `pages_read_engagement` | Ler posts, comentários e engajamento | Comentário/atividade real carregado no NexOS |
| `pages_manage_engagement` | Responder/moderar comentários da Página | Comentário externo e resposta na Página |
| `pages_manage_metadata` | Inscrever Página nos webhooks | Subscription configurada e callback real |
| `instagram_content_publish` | Publicar post/reel aprovado | Publicação completa e media ID |
| `instagram_manage_insights` | Exibir métricas reais | Métricas da conta/conteúdo com timestamp |
| `pages_manage_posts` | Publicar na Página | Publicação completa e Page post ID |
| `business_management` | Resolver ativos empresariais autorizados | Business, Página e Instagram selecionados |

As seis últimas linhas que não façam parte do fluxo submetido devem ser removidas, não deixadas sem demonstração.

## 4. Dados de demonstração

1. Crie uma campanha curta para o negócio de teste.
2. Aprove o Master Plan da campanha.
3. Publique ou selecione um post associado à campanha e confirme que existe `platformPostId`.
4. Em **Social → Moderação**, habilite respostas a perguntas e objeções.
5. Se private reply fizer parte da submissão, habilite explicitamente a política correspondente.
6. Para o teste determinístico, cadastre `MAPA → Aqui está o material prometido!`.

## 5. Gravações

Grave em 1080p, preferencialmente com a interface em inglês. Mostre a barra de endereço e faça a ação em tempo real. Um vídeo pode demonstrar permissões relacionadas, mas cada permissão precisa ser mencionada e visualmente provada.

### Vídeo A — conexão

1. Abra a URL pública.
2. Entre com a conta de revisão.
3. Abra **Settings → Integrations**.
4. Inicie **Connect Meta** e mostre o consentimento.
5. Selecione a Página e a conta Instagram vinculada.
6. Volte ao NexOS e mostre ambas como conectadas.
7. Abra o diagnóstico e mostre callback e URLs legais.

### Vídeo B — comentário Instagram

1. Mostre o post de teste no NexOS.
2. Na conta externa, comente: `Como isso se conecta ao meu CRM e ao restante da operação?`
3. Mostre a resposta contextual pública no Instagram.
4. Se solicitado, mostre o private reply.
5. Volte ao diagnóstico e mostre `instagram_comment`, `providerEventId`, `providerMessageId`, latência e status.

### Vídeo C — DM Instagram

1. Da conta externa, envie `MAPA`.
2. Mostre a resposta determinística chegando em menos de 30 segundos.
3. Envie a pergunta livre sobre CRM.
4. Mostre a resposta contextual.
5. Envie `Quero falar com uma pessoa`.
6. Mostre que o NexOS registra `human_handoff` e não envia resposta inventada.
7. Mostre o `providerResponseId` e a evidência token-free.

### Vídeo D — Facebook, se solicitado

1. Mostre a Página conectada.
2. Faça um comentário real por uma conta externa.
3. Mostre o callback `facebook_comment` e a resposta na Página.
4. Se mensagens da Página fizerem parte do pedido, envie mensagem e mostre `facebook_dm`.
5. Mostre IDs reais no diagnóstico.

### Vídeos de publicação e insights, se solicitados

- Para `instagram_content_publish`, publique um conteúdo aprovado e mostre o media ID e a publicação no perfil.
- Para `pages_manage_posts`, publique na Página e mostre o Page post ID.
- Para `instagram_manage_insights`, abra métricas reais da conta ou publicação e mostre o timestamp de sincronização.

## 6. Texto em inglês para o caso de uso

> NexOS allows a business owner to connect an Instagram professional account and its linked Facebook Page. The application receives comments and direct messages through Meta webhooks, identifies the authorized account and the related approved campaign plan, and sends a contextual response on behalf of the business. Sensitive, ambiguous, pricing, refund, health, legal, payment, or explicit human-support requests are not answered automatically and are routed for human review.

## 7. Instruções em inglês para o revisor

> 1. Open the provided production URL and sign in with the review credentials supplied in the secure credentials field.  
> 2. Open Settings, select Integrations, and confirm that the review Instagram professional account and linked Facebook Page are connected.  
> 3. Open Social Media and select the prepared review post.  
> 4. From the external Meta test account, add the comment shown in the attached recording.  
> 5. Confirm that the contextual public reply appears on Instagram.  
> 6. From the same external account, send the Instagram direct message shown in the recording.  
> 7. Confirm that the reply appears in the Instagram conversation.  
> 8. Return to Settings, Integrations, Meta App Review Diagnostic. Confirm that the event type, provider event ID, provider response ID, timestamps, latency, and send status match the interaction. This screen never displays access tokens.  
> 9. Send “I want to speak with a person” and confirm that NexOS records a human handoff instead of sending an automated reply.

Inclua abaixo dessas instruções o nome exato do workspace, post de teste e contas que aparecem na gravação.

## 8. Checklist final

- [ ] URL pública abre em janela anônima.
- [ ] Credenciais do revisor funcionam sem ajuda.
- [ ] Página e Instagram são ativos de teste, não de cliente.
- [ ] Webhook é verificado e subscriptions estão ativas.
- [ ] Cada permissão solicitada aparece na matriz e em uma gravação.
- [ ] Cada ação gera IDs reais da Meta.
- [ ] Comentário e DM contextual usam o Master Plan aprovado.
- [ ] Handoff humano não chama o provedor.
- [ ] Nenhuma gravação mostra token, secret, senha ou variável de ambiente.
- [ ] Os vídeos seguem exatamente as instruções escritas.
- [ ] Permissões não demonstradas foram removidas.

## 9. Limite da prova local

`test:meta-app-review`, `test:contextual-conversation` e o harness Meta validam assinatura, isolamento, deduplicação, redaction e retry. Eles não substituem OAuth real, subscriptions reais, chamadas reais à Graph API ou as gravações exigidas pela Meta.

O teste local das rotas deve usar `pnpm run dev:local:meta-test`, que mantém as
chamadas de saída da Graph API em memória. Antes da gravação do App Review,
reinicie no modo normal e confirme que a conta de teste está explicitamente
assinada em `subscribed_apps`.
