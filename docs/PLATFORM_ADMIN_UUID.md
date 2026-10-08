# Administração da plataforma por UUID

O Command Center usa `PLATFORM_ADMIN_USER_IDS`, configurado exclusivamente no
servidor. Não há e-mail padrão, privilégio derivado do domínio ou fallback para
proprietário de workspace. Configuração vazia ou contendo um UUID inválido nega
todo acesso administrativo.

Para habilitar um administrador:

1. Identificar e conferir a conta existente no banco do ambiente escolhido.
2. Adicionar seu UUID a `PLATFORM_ADMIN_USER_IDS` no arquivo privado desse ambiente.
   Para várias contas, separar os UUIDs por vírgula.
3. Reiniciar o processo da API para carregar a configuração.
4. Entrar com a conta e conferir `/api/auth/me`: `isPlatformAdmin: true`.
5. Conferir o Command Center e verificar que outro usuário recebe HTTP 403.

A API valida o UUID da sessão autenticada, nunca um identificador enviado no corpo,
query string ou cabeçalho de papel administrativo. Além da assinatura JWT, cada
ação administrativa confere no banco a sessão, sua validade, revogação e vínculo
com usuário e workspace ativo pertencente a ele. Logout bloqueia imediatamente
essa sessão administrativa; um token sem sessão também é rejeitado.

Todas as rotas de `/api/admin` têm o middleware central. Também são protegidas as
recargas gratuitas, ativação de créditos ilimitados, consultas de fingerprints,
geração interna NexOS e ativação administrativa Radar. Os benefícios de plano,
limites de campanhas e retries que antes dependiam de e-mail usam o UUID.
A criação interna de workspaces agora requer UUID autorizado, sem liberação
automática para qualquer endereço `@nexos.ai`; os workspaces continuam do próprio
usuário. Créditos ilimitados concedidos explicitamente em settings continuam
sendo uma configuração comercial, sem conferir administração.

A interface lê `isPlatformAdmin` do servidor. Esse campo controla a apresentação;
a proteção real está nas rotas da API. Administradores globais têm acesso
intencional às operações da plataforma. Usuários comuns e proprietários de
workspaces não recebem essa permissão. A Academy mantém a configuração separada
`ACADEMY_ADMIN_USER_IDS`.

O founder existente está configurado no perfil privado de homologação. O script
de provisionamento configura ambas as listas por UUID. Os demais ambientes
precisam de configuração explícita; não se deve copiar o UUID de homologação para
um banco em que a conta tem outro identificador. Para remover privilégios, retirar
o UUID do perfil e reiniciar a API; não é necessário aguardar a expiração JWT.

Validação: `test:platform-admin-db`, incluído no CI de banco e no runner P3, usa
fixtures descartáveis em banco de testes. Foram verificadas 24 rotas do Command
Center e 7 relacionadas, troca de e-mail, vínculo de sessão, expiração, logout,
workspace suspenso e remoção de autorização. Pelo domínio público, founder entrou,
consultou o Command Center com HTTP 200 e teve a sessão temporária negada com
HTTP 401 após logout. [Resultados](PLATFORM_ADMIN_UUID_VALIDATION.json).

A revogação imediata aqui cobre acesso administrativo global. O comportamento de
expiração dos tokens das rotas comuns não foi alterado. Não houve ativação em
produção nem validação completa das integrações externas nesta etapa.
