# Instagram Login direto — implementação e homologação

## Estado
Implementação técnica e homologação real de identidade, webhooks e insights verificadas. Publicação real e App Review continuam pendentes.

Em 14/10/2026, o painel Meta confirmou app publicado (botão Unpublish), chamadas existentes de Facebook Login e zero chamadas no login direto. O Founder escolheu implementar os dois métodos, mantendo as permissões extras.

## Implementação
- Novo provider OAuth `instagram_login`, armazenado como integração orgânica `instagram`.
- App ID/secret próprios. Callback: `https://agencianexos.vip/api/integrations/oauth/callback/instagram_login`.
- Troca de código com formulário, promoção para token longo, leitura de user_id/username antes de conectar.
- State assinado com expiração e vínculo ao provider; erros não exibem tokens.
- Chave criptografada no banco. Fingerprint permite selecionar somente a credencial direta; renovação antes de vencer (janela de sete dias), serializada no banco, com atualização da credencial e validade.
- Host `graph.instagram.com` para credencial direta. Facebook/Ads conservam `graph.facebook.com`; nenhum prefixo de token decide a origem.
- Transporte comum cobre publicação, moderação, Direct e consultas que o utilizam. Request POST conserva método/corpo/headers; mensagens usam ID da conta direta.
- Webhooks comments/messages/messaging_postbacks por inscrição explícita ou opção server-side já existente.
- Interface: Alterar login, Conectar diretamente pelo Instagram, Assinar webhooks (depois da conexão direta). Não marca Facebook como conectado por causa de login direto.
- Uma mesma conta alterna seu método de autenticação no registro existente; não duplica sua integração nem fabrica uma Página.

## Testes
PASS test-instagram-login.ts: short grant em data[], token de 60 dias, identidade, host/corpo, erros sanitizados.
PASS test-instagram-login-db.ts: banco Docker descartável, token cifrado no SQL, 8 chamadas concorrentes com uma renovação, token Facebook isolado, expiração impede envio, Request POST preservado, HTTP autenticado, state inválido e provider trocado rejeitados, callback bem-sucedido atualiza a mesma conta sem Página.
PASS quatro regressões de webhook/MAPA e 16 de execução/integrações. PASS tipos API/app e build API. Nenhuma inferência de aprovação Meta a partir destes testes simulados.

## Pendências externas
1. Concluído: reautenticação humana na Meta e INSTAGRAM_APP_SECRET salva somente no perfil local ignorado. INSTAGRAM_APP_ID: 3650700108428384.
2. Concluído: callback exato salvo e confirmado no diálogo Instagram Business Login, preservando o callback anterior. Evidência local: .local/instagram-login/callback-saved.png.
3. Configuração observada no produto Instagram Login: callback `https://agencianexos.vip/api/social/webhooks/meta`, campos comments/messages/messaging_postbacks inscritos em v26.0. A inscrição da conta e entrega real pelo novo OAuth ainda precisam ser verificadas. Callbacks de desautorização e solicitação de exclusão estavam vazios e continuam pendentes.
4. Concluído: OAuth real de @agencianexosai persistido com authType instagram_login, validade até 13/12/2026. Graph Instagram confirmou identidade com 200; inscrição comments/messages/messaging_postbacks confirmou success e leitura externa dos três campos. Evidência: INSTAGRAM_DIRECT_LOGIN_LIVE_RESULTS.json.
5. Concluído: comentário público, resposta privada ao comentário, recebimento e resposta automática a Direct real confirmados por leitura externa Graph 200, sem sincronização manual/reenvio. Evidência: INSTAGRAM_DIRECT_WEBHOOK_RESULTS.json.
6. Concluído: perfil (11 seguidores, 37 publicações), alcance dos últimos 30 dias (7) e insights de nove mídias retornaram HTTP 200. Evidência: INSTAGRAM_DIRECT_INSIGHTS_RESULTS.json. A integração deixou de solicitar `impressions`, métrica rejeitada pela Graph API nesta conta; a interface mostra indisponibilidade quando a API não fornece um valor, em vez de fabricar zero.
7. Pendente: publicação real de um post temporário de homologação. O arquivo público de teste já está preparado em `https://agencianexos.vip/homologacao-instagram-20261014.jpg`, mas nenhum post foi publicado. A legenda e a imagem precisam ser revisadas pelo Founder antes do envio.
8. Pendente: `instagram_manage_engagement` e `instagram_manage_contents` pertencem ao fluxo Facebook Login e exigem chamadas válidas próprias para like e exclusão de post/story/reel. A credencial direta atual não demonstra esses escopos; preservar o token direto ao conectar Facebook Login é requisito técnico antes de retestar.
9. Pendente: os contadores “Testing” da Meta ainda aparecem em zero para vários escopos apesar das respostas reais de Graph. O painel informa atraso de até 24 h e janela de validade de 30 dias. Reconsultar após esse prazo e registrar a página do painel.
10. Pendente: callbacks de desautorização e solicitação de exclusão de dados, gravações da revisão, instruções/credenciais seguras ao revisor e envio do App Review.

