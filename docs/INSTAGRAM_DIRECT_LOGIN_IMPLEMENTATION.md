# Instagram Login direto — implementação e homologação

## Estado
Implementação técnica verificada; homologação real e App Review não concluídos.

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
1. Meta exige senha humana para revelar a chave secreta existente. Não solicitar senha pelo chat.
2. Configurar INSTAGRAM_APP_SECRET no perfil local ignorado; INSTAGRAM_APP_ID foi configurado com o ID observado no painel (3650700108428384).
3. Cadastrar o callback exato em Instagram Business Login e confirmar webhook no produto Instagram Login.
4. Conectar @agencianexosai pelo novo botão e consentir os scopes solicitados; inscrever webhooks e verificar retorno.
5. Executar e registrar testes reais: perfil, insights, comentário/resposta, Direct e publicação autorizada. A Meta informa atraso de até 24h para contagem e validade de 30 dias para testes.
6. instagram_manage_engagement e instagram_manage_contents são recursos distintos (likes e exclusão); não foram demonstrados por este OAuth novo e permanecem pendentes.
7. Preparar gravações, instruções/credenciais seguras de revisão e submeter a revisão somente após completar as evidências.

## Fonte oficial
https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
Consultada no navegador; atualização indicada em 13/03/2026. A implementação não utiliza uma chave secreta do Facebook como se fosse a chave do Instagram.
