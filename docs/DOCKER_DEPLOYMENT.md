# NexOS em Docker — PostgreSQL local ou externo

Preparação anterior ao P3, em 06/10/2026. O Compose padrão sobe API, frontend e
Redis e usa PostgreSQL externo. `compose.local.yml` acrescenta o PostgreSQL local.
Ambos usam as mesmas imagens, schema, migrações e aplicação. Evidência:
[DOCKER_DEPLOYMENT_RESULTS.json](./DOCKER_DEPLOYMENT_RESULTS.json).

## Configuração fora do Git

Usar Docker Engine com Compose v2 atualizado (o arquivo utiliza `!reset`). Na
raiz do projeto, definir caminhos absolutos para arquivos fora do repositório:

```powershell
$env:APP_ENV_FILE = 'C:/nexos-secrets/app.env'
$env:REDIS_PASSWORD_FILE = 'C:/nexos-secrets/redis-password'
$env:WEB_PORT = '8081'
$env:NEXOS_DATABASE_NETWORK = 'nexos-production-database'
```

`app.env` é lido como secret somente na inicialização; não vira argumento de
build ou variável do Compose. Conter os valores reais destes campos:

```dotenv
SESSION_SECRET=<segredo-aleatorio-com-pelo-menos-32-caracteres>
INTEGRATION_TOKEN_ENCRYPTION_KEY=<chave-base64-de-32-bytes>
META_APP_SECRET=<segredo-do-aplicativo-meta>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<token-privado-do-webhook>
APP_URL=https://app.seudominio.com
ALLOWED_ORIGINS=https://app.seudominio.com
QUEUE_PREFIX=production
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=5000
DB_IDLE_TIMEOUT_MS=30000
```

As credenciais dos provedores e configurações de armazenamento podem ser
adicionadas a esse arquivo conforme os módulos usados. Não incluir `NODE_ENV`,
`PORT`, `DATABASE_MODE` ou `APP_ENV_FILE`: são controlados pelo Compose. A imagem
executa o guard de produção existente e não fornece credenciais padrão.

O segredo Redis deve ser alfanumérico, aleatório e ter pelo menos 32 caracteres.
No host Linux, os arquivos lidos pela API precisam ser legíveis pelo UID 1000:
atribuir esse proprietário e permissões 0600; proteger também o diretório.
Nunca colocar credenciais dentro de `ops/app` ou do contexto de build.
O `.dockerignore` inclui apenas caminhos de código necessários e exclui Git,
`.env`, recuperação local, dumps e dependências do host.

## PostgreSQL externo — padrão de produção

Acrescentar ao `app.env`, com senha codificada para URL:

```dotenv
DATABASE_URL=postgresql://usuario:senha-codificada@host-do-provedor:5432/nexos
DATABASE_SSL_MODE=verify-full
```

Não acrescentar parâmetros SSL à URL quando usar `DATABASE_SSL_MODE`. A conexão
externa Docker exige TLS com validação de cadeia e nome do servidor. Não usa
`rejectUnauthorized=false`. A CA pública do sistema funciona para certificados
confiáveis. Se o provedor fornecer CA própria, definir:

```powershell
$env:DATABASE_CA_FILE = 'C:/nexos-secrets/provider-ca.pem'
```

Nesse caso, acrescentar `DATABASE_SSL_CA_FILE=/run/secrets/database_ca` ao
`app.env` e incluir `-f ops/app/compose.ca.yml` em todos os comandos abaixo.
Liberar a rede/IP de saída da aplicação no provedor e configurar o total de
conexões conforme seu limite. `DB_POOL_MAX` vale por processo; considerar também
ferramentas de schema e outros clientes ao calcular o orçamento de conexões.

```powershell
docker compose -p nexos -f ops/app/compose.yml build api web
docker compose -p nexos -f ops/app/compose.yml up -d --wait redis
docker compose -p nexos -f ops/app/compose.yml run --rm --no-deps db-tools
docker compose -p nexos -f ops/app/compose.yml up -d --wait api web
```

O comando `db-tools` verifica schema e planos; não inicializa nem migra
automaticamente um banco existente. O stack externo não cria PostgreSQL nem
volume de dados PostgreSQL. O endereço externo é configurado em `app.env`.

## PostgreSQL local — desenvolvimento e homologação

Definir um arquivo com senha aleatória para o banco:

```powershell
$env:POSTGRES_PASSWORD_FILE = 'C:/nexos-secrets/postgres-password'
docker compose -p nexos-local -f ops/app/compose.yml -f ops/app/compose.local.yml build api web
docker compose -p nexos-local -f ops/app/compose.yml -f ops/app/compose.local.yml up -d --wait postgres redis
```

O entrypoint monta a conexão com o serviço `postgres`, banco/usuário `nexos` e
esse segredo. A conexão local usa a rede Docker sem TLS; nenhuma porta de
PostgreSQL ou Redis é publicada no host. O volume PostgreSQL persiste entre
recriações. Usar outro nome de rede ao executar stacks simultâneos.

