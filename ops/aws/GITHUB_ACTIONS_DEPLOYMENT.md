# CD do NexOS para EC2

O workflow `.github/workflows/deploy-ec2.yml` prepara imagens Docker no runner
do GitHub, publica versões identificadas pelo SHA do commit no Amazon ECR,
envia os arquivos Compose para um prefixo privado do S3 e aciona a EC2 com
Systems Manager. Não usa a chave SSH. A implantação valida a saúde da API e do
site e tenta reativar a release anterior se a nova falhar. Ela não executa
migrations do banco.

## Situação atual

Os arquivos do CD estão preparados no repositório, mas o workflow ainda não pode
ser executado: o projeto AWS negou `iam:CreateOpenIDConnectProvider` por uma
política de controle do projeto. O OIDC é necessário para o GitHub obter
credenciais AWS temporárias sem guardar uma chave AWS de longa duração no
GitHub. A documentação da AWS informa que o uso de recursos de identidade não
disponíveis na experiência nova exige ativar os recursos avançados; isso requer
o Paid Plan e a ativação é irreversível. Não alterei o plano nem ativei esses
recursos. Consulte [as opções de cadastro da AWS](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html).
A região configurada é `us-east-2`.

## Recursos e permissões necessários

- Dois repositórios ECR privados: `nexos-api` e `nexos-web`.
- Um role de deploy do GitHub com confiança OIDC limitada ao repositório
  `tiagochini/nexosai` e ao ambiente GitHub `production`, usando `aud` igual a
  `sts.amazonaws.com` e `sub` igual a
  `repo:tiagochini/nexosai:environment:production`. O ambiente deve permitir
  deploy somente da branch `main`.
- O role de deploy precisa publicar nos dois repositórios ECR, gravar objetos
  somente em `s3://<bucket>/releases/*` e enviar/consultar comandos SSM somente
  para a instância NexOS.
- O role já anexado à EC2 precisa de leitura nos dois repositórios ECR e em
  `s3://<bucket>/releases/*`, além das permissões SSM existentes e o acesso
  `media/*` já usado pelo sistema.
- A instância precisa estar Online no Systems Manager, com Docker/Compose,
  `/etc/nexos/deployment.conf`, `/etc/nexos/app.env`, o segredo Redis e o
  certificado CA do RDS instalados. O banco vazio `nexos` deve ter recebido o
  bootstrap do schema e sido validado antes do primeiro deploy.

O workflow reutiliza o bucket existente por meio do prefixo `releases/`; não
torna o bucket público. O prefixo de imagens de campanhas permanece `media/`.
As imagens ECR ficam identificadas pelo SHA completo e releases antigas não são
removidas automaticamente.

## Variáveis do ambiente GitHub `production`

Em Settings → Environments, configure `production` e estas variáveis:

| Variável | Valor |
| --- | --- |
| `NEXOS_EC2_INSTANCE_ID` | `i-06b2d23fd5bdff95d` |
| `NEXOS_RELEASE_BUCKET` | `nexos-467626281008-us-east-2-an` |
| `NEXOS_DEPLOY_ROLE_ARN` | ARN do role de deploy OIDC, ainda a criar |

O workflow é acionado por mudanças relevantes em `main` ou manualmente. O
deploy manual só é aceito quando a referência selecionada é `main`. Configure
revisores de implantação no ambiente `production` antes de habilitar o primeiro
deploy automático.

## Bootstrap da primeira release

O comando de deploy exige que `/etc/nexos/deployment.conf` e os arquivos de
runtime já existam e passem em `ops/aws/nexos.sh check`. Ele publica a nova
release em `/opt/nexos/releases/<sha>` e troca `/opt/nexos/current` para a
release ativa. Para a primeira implantação, preparar o runtime, criar o banco
vazio `nexos`, executar `sudo bash ops/aws/nexos.sh bootstrap --execute` e
validar banco, integrações, DNS e HTTPS separadamente antes de habilitar o
workflow.

Nunca adicionar `keys/nexos.pem`, arquivos `.env`, dumps ou credenciais ao
workflow ou ao bucket. O `deploy-ssm.sh` é executado como root pelo SSM e valida
o SHA, região, prefixo ECR e checksum do pacote antes de ativar os containers.