## Recuperação do ambiente — 14/10/2026
API encerrava na inicialização por conexão Redis fechada. Docker Desktop não iniciava devido a socket obsoleto em docker-secrets-engine. A pasta de IPC foi renomeada e preservada; nenhum volume foi removido. Docker 29.8.2 voltou, `node scripts/homologation.mjs redis` passou autenticação/isolamento, schema e segurança. Runtime reiniciado com o perfil local; `/api/readyz` respondeu 200 e status ready no localhost:8090 e no domínio público. A aba NexOS está no login; próximo passo exige sessão Founder e consentimento real do Instagram. Não houve nova conexão OAuth ou publicação nesta recuperação.

## Fonte oficial

## Webhooks reais — 14/10/2026
Comentário novo `mapa direto ativo 14`: evento recebido, resposta pública 18111219086177791 confirmada em leitura Graph e resposta privada aceita com ID Meta. Direct recebido pelo webhook, resposta rejeitada por não ser proprietário do tópico; retentativas falharam e chegaram a dead_letter. Não houve entrega de DM autônoma comprovada. Após autorização explícita do Founder, app NexOS AI Integration-IG 3650700108428384 salvo como roteamento padrão do Instagram da Página DasKapital.io e confirmado pela Meta. Aguardando mensagem nova para reteste. Evidência: INSTAGRAM_DIRECT_WEBHOOK_RESULTS.json; captura local routing-app-saved.png. Documentação oficial de roteamento consultada, atualização 28/09/2026: https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/conversation-routing

## Fonte oficial do login

## Reteste concluído — 14/10/2026
Nova DM após ajuste do roteamento recebida por webhook às 14:48:29 (America/Cuiaba), resposta automática aceita às 14:48:30. Consulta externa da mensagem no Graph Instagram retornou 200 com o texto fixo correto; resposta privada ao comentário também retornou 200 com texto personalizado. Comentário público, mensagem privada a partir do comentário e resposta a DM real passam pelo login direto. Sem sync manual ou reenvio. As falhas anteriores de thread ownership permanecem registradas na evidência. Não equivale à aprovação Meta App Review e não valida publicação/likes/exclusão.

## Insights reais — 14/10/2026
Graph API retornou perfil e insights de conta/mídias com HTTP 200. Alcance agregado dos 30 dias: 7; nove mídias lidas com sucesso, incluindo a publicação de teste com alcance 2 e 32 interações. `impressions` foi removida após erro Graph 400, e a tela do NexOS foi corrigida para usar métricas suportadas e sinalizar dados indisponíveis. Evidência: `INSTAGRAM_DIRECT_INSIGHTS_RESULTS.json`.
https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
Consultada no navegador; atualização indicada em 13/03/2026. A implementação não utiliza uma chave secreta do Facebook como se fosse a chave do Instagram.