Em **banco novo e vazio**, executar explicitamente:

```powershell
docker compose -p nexos-local -f ops/app/compose.yml -f ops/app/compose.local.yml run --rm --no-deps db-tools /workspace/lib/db/scripts/bootstrap-empty-database.mjs --execute
docker compose -p nexos-local -f ops/app/compose.yml -f ops/app/compose.local.yml run --rm --no-deps db-tools /workspace/lib/db/node_modules/tsx/dist/cli.mjs /workspace/lib/db/src/seed-plans.ts
docker compose -p nexos-local -f ops/app/compose.yml -f ops/app/compose.local.yml run --rm --no-deps db-tools
docker compose -p nexos-local -f ops/app/compose.yml -f ops/app/compose.local.yml up -d --wait api web
```

O mesmo procedimento inicializa um banco externo vazio usando somente o arquivo
base (e a CA opcional). Para atualizar um banco existente, fazer backup, revisar
as migrações e executar o comando rastreado:

```powershell
docker compose -p nexos -f ops/app/compose.yml run --rm --no-deps db-tools /workspace/lib/db/scripts/apply-migrations.mjs
docker compose -p nexos -f ops/app/compose.yml run --rm --no-deps db-tools
```

## Operação e limites

O frontend Nginx publica HTTP em loopback na porta `WEB_PORT`; API, PostgreSQL e
Redis ficam na rede privada. Publicar o domínio por proxy/ingress HTTPS do host
ou plataforma, encaminhando também `/api/socket.io` com upgrade WebSocket e
timeout de até 12 minutos. `APP_URL` e origens devem corresponder ao domínio.
Quando houver proxy adicional, configurar no Nginx a origem confiável de
`X-Forwarded-For` com `set_real_ip_from` e `real_ip_header`, usando somente o
endereço do seu proxy; verificar o IP efetivo das cotas na homologação.
O frontend usa a API na mesma origem. O ensaio HTTP local não certifica cookies
Secure ou o TLS público: essa validação pertence à homologação do domínio.

A API executa como UID 1000 e recebe SIGTERM para shutdown existente. O stack
configura limites de memória, reinício após saída de processo e healthchecks.
Um healthcheck falho sinaliza indisponibilidade; Compose não reinicia sozinho
um processo ainda vivo apenas por estar unhealthy. Usar monitoramento e alertas.

API, workers e schedulers permanecem no mesmo processo da aplicação, conforme
o runtime atual. Isso preserva eventos realtime, recuperação e execução existentes.
Operar uma instância desse serviço; separar consumidores ou escalar instâncias
exige validar coordenação dos schedulers e distribuição dos eventos realtime.
O serviço nativo de mídia externo/GCS exige configuração e homologação próprias;
FFmpeg/Python básicos estão presentes, mas este ensaio não certifica vídeo.

Gravações locais usam volume persistente. Arquivos temporários de edição ficam
no filesystem temporário e podem se perder ao recriar a API. Backups de banco,
Redis, mídia e chaves seguem o [runbook P2](./P2_CLOSEOUT.md). Trocar a URL não
copia dados: migrar por dump/restauração ou procedimento do provedor e verificar
o destino antes de liberar escritores. Nunca subir uma cópia restaurada com
credenciais reais sem controlar os consumidores e os envios pendentes.

Para releases, definir `NEXOS_API_IMAGE` e `NEXOS_WEB_IMAGE` com tags/digests
versionados e publicar em seu registry. As tags `:local` servem para os ensaios.
Rollback troca imagens e preserva volumes; `down` preserva dados, enquanto
`down --volumes` é usado somente para fixtures descartáveis. Não reverter schema
ou trocar de banco automaticamente durante rollback.

## Validação reproduzível

```text
pnpm run test:docker-local
node --test lib/db/scripts/connection-options.test.mjs
pnpm run typecheck
```

O runner constrói imagens Linux, usa dois modos com PostgreSQL 17 descartável,
valida frontend/API reais, bootstrap/seed/verificação, volume de gravações e
API sem root. O banco externo simulado roda em stack separado com certificado
próprio: valida TLS, rejeita hostname incorreto e testa parada/retomada mantendo
a API viva. As redes da API e banco bloqueiam saída externa; o frontend possui
uma rede de ingresso para o HTTP de loopback. Não há fixtures comerciais
ou credenciais de produção. Containers, volumes e segredos criados pelo runner
são limpos ao final. O workflow de infraestrutura inclui essa validação.
Servidor/provedor real, HTTPS do domínio e CI remoto permanecem sem ativação.

Referências: [Compose em produção](https://docs.docker.com/compose/how-tos/production/)
e [TLS no node-postgres](https://node-postgres.com/features/ssl).
