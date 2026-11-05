# Preparação AWS — agencianexos.vip

O repositório está preparado para EC2 Ubuntu 24.04 x86_64, RDS PostgreSQL
privado e HTTPS em `https://agencianexos.vip`, na região selecionada
`us-east-2` (Ohio). A EC2, o RDS e o bucket S3 já foram criados nesse projeto.
Nenhum recurso AWS é criado pelos testes ou pelo `init`.

## O que você precisa contratar/configurar

| Item | Configuração inicial | Para que serve |
| --- | --- | --- |
| Conta AWS | Faturamento ativo, MFA, identidade IAM de administração | Criar e administrar os recursos |
| DNS | Acesso ao painel que gerencia `agencianexos.vip` | Apontar o domínio para o servidor |
| VPC | DNS ativo, uma subnet pública e duas privadas em AZs distintas | Separar aplicação e banco |
| EC2 | Atual: Ubuntu 24.04 LTS x86_64, `t3.micro` (1 GiB) | API, workers, frontend, Academy e Redis; abaixo da recomendação inicial de 2 vCPU/8 GiB |
| EBS | gp3, 60–100 GiB iniciais, criptografado | Sistema, imagens, uploads e Redis |
| Elastic IP | Associado à EC2 | Endereço fixo para o DNS |
| RDS | PostgreSQL 18.3, `db.t4g.micro`, privado | Banco `nexos` inicializado sem importar dados do Supabase |
| S3 | Atual: bucket privado `nexos-467626281008-us-east-2-an` e role da EC2 | Imagens e vídeos das campanhas, após integrar o backend |
| Backups | RDS automático e snapshots EBS com retenção definida | Recuperação de banco, uploads e filas |
| Monitoramento | Orçamento AWS, alertas de disco/memória/CPU e readiness | Detectar custos e indisponibilidade |
| Provedores | Credenciais dos módulos contratados, em arquivos privados | IA, Meta/WhatsApp, e-mail, pagamentos etc. |

## Estado do banco de produção

O banco `nexos` foi criado na instância RDS `database-1` e inicializado a
partir do schema atual do projeto. O bootstrap criou 189 relações e registrou
87 migrations; os planos `solo` e `agency` foram semeados. Nenhum dado de
usuários, campanhas, saldos, mídia ou integrações do Supabase foi copiado.
Não execute novamente `bootstrap --execute` nesse banco; use `migrate
--execute` para futuras migrations revisadas.

EC2 e RDS estão na mesma VPC/região. O RDS permite TCP 5432 somente a partir
do Security Group da EC2. Na EC2, 80/443 permanecem públicos e a entrada SSH
foi removida depois que o SSM ficou online. Não publicar 8080, 8081, Redis ou
PostgreSQL na Internet.

