# Passo a passo: NexOS AI na AWS

Roteiro preparado em 30/10/2026 a partir do código deste repositório. Os comandos
desta página são instruções para execução posterior; não provisionam recursos
por terem sido documentados. Nenhuma implantação AWS foi executada nesta revisão.

Os arquivos executáveis estão em [ops/aws](../ops/aws/README.md), configurados
para `https://agencianexos.vip`. O bucket privado e a role da EC2 já existem;
o [plano S3](../ops/aws/S3_MEDIA.md) identifica a integração de código ainda
necessária para as imagens e vídeos das campanhas.

## 1. Escolher a arquitetura inicial

Para a primeira implantação, usar **uma EC2 Ubuntu 24.04 LTS x86_64**, Docker
Compose, **RDS PostgreSQL privado** e um domínio HTTPS. A API atual executa
workers e agendadores no mesmo processo: manter **uma réplica da API** até
homologar coordenação dos agendadores e distribuição dos eventos realtime.

```text
Internet -> domínio -> Elastic IP da EC2 -> Caddy :443
                                           |-- /api/* e /socket.io/* -> API :8080 (loopback)
                                           |-- demais caminhos -> web :8081 (loopback)
API -> Redis privado no Docker, com volume persistente
API -> RDS PostgreSQL privado, com TLS e validação do certificado
API -> volume Docker de uploads no EBS da EC2
```

O contêiner web existente entrega a aplicação principal e a Academy. Landing,
editores separados e o worker nativo de mídia não são publicados automaticamente
por esse Dockerfile; se forem necessários, planejar sua implantação e homologação
separadamente. FFmpeg e Python já estão na imagem da API.

