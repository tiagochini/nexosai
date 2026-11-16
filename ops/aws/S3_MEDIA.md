# S3 para imagens e vídeos das campanhas

O S3 entra na arquitetura como armazenamento definitivo dos arquivos. A EC2
continua executando API e processamento; o RDS guarda os metadados e as chaves
dos objetos. Arquivos temporários de renderização continuam em disco local.
Guardar campanhas no S3 evita depender do ciclo de vida do disco da EC2.

## Infraestrutura atual

O bucket `nexos-467626281008-us-east-2-an` já existe em `us-east-2`. Ele está
privado, com bloqueio de acesso público, versionamento, propriedade dos objetos
controlada pelo bucket e criptografia SSE-S3. A role `nexos-production-ec2-role`
está associada à EC2; seu acesso a objetos está limitado ao prefixo `media/*`.
Não implante o template abaixo para a mesma produção, pois ele criaria outro
bucket e outra role.

## Template opcional para outro ambiente

`media-storage.cloudformation.json` cria, na região selecionada:

- Um bucket com nome único gerado pela AWS, criptografia SSE-S3 e acesso público bloqueado.
- Versionamento e retenção do bucket se a stack for removida/substituída.
- Regra para abortar uploads multipart incompletos depois de sete dias.
- Política exigindo HTTPS.
- Uma role e um instance profile da EC2 com acesso apenas a `media/*` nesse bucket.

O template não cria a EC2 e não altera a aplicação. Não expira arquivos
concluídos automaticamente. Versões anteriores e delete markers podem continuar
gerando custos: definir retenção após conhecer requisitos de recuperação.
Excluir um objeto versionado não apaga versões anteriores. Uma exclusão
definitiva, quando exigida, precisa de procedimento específico para versões;
a role da aplicação não recebe `DeleteObjectVersion` neste pacote.

Para um ambiente separado, implante o template somente na região selecionada
`us-east-2`, revise os recursos/IAM e use um nome de ambiente distinto. A role
existente já concede à EC2 acesso ao prefixo `media/*` do bucket atual.

Não criar access keys permanentes para colocar no frontend ou no repositório.
O SDK no backend deve obter credenciais temporárias da role da EC2. Para
contêiner em rede bridge obter credenciais via IMDSv2, conferir a configuração
de metadata hop limit da EC2; pode ser necessário definir o limite em 2.
Manter IMDSv2 obrigatório. Nunca disponibilizar endpoints de metadata ao usuário.

## Adaptador de armazenamento da aplicação

`artifacts/api-server/src/lib/gcs-recordings.ts` seleciona S3 quando
`NODE_ENV=production`, com o bucket definido por `NEXOS_MEDIA_S3_BUCKET` e
região `AWS_REGION` ou `AWS_DEFAULT_REGION` (padrão `us-east-2`). O SDK usa a
cadeia padrão de credenciais AWS; na EC2, isso deve resolver para a role
`nexos-production-ec2-role`, sem access keys estáticas.

As chaves lógicas já utilizadas pela aplicação são armazenadas sob `media/`
para respeitar o escopo da role. O adaptador cobre uploads, leitura com Range,
metadados, listagem, URLs assinadas e exclusão nos fluxos que já o utilizam
(gravações, amostras privadas, mídia de presença, criativos de campanha e
produção/edição de vídeo).
Em desenvolvimento local e testes, os mesmos fluxos usam disco; configure
`NEXOS_LOCAL_MEDIA_DIR` para escolher a pasta de desenvolvimento. Os testes que
definem `NATIVE_MEDIA_TEST_STORAGE_DIR` ficam isolados nessa pasta. O staging
Replit continua usando o caminho GCS existente.

Isso não migra automaticamente objetos antigos que ainda estejam em GCS, nem
substitui as verificações de autorização e isolamento por workspace feitas pela
API. Configure `AWS_DEFAULT_REGION=us-east-2` e
`NEXOS_MEDIA_S3_BUCKET=nexos-467626281008-us-east-2-an` no ambiente da API de
produção. Novas imagens de `campaign_creatives` e vídeos de `video_projects`
são enviados ao adaptador após a geração; as colunas/JSON guardam a chave lógica
e não o base64 ou a URL temporária do provedor. As rotas autenticadas entregam
os bytes de volta à interface. Em publicação externa, a API cria uma URL
assinada curta a partir da chave. Em desenvolvimento e homologação local, os
arquivos ficam em `NEXOS_LOCAL_MEDIA_DIR` ou, no Windows, por padrão em
`%LOCALAPPDATA%/NexOS/media`.

Ativos antigos que ainda estejam como data URL/URL externa e registros em outras
tabelas (por exemplo, `campaign_assets`) não são migrados por essa mudança.
Ainda precisam de migração ou de integração específica antes que a origem antiga
seja removida.

Para completar a integração dos demais ativos de campanha ponta a ponta:

1. Padronizar as chaves geradas pelo servidor no formato
   `media/{workspaceId}/{campaignId}/{assetId}/original.ext`; conferir posse da
   campanha antes de upload, leitura e exclusão. IAM da instância protege o
   bucket; o isolamento entre clientes continua sendo responsabilidade da API.
2. Registrar no banco bucket/key, workspace/campanha, MIME, tamanho e checksum.
   Preservar as origens existentes durante a transição e tratar retries sem
   duplicar objetos. Não salvar URLs temporárias como endereço permanente.
3. Autorizar o usuário na API antes de gerar URLs de leitura/upload. Se o
   navegador enviar diretamente ao S3, adicionar CORS somente para
   `https://agencianexos.vip`, com métodos/headers necessários e validação
   posterior de tamanho, checksum e tipo real do arquivo.
4. Gerar URL temporária nova na publicação para Meta e outros provedores,
   com tempo suficiente para o download e suas tentativas. Validar o fluxo
   real de cada provedor. Uma URL S3 assinada pode expirar antes do tempo pedido
   quando as credenciais temporárias da role expiram.
5. Migrar arquivos existentes por lote, verificar checksum e leitura, atualizar
   referências e manter backup antes de remover a origem. Não aplicar esse
   bucket de campanhas a consentimentos, material pago da Academy ou outros
   dados privados sem revisar seus contratos de acesso e exclusão.
6. Testar isolamento entre clientes, expiração, streaming, retries, falha de
   upload, remoção, restauração e publicação real controlada.

CloudFront é uma evolução para distribuição/cache. Pode acessar o bucket
privado com Origin Access Control; a autorização do viewer exige configuração
separada (por exemplo, signed URLs), pois OAC sozinho protege a origem e não
decide quais usuários podem ver cada mídia. Não é pré-requisito para o primeiro
fluxo com URLs S3 assinadas.

Referências: [URLs pré-assinadas S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html),
[CloudFront com origem S3 privada](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html),
[credenciais de roles em EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html).

O template passou no `cfn-lint` para `sa-east-1`; essa validação não significa
que ele foi implantado em `us-east-2`. O adaptador S3 está integrado aos fluxos
que já usam essa camada; os fluxos de ativos de campanha acima ainda precisam
ser concluídos e homologados antes de armazenar campanhas nesse bucket.