Para reduzir custo no início, é possível homologar com RDS Single-AZ e classe
pequena compatível com a versão PostgreSQL de origem, dimensionando após medir a carga.
Multi-AZ oferece maior disponibilidade do banco e aumenta o custo. Esta versão
mantém uma única API; ainda é necessário adaptar agendadores/realtime para
escalar a aplicação horizontalmente. Consulte os valores da região no
[AWS Pricing Calculator](https://calculator.aws/), incluindo EC2, RDS, EBS,
IPv4 público, snapshots, tráfego e logs. Não presumir gratuidade.

Você não precisa transferir o registro do domínio para a AWS. Se o DNS estiver
em outro provedor, basta criar o registro `A`. Antes de alterar o domínio,
preservar registros MX/TXT de e-mail e conferir se o endereço já atende algum
site. Se houver proxy/CDN, homologar os headers e a origem separadamente;
os arquivos deste pacote consideram acesso direto ao Caddy da EC2.

## Arquivos preparados

- `../app/compose.aws.yml`: API e frontend em loopback, Redis privado e rotação de logs.
- `Caddyfile`: domínio e rotas HTTPS, API diretamente atrás de um proxy.
- `app.env.example`: configuração da aplicação, sem credenciais reais.
- `deployment.conf.example`: imagens e caminhos de operação, sem senhas.
- `runtime.mjs`: geração de segredos para ambiente novo e validação estática.
- `resolve-app-secrets.mjs`: materializa as chaves de APIs externas do Secrets Manager em arquivo privado para o container.
- `external-apis.secret.example.json`: catálogo das chaves suportadas; preencha somente as integrações habilitadas.
- `nexos.sh`: preparação, build, schema, início, parada e diagnóstico na EC2.
- `deploy-from-git.sh`: atualização manual na EC2, com pull fast-forward, build, migrations e health checks.
- `media-storage.cloudformation.json`: bucket S3 privado e instance profile para a EC2.
- [Integração e migração S3](S3_MEDIA.md): recursos preparados e adaptação necessária no backend.
- [CD via GitHub Actions](GITHUB_ACTIONS_DEPLOYMENT.md): workflow para publicar imagens no ECR e implantar pela SSM; OIDC ainda requer liberação na política do projeto AWS.
- [Implantação manual](MANUAL_DEPLOYMENT.md): publicação a partir deste computador pelo perfil `nexos`, ECR, S3 e SSM.

## Sequência na EC2 nova

Primeiro criar os recursos AWS, instalar Docker/Compose e Caddy e colocar o
código validado em `/opt/nexos`. O [guia completo](../../docs/AWS_DEPLOYMENT.md)
descreve rede, criação de recursos, transferência e migração do banco.

Depois executar em Bash na EC2:

```bash
cd /opt/nexos
sudo bash ops/aws/nexos.sh init
sudo nano /etc/nexos/app.env
sudo nano /etc/nexos/deployment.conf
sudo curl --fail --show-error --location https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /etc/nexos/rds-ca.pem
sudo chmod 0644 /etc/nexos/rds-ca.pem
sudo bash ops/aws/nexos.sh check
sudo bash ops/aws/nexos.sh build
```

`init` gera SESSION_SECRET, JWT_SECRET, JWT_REFRESH_SECRET, a chave de
criptografia e a senha Redis em arquivos privados fora do Git. Não imprime
valores e recusa substituir arquivos existentes. Preencha manualmente no
`/etc/nexos/app.env` o endpoint/usuário/senha do RDS e a configuração central
do NexOS. Preserve a chave de criptografia original se importar tokens já
criptografados.

### Segredos de APIs externas

Para administrar as integrações em um único lugar, crie no Secrets Manager um
único segredo do tipo **Other type of secret**, com `SecretString` em JSON. Use
`external-apis.secret.example.json` como catálogo. Ele reúne credenciais, IDs,
URLs e opções das integrações de IA, e-mail, redes sociais, pagamentos, mídia,
CRM e serviços de domínio. Edite esse único JSON quando trocar ou acrescentar
uma configuração de provedor; não replique esses campos no `app.env`.

O `app.env` permanece para configuração central do NexOS, conexão ao banco e
opções de execução. Quando o segredo agrupado está configurado, ele é a fonte
de verdade para as integrações: valores legados de integrações e referências
individuais `NOME_ARN` no `app.env` são ignorados. Isso permite migrar sem deixar
valores antigos sobrescreverem a configuração central. Valores vazios ou
ausentes no JSON ficam sem definição para que os padrões internos do aplicativo
se apliquem; chaves desconhecidas e valores que não sejam texto são rejeitados.

Configure o ARN completo desse segredo em
`/etc/nexos/deployment.conf`:

```bash
NEXOS_EXTERNAL_APIS_SECRET_ARN=arn:aws:secretsmanager:us-east-2:<AWS_ACCOUNT_ID>:secret:nexos/production/external-apis-<SUFFIX>
```

O ARN ilustrativo acima não é um ARN real. Copie o ARN mostrado no Secrets
Manager e mantenha o segredo em `us-east-2`. No deploy ou reinício, a EC2 busca
o JSON por meio da AWS CLI usando o instance profile, gera
`/etc/nexos/app.env.resolved` com modo `0600` e entrega esse arquivo ao
container. Os valores não são impressos nos logs. Depois de alterar o JSON no
Secrets Manager, faça um novo deploy/reinício para o NexOS carregar a versão
atualizada; não é necessário editar também o `app.env`.

As chaves reconhecidas para o JSON são:

| Integração | Exemplos de campos no JSON |
| --- | --- |
| IA | Chaves e parâmetros da Anthropic, OpenAI, Gemini e AI Integrations, incluindo `ANTHROPIC_WORKSPACE_ID` e URLs base |
| E-mail | Resend, SMTP e Gmail: credenciais, remetentes, host, porta e TLS |
| Meta, Instagram e WhatsApp | IDs e segredos de apps, verificação de webhook, URL pública e opção de inscrição automática |
| TikTok | Client key/secret, app de anúncios e URL de autorização |
| Google | OAuth e token de desenvolvedor do Google Ads |
| CRM e LinkedIn | IDs e segredos OAuth do HubSpot, RD Station e LinkedIn |
| Pagamentos Asaas | Chaves de produção/sandbox, modo de ambiente e tokens/segredos de webhook |
| Geração de mídia | Runway, fal.ai, HeyGen e ElevenLabs, incluindo versão da API Runway |
| Domínios, Cloudflare e integrações | URLs e credenciais de Cloudflare, Hostinger, registrador, webhooks e publicação de landing pages |

O instance profile da EC2 precisa de `secretsmanager:GetSecretValue` somente
para o ARN do segredo configurado. Se ele usar uma chave KMS gerenciada pelo
cliente, conceda também `kms:Decrypt` nessa chave específica. Não grave
`AWS_ACCESS_KEY_ID` ou `AWS_SECRET_ACCESS_KEY` em `app.env`; o instance profile
fornece credenciais AWS temporárias.

Não coloque no segredo os tokens OAuth que cada cliente autoriza ao conectar
suas próprias contas. Esses tokens são dados de integração por workspace no
banco; o segredo único cobre as credenciais e opções globais usadas pelo NexOS.

Para criar outro ambiente vazio, configure o `DATABASE_URL` para o catálogo
`nexos` no RDS e execute o bootstrap abaixo. Na instância atual, o catálogo e o
schema já foram criados. Não coloque senhas no Git, no chat nem no comando SSM.

```bash
sudo bash ops/aws/nexos.sh bootstrap --execute
```

Esse comando cria o schema atual e registra o histórico inicial de migrations;
ele se recusa a executar se já encontrar objetos no schema público. Não
restaurar dados do Supabase nesse ambiente. O bootstrap exige a API parada; os
demais escritores também precisam estar parados. O baseline legado é uma
operação separada e não se aplica ao banco novo.

Antes de iniciar, revisar jobs, outboxes, credenciais e dados importados.
`LOCAL_SAFE_MODE` não protege produção e é rejeitado pelo verificador.
`DRY_RUN_MODE` cobre apenas fluxos específicos. O comando abaixo inicia
agendadores, mesmo que o domínio ainda não esteja publicado:

```bash
sudo bash ops/aws/nexos.sh start --activate
sudo bash ops/aws/nexos.sh smoke
```

Apontar o registro `A` de `agencianexos.vip` para o Elastic IP e publicar o proxy:

```bash
sudo install -m 0644 ops/aws/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl --fail https://agencianexos.vip/api/readyz
```

Conferir também `https://agencianexos.vip/` e
`https://agencianexos.vip/nexos-academy/`, login, realtime, upload e um fluxo
controlado por integração. Confirmar cookies Secure no navegador e atualizar
callbacks OAuth/webhooks nos provedores. Não considerar a configuração estática
como validação das credenciais ou da conectividade com o RDS.

## Operação

```bash
sudo bash ops/aws/nexos.sh status
sudo bash ops/aws/nexos.sh logs
sudo bash ops/aws/nexos.sh verify-db
sudo bash ops/aws/nexos.sh stop
```

`stop` interrompe web/API e mantém os dados e o Redis. Alterar segredos requer
recriar a API; `start --activate` faz essa recriação. Para nova release, o
workflow de CD publica as imagens e executa as migrations registradas antes de
recriar API e frontend. As migrations de produção devem ser compatíveis com a
versão anterior, pois o rollback de containers não desfaz alterações no banco.
Confirme que o backup/PITR do RDS está ativo e revisado antes de uma migration
potencialmente incompatível. Não use tags `latest`/`local`; mantenha a versão
anterior. Nunca remova volumes de produção para resolver uma falha.

Para uma atualização manual diretamente pela EC2, execute na raiz do clone:

```bash
sudo bash ops/aws/deploy-from-git.sh
```

O script exige a branch `main`, árvore sem alterações rastreadas, confirmação
de backup/PITR do RDS, pelo menos 2 GiB entre RAM+swap e 3 GiB livres em disco.
Ele mantém `current/`, `releases/` e outros arquivos não rastreados fora do Git,
cria imagens locais versionadas pelo commit, aplica migrations e só então
atualiza `/etc/nexos/deployment.conf`. A compilação ocorre antes das migrations
para que a aplicação e as ferramentas de banco venham do mesmo commit. O
rollback de código/imagens não desfaz migrations aplicadas.

Os comandos não instalam o host, não criam a conta/rede/EC2/RDS, não alteram
DNS e não configuram backups/CloudWatch automaticamente. São as próximas
etapas externas depois da preparação local.

## Verificação local e CI

```powershell
pnpm run test:aws-preparation
pnpm run typecheck
pnpm run test:docker-local
```

O teste AWS valida a configuração sem iniciar serviços e testa geração e
preservação de segredos. O teste Docker usa somente bancos/filas descartáveis.
O workflow de infraestrutura executa os novos checks e valida a sintaxe Bash.

As verificações executadas e as pendências de produção estão registradas em
[AWS_PREPARATION_RESULTS.json](../../docs/evidence/AWS_PREPARATION_RESULTS.json).

O workflow de CD requer os recursos, permissões e variáveis documentados em
[GITHUB_ACTIONS_DEPLOYMENT.md](GITHUB_ACTIONS_DEPLOYMENT.md). Ele aplica as
migrations registradas durante o deploy e não guarda a chave PEM nem credenciais
AWS no GitHub. Esse fluxo usa imagens imutáveis e SSM. O caminho manual
`deploy-from-git.sh` é separado e compila na EC2; ele exige memória/swap e espaço
livre suficientes, além de backup/PITR confirmado.