Como ponto de partida para homologação, considerar EC2 com 2 vCPU, 8 GiB de RAM
e 60–100 GiB de EBS gp3 criptografado. A instância existente é `t3.micro` com
1 GiB e está abaixo desse ponto de partida, trazendo risco de falta de memória
durante builds e processamento de vídeo.
O Compose limita a API a 2 GiB: aumentar esse limite exige medir o consumo.
Usar a região selecionada `us-east-2` (Ohio) para os recursos regionais. EC2,
RDS, EBS, IPv4 público, backups, tráfego e
provedores de IA têm custos separados; simular o conjunto no
[AWS Pricing Calculator](https://calculator.aws/) antes de criar recursos.

## 2. Preparar a versão local antes de enviar

1. Revisar as alterações locais e escolher uma versão completa para implantar.
   No momento desta revisão havia alterações e migrations ainda não commitadas;
   um `git clone` não levará esses arquivos para o servidor.
2. Manter `.env`, `.env.local`, dumps e credenciais fora do Git e das imagens.
   Rotacionar credenciais que já tenham sido expostas no histórico, conforme
   orientação do README do projeto.
3. O `.dockerignore` já inclui os arquivos da Academy exigidos pelo
   `Dockerfile.web`. Preservar as exclusões finais de `node_modules`, `dist`,
   `.env*`, dumps e chaves. Não liberar diretórios de recuperação no build.
4. Com Node 24, pnpm 11.19.0 e Docker disponíveis, executar na raiz:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm run security:scan
   pnpm run typecheck
   pnpm run test:aws-preparation
   pnpm run test:docker-local
   ```

   Corrigir falhas antes de promover. O teste Docker usa bancos descartáveis;
   não apontar suas fixtures para o banco real. Confirmar que o bootstrap de
   banco vazio e as migrations representam o schema da versão escolhida,
   especialmente se forem incluídas novas migrations comerciais.
5. Publicar essa versão em repositório privado e registrar o commit/tag.

O pacote de preparação inclui o override AWS, configuração do proxy e scripts
de runtime. Para os comandos prontos, seguir [ops/aws/README.md](../ops/aws/README.md).
Os exemplos abaixo também explicam as operações equivalentes via Compose.

## 3. Rede e regras de acesso existentes

Os recursos estão na VPC padrão de `us-east-2`. A EC2 fica em subnet pública;
o RDS está privado. O grupo `launch-wizard-1` permite HTTP/HTTPS públicos e a
regra SSH foi removida depois que o SSM ficou online. O grupo `ec2-rds-1`
permite TCP 5432 somente a partir do grupo da EC2. Não abrir 8080, 8081, 5432
ou 6379 para a Internet. Não crie uma segunda VPC ou Security Group para esta
implantação sem atualizar as referências de ambos os serviços.

Não existe Elastic IP associado. O endereço IPv4 atual da EC2 pode mudar após
parada ou substituição; DNS ainda precisa apontar para o endereço estável que
será definido antes da publicação. Alertas de orçamento e tags ainda precisam
ser configurados.

Referências: [regras de Security Groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html)
e [RDS privado em uma VPC](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html).

## 4. Preparar o PostgreSQL existente no RDS

1. O RDS existente está na mesma VPC, é privado e executa PostgreSQL 18.3.
   Confirmar compatibilidade com a versão e as extensões do banco de origem antes
   da restauração; o ensaio Docker documentado do projeto usa PostgreSQL 17.
2. O banco está criptografado e sem acesso público. Retenção de backup é de 1 dia
   e proteção contra exclusão está desativada.
3. O `DBName` inicial não foi configurado. Criar o banco `nexos` durante a
   preparação da restauração. A classe atual é `db.t4g.micro`; `DB_POOL_MAX=10`
   vale por processo, não por implantação inteira.
4. Registrar endpoint, porta, banco e usuário. Não há segredo gerenciado pelo RDS.
   Para operação contínua, provisionar
   um usuário de aplicação com os privilégios necessários e limitar o uso da
   credencial administrativa à preparação/manutenção do schema.
5. Manter o endpoint DNS do RDS na conexão, para validar o nome do certificado.
   Não substituir pelo IP nem desativar a validação TLS.

O projeto exige `DATABASE_SSL_MODE=verify-full` para PostgreSQL externo.
Usaremos o bundle de CAs fornecido pela AWS, conforme a
[documentação de TLS do RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html).

## 5. Preparar a EC2 existente

1. A EC2 usa Ubuntu 24.04 LTS x86_64, exige IMDSv2 e tem role de produção anexada.
   O SSM está online, a regra SSH pública foi removida, Docker/Compose estão
   instalados e Caddy está instalado, mas parado até configurar o domínio.
2. Ainda não existe Elastic IP. Associar um antes de publicar o registro `A` de
   `agencianexos.vip` no provedor DNS atual. Remover registros AAAA incorretos.
3. Administrar a instância pelo Systems Manager Session Manager; não usar SSH
   público.

   ```powershell
   ssh -i "C:\caminho\nexos.pem" ubuntu@SEU_ELASTIC_IP
   ```

**A partir daqui, os comandos são Bash no Ubuntu da EC2**, salvo indicação.

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git curl ca-certificates openssl
```

Instalar Docker Engine e o plugin Compose pelo
[repositório oficial para Ubuntu](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository).
Após configurar o repositório conforme essa página:

```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
```

Usar Compose atualizado: os arquivos do projeto usam a tag YAML `!reset`.
Não é necessário instalar Node ou pnpm no host para os comandos Docker abaixo.

Instalar Caddy como serviço usando os comandos do
[repositório oficial para Ubuntu](https://caddyserver.com/docs/install#debian-ubuntu-raspbian).
Ele fará a terminação HTTPS. Neste desenho inicial não há ALB ou CloudFront.

## 6. Copiar o código e configurar os segredos

Clonar com uma credencial de leitura do repositório, sem embutir token na URL:

```bash
sudo install -d -o ubuntu -g ubuntu /opt/nexos
git clone URL_DO_REPOSITORIO_PRIVADO /opt/nexos
cd /opt/nexos
git checkout TAG_OU_COMMIT_VALIDADO
```

Criar os arquivos fora do contexto de build. UID 1000 é o usuário `node` da API:

```bash
sudo install -d -m 0711 /etc/nexos
sudo install -m 0600 -o 1000 -g 1000 /dev/null /etc/nexos/app.env
sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/nexos/redis-password'
sudo chown 1000:1000 /etc/nexos/redis-password
sudo chmod 0600 /etc/nexos/redis-password
sudo curl --fail --show-error --location https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /etc/nexos/rds-ca.pem
sudo chmod 0644 /etc/nexos/rds-ca.pem
sudo nano /etc/nexos/app.env
```

Preencher `app.env` com valores reais; os exemplos abaixo são placeholders:

```dotenv
DATABASE_URL=postgresql://USUARIO:SENHA_URL_ENCODED@ENDPOINT_RDS:5432/nexos
DATABASE_SSL_MODE=verify-full
DATABASE_SSL_CA_FILE=/run/secrets/database_ca
SESSION_SECRET=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
JWT_SECRET=OUTRO_SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
INTEGRATION_TOKEN_ENCRYPTION_KEY=CHAVE_DE_32_BYTES_EM_BASE64
APP_URL=https://agencianexos.vip
ALLOWED_ORIGINS=https://agencianexos.vip
NEXOS_BASE_DOMAIN=agencianexos.vip
QUEUE_PREFIX=production
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=5000
DB_IDLE_TIMEOUT_MS=30000
META_APP_ID=ID_DO_APP_META
META_APP_SECRET=SEGREDO_REAL_DO_APP_META
WHATSAPP_WEBHOOK_VERIFY_TOKEN=TOKEN_PRIVADO_DE_VERIFICACAO
META_WEBHOOK_AUTO_SUBSCRIBE=false
META_WEBHOOK_PUBLIC_BASE_URL=https://agencianexos.vip
DRY_RUN_MODE=true
DISABLE_SCHEDULED_VIDEO_GENERATION=true
```

Para uma instalação nova, gerar segredos independentes com `openssl rand -hex 32`
e a chave de criptografia com `openssl rand -base64 32`. Guardar os valores em
local seguro. **Se restaurar dados com tokens criptografados, preservar a chave
de criptografia original e eventuais chaves anteriores**; uma chave nova não
descriptografa os tokens antigos.

Codificar caracteres especiais da senha na URL PostgreSQL. Não acrescentar
parâmetros SSL à URL: o projeto configura TLS pelas variáveis acima.
Não colocar `NODE_ENV`, `PORT`, `DATABASE_MODE` ou `APP_ENV_FILE` em `app.env`:
o entrypoint rejeita esses campos. Não é necessário preencher `REDIS_URL`:
o entrypoint monta a conexão com o segredo Redis.

Adicionar credenciais reais apenas dos módulos que serão ativados: IA,
SMTP/Resend, Asaas, Meta e outros provedores. O guard atual exige
`META_APP_SECRET` e `WHATSAPP_WEBHOOK_VERIFY_TOKEN` no ambiente de produção.
Configurar `PLATFORM_ADMIN_USER_IDS` e `ACADEMY_ADMIN_USER_IDS` com UUIDs dos
usuários autorizados, conforme [administração da plataforma](PLATFORM_ADMIN_UUID.md).

**Atenção ao primeiro boot:** `LOCAL_SAFE_MODE=true` é ignorado em produção.
`DRY_RUN_MODE=true` e o bloqueio de vídeo cobrem fluxos específicos, não todas
as chamadas externas. Um banco restaurado pode conter agendamentos, outboxes e
tokens reais; revisar e suspender essas operações antes de ligar a API. Para
homologação, preferir banco isolado e credenciais sandbox.

## 7. Configurar o Compose para esta arquitetura

Usar o arquivo `/opt/nexos/ops/app/compose.aws.yml` já incluído no repositório.
A API será publicada somente no loopback do host, para o Caddy acessá-la
diretamente. O trecho abaixo ilustra a configuração; preservar também a
remoção de portas de `db-tools` presente no arquivo completo:

```yaml
services:
  api:
    ports:
      - "127.0.0.1:8080:8080"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
  web:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
  redis:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

Na sessão Bash, definir uma função para reutilizar sempre os mesmos arquivos:

```bash
export APP_ENV_FILE=/etc/nexos/app.env
export REDIS_PASSWORD_FILE=/etc/nexos/redis-password
export DATABASE_CA_FILE=/etc/nexos/rds-ca.pem
export WEB_PORT=8081
export NEXOS_DATABASE_NETWORK=nexos-production-database
export NEXOS_API_IMAGE=nexos-api:release-001
export NEXOS_WEB_IMAGE=nexos-web:release-001

dc() {
  sudo --preserve-env=APP_ENV_FILE,REDIS_PASSWORD_FILE,DATABASE_CA_FILE,WEB_PORT,NEXOS_DATABASE_NETWORK,NEXOS_API_IMAGE,NEXOS_WEB_IMAGE \
    docker compose -p nexos \
    -f /opt/nexos/ops/app/compose.yml \
    -f /opt/nexos/ops/app/compose.ca.yml \
    -f /opt/nexos/ops/app/compose.aws.yml "$@"
}

dc config --quiet
dc build api web
dc up -d --wait redis
```

Salvar esse bloco de exports/função em arquivo de operação sem segredos e
carregá-lo com `source` ao abrir outra sessão. Usar uma tag diferente por release;
preservar as imagens anteriores para rollback. O Compose lê os segredos de
arquivos locais; ele não consulta Secrets Manager automaticamente. Uma integração
com Secrets Manager precisa ser configurada separadamente via IAM do host.

## 8. Preparar o banco: escolher apenas um caminho

### A. Instalação nova, com banco vazio

```bash
dc run --rm --no-deps db-tools /workspace/lib/db/scripts/bootstrap-empty-database.mjs
dc run --rm --no-deps db-tools /workspace/lib/db/scripts/bootstrap-empty-database.mjs --execute
dc run --rm --no-deps db-tools /workspace/lib/db/node_modules/tsx/dist/cli.mjs /workspace/lib/db/src/seed-plans.ts
dc run --rm --no-deps db-tools
```

O primeiro comando só confirma que o schema público está vazio. Parar se
qualquer comando falhar; não usar `push-force` para contornar diferenças.

### B. Levar os dados atuais para o RDS

1. Ensaiar dump/restauração em um RDS de homologação com a mesma versão alvo.
2. Revisar compatibilidade de extensões, roles, owners e permissões. Dumps do
   PostgreSQL local podem mencionar usuários que não existem no RDS.
3. Na mudança definitiva, interromper escritores e consumidores na origem.
   Gerar backup final com `pg_dump` compatível e transferi-lo criptografado para
   a EC2. Conectar ao RDS pela rede privada com TLS. Para dump custom, restaurar
   com `pg_restore --no-owner --no-privileges --exit-on-error`; para SQL texto,
   revisar o arquivo e usar `psql` com `ON_ERROR_STOP=1`. Não tratar o
   `backup.local.sql` existente como backup atual sem conferir sua data/conteúdo.
4. Copiar também uploads persistentes e preservar a chave de criptografia dos
   tokens. Alterar a URL do banco não transfere os arquivos de mídia.
5. Comparar tabelas, quantidades de registros, contas, saldos e dados críticos.
   Revisar jobs pendentes antes de ligar consumidores; não importar filas de
   homologação para produção. Se a origem tiver jobs válidos no Redis, planejar
   explicitamente sua drenagem/migração e conferir idempotência no destino.
6. Com backup e schema conferidos, aplicar somente as migrations rastreadas:

   ```bash
   dc run --rm --no-deps db-tools /workspace/lib/db/scripts/apply-migrations.mjs
   dc run --rm --no-deps db-tools
   ```

   Se o banco legado não tiver histórico de migrations, seguir o procedimento
   de baseline do [README](../README.md) somente após comparar o schema. A flag
   `MIGRATION_BASELINE_EXISTING_SCHEMA=true` é excepcional e temporária; não
   adicioná-la permanentemente. Não executar bootstrap sobre banco restaurado.

Nos dois caminhos, não usar `drizzle-kit push` como implantação automática.

## 9. Subir aplicação e publicar HTTPS

Somente após revisar as operações que podem ser retomadas no boot:

```bash
dc up -d --wait api web
dc ps
curl --fail http://127.0.0.1:8080/api/livez
curl --fail http://127.0.0.1:8080/api/readyz
curl --fail http://127.0.0.1:8081/
```

Editar `/etc/caddy/Caddyfile`:

```caddyfile
agencianexos.vip {
    @backend path /api /api/* /socket.io /socket.io/*
    handle @backend {
        reverse_proxy 127.0.0.1:8080
    }
    handle {
        reverse_proxy 127.0.0.1:8081
    }
}
```

O Caddy mantém o prefixo `/api` e encaminha a API diretamente. Isso mantém uma
camada de proxy para a API, compatível com `trust proxy = 1` no Express, e evita
que o Nginx interno substitua o protocolo HTTPS por HTTP. Não encaminhar tudo
para o Nginx sem revisar os headers e os proxies confiáveis.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl --fail https://agencianexos.vip/api/readyz
curl --fail https://agencianexos.vip/
```

O domínio precisa resolver para a EC2 e as portas 80/443 precisam estar
alcançáveis para a emissão automática do certificado. Caddy suporta
[HTTPS automático](https://caddyserver.com/docs/automatic-https) e
[upgrade WebSocket](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
Validar conexões longas e qualquer timeout intermediário com os fluxos reais.

## 10. Homologar antes de liberar clientes

- Login, logout, renovação da sessão, cookies Secure e permissões administrativas.
- Criação de workspace, campanhas, planos, saldo e isolamento entre usuários.
- Academy em `https://agencianexos.vip/nexos-academy/` e seus arquivos JS/CSS.
- IP efetivo nas cotas, origens CORS e realtime no navegador, incluindo
  `/api/socket.io` quando usado pelo cliente.
- Upload e reprodução de uma mídia; recriar a API e confirmar persistência.
- Um fluxo real de cada provedor contratado, controlando cobrança e envio.
- Webhooks Meta, com verificação e assinatura, nas rotas existentes:
  `/api/social/webhooks/meta` e `/api/social-moderation/webhooks/meta`.
- URLs OAuth e webhooks dos demais provedores: atualizar no painel de cada um
  usando os caminhos registrados no código, preservando segredos de assinatura.
- E-mail de entrega/recuperação e fluxo Asaas em sandbox antes de transações reais.

Após a homologação, retirar `DRY_RUN_MODE=true` apenas quando desejar execução
real. Retirar o bloqueio de vídeo somente após validar o custo e um caso manual.
Alterações em `app.env` são lidas na inicialização; reiniciar a API explicitamente:

```bash
dc up -d --force-recreate --wait api
```

Manter a origem anterior sem escritores depois da mudança definitiva. Não
executar simultaneamente duas cópias consumindo os mesmos trabalhos.

## 11. Backups, observabilidade e atualização

1. Configurar backups automáticos do RDS, testar restauração e fazer snapshot
   antes de migrations. Preferir Multi-AZ quando a disponibilidade justificar o custo.
2. Proteger o EBS que guarda volumes de uploads e Redis. Programar snapshots
   com AWS Backup ou Data Lifecycle Manager e testar a recuperação em outra
   instância. Para consistência, coordenar snapshots com os escritores/Redis;
   um snapshot isolado não garante consistência entre banco, filas e mídia.
   A AWS documenta a [automação de snapshots EBS](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-snapshots.html).
3. Guardar chaves de criptografia e configuração privada separadamente do
   banco. Não fazer backup público nem versionar segredos no Git.
4. Monitorar CPU, memória, disco, filas, erros e `/api/readyz`; configurar alertas.
   Usar CloudWatch Agent para memória/disco/logs, com IAM mínimo, se adotado.
   O healthcheck Docker sinaliza falhas, mas Compose não reinicia um processo
   vivo só porque ficou `unhealthy`.
5. Para diagnóstico:

   ```bash
   dc ps
   dc logs --tail=100 api web redis
   sudo journalctl -u caddy --since '30 minutes ago'
   ```

   Não compartilhar logs sem conferir se contêm dados pessoais ou credenciais.
6. Para uma nova versão: validar o commit, fazer backup, preparar janela de
   manutenção, parar a API quando a migration exigir exclusão de escritores,
   trocar as tags, construir imagens, aplicar migrations revisadas, executar
   `db-tools`, subir e repetir o smoke HTTPS. Para rollback, voltar às imagens
   anteriores **somente se forem compatíveis com o schema atual**. Não reverter
   schema automaticamente. Nunca usar `down --volumes` em produção.

Esta primeira arquitetura tem uma EC2 como ponto único de falha da aplicação.
Evoluir para imagens no ECR, deploy automatizado, armazenamento compartilhado
e ECS/serviços separados depois de adaptar workers, agendadores e realtime.
Criar um bucket S3, sozinho, não faz o código atual usar esse bucket.

## Critério de conclusão

A implantação termina quando domínio e HTTPS funcionam, readiness retorna
sucesso, login e fluxos contratados passaram, dados/mídias foram conferidos,
alertas e restauração foram testados, e os consumidores da origem foram
desativados. Containers iniciados, por si só, não comprovam esses requisitos.
