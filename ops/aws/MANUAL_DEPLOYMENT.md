# Implantação manual do NexOS

Use `deploy-manual.ps1` para publicar uma release desta cópia de trabalho sem
GitHub Actions/OIDC. O script constrói as imagens no computador, envia as
imagens aos repositórios ECR `nexos-api` e `nexos-web`, envia os arquivos de
operação ao prefixo privado `releases/` do S3 e inicia a implantação pela SSM.
Ele não usa a chave PEM e não envia segredos no comando SSM.

## Pré-requisitos

- Docker Desktop iniciado e acessível no PowerShell.
- Perfil local da AWS CLI `nexos`, autenticado no projeto `467626281008`.
- Permissões locais para publicar imagens no ECR, gravar em `releases/` e usar
  SSM Run Command na EC2 NexOS.
- EC2 Online na SSM e role da instância com leitura dos repositórios ECR e de
  `releases/*` no S3.
- `/etc/nexos/app.env`, senha do Redis, CA do RDS e
  `/etc/nexos/deployment.conf` configurados na EC2.
- Banco `nexos` vazio criado no RDS, bootstrap executado com
  `sudo bash ops/aws/nexos.sh bootstrap --execute` e verificação concluída antes
  da primeira ativação. O deploy verifica o banco, mas **não** cria o catálogo
  nem aplica o bootstrap.

## Executar

Na raiz do repositório, em PowerShell:

```powershell
.\ops\aws\deploy-manual.ps1
```

Para publicar as imagens e o pacote sem iniciar a aplicação na EC2:

```powershell
.\ops\aws\deploy-manual.ps1 -PublishOnly
```

O script confere a identidade da AWS, verifica que a instância está Online na
SSM, constrói as imagens, cria uma release imutável, calcula o checksum do
pacote e espera o resultado do comando remoto. Ele preserva a release anterior
para rollback e não executa SQL de alteração de schema.

## Armazenamento e custo

O build local atual das duas imagens usa aproximadamente 1,55 GB. A AWS informa
500 MB/mês de armazenamento privado ECR gratuito para novos clientes durante um
ano; o excedente pode gerar cobrança, embora os créditos disponíveis possam
cobri-la. O bucket S3 mantém o bloqueio de acesso público e criptografia AES-256.
Releases ECR antigas não são removidas automaticamente.

Não execute o deploy até confirmar a restauração do banco e a configuração do
runtime. A instância atual é `t3.micro` com 1 GiB de RAM; monitore memória e disco
na primeira ativação.
