# Sessões de autenticação

[English](./AUTH_SESSION_SECURITY.en.md)

Login, cadastro, checkout, criação e troca de workspace usam a mesma emissão de
sessão. A resposta JSON contém o access token e sua duração real; o refresh token
é enviado somente no cookie `nexos_refresh`, com `HttpOnly`, `SameSite=Strict`,
`Path=/api/auth` e `Secure` em produção. Respostas que emitem sessão usam
`Cache-Control: no-store`. O frontend remove refresh tokens legados do
`localStorage` e não grava novos valores.

## Persistência e renovação

A tabela `auth_refresh_sessions` armazena somente SHA-256 do refresh token,
usuário, workspace, expiração e datas de revogação. O segredo é aleatório com
32 bytes. A sessão dura no máximo 30 dias desde a emissão; a renovação não estende
essa data. Cada refresh troca o segredo com uma atualização condicional no banco.
Concorrência e reutilização do token anterior são rejeitadas com HTTP 401.

`POST /api/auth/refresh` usa o cookie, sem token no corpo. `POST /api/auth/logout`
revoga a sessão atual e remove o cookie. A troca de workspace emite uma sessão
nova e revoga a anterior. A renovação confirma que o usuário ainda possui o
workspace ativo. Exclusão de usuário ou workspace remove as sessões por cascade.

Pedidos que alteram a sessão verificam `Origin` e `Sec-Fetch-Site`; origens não
autorizadas, navegação cross-site e formulários sem origem confiável são
rejeitados. Clientes sem cabeçalhos de navegador devem usar JSON. Configure
`APP_URL` e `ALLOWED_ORIGINS` corretamente. O aplicativo utiliza a API no mesmo
site, por `/api`, inclusive no proxy local.

O frontend agrupa renovações simultâneas e usa Web Locks, quando disponível,
para coordenar abas. Login e cadastro aguardam um logout pendente. Quando Web
Locks não está disponível, a proteção no banco continua funcionando, mas abas
que renovarem exatamente juntas podem receber um 401 e exigir novo login.

## Instalação e rollback

1. Faça backup e aplique `pnpm --filter @workspace/db run migrate:tracked` com
   `DATABASE_URL` configurada. A migration é `0063_auth_refresh_sessions.sql`.
2. Atualize backend e frontend juntos. Tokens JWT de refresh e clientes que
   enviam refresh token no corpo deixam de ser aceitos. Usuários legados precisam
   fazer login novamente quando o access token expirar.
3. Use HTTPS em produção para que o cookie `Secure` funcione. Nenhuma chave
   adicional é exigida para os tokens opacos de refresh.
4. Verifique login, renovação, troca de workspace e logout. O CI executa esses
   testes com contas descartáveis e também testa cadastro concorrente e
   criptografia de tokens no PostgreSQL.

Para rollback, volte backend e frontend juntos; a tabela nova pode permanecer
sem uso. O código antigo não entende os tokens opacos, então um novo login será
necessário. Não altere o checksum do snapshot SQL antigo: o bootstrap aplica as
migrations posteriores à versão 0062 dentro da transação.

## Limites

O access token ainda usa o armazenamento e o prazo configurados anteriormente;
esta alteração protege e revoga o refresh token. Access tokens já emitidos
continuam válidos até expirar. Quando o dispositivo está offline, o logout local
remove o access token, mas a revogação remota depende de o pedido chegar à API.
Controles de XSS e avaliações de segurança dos demais módulos continuam
necessários. Sessões expiradas/revogadas permanecem no banco até manutenção.
