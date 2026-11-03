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

## Adaptação do código necessária antes de ativar

A auditoria encontrou `artifacts/api-server/src/lib/gcs-recordings.ts`, que usa
credenciais do sidecar Replit/GCS em gravações, mídias de presença, personas e
vídeo. Não existe hoje um adaptador S3 selecionável. A geração de algumas
imagens também retorna data URLs. **O bucket preparado ainda não recebe essas
mídias automaticamente.** Nenhuma variável S3 foi incluída no runtime como se
o suporte já estivesse implementado.

Para completar a integração das mídias publicitárias:

1. Adicionar o adaptador S3 no backend, usando SDK AWS e a role, com uploads
   multipart/streaming para vídeos grandes e downloads com Range.
2. Usar chaves geradas pelo servidor no formato
   `media/{workspaceId}/{campaignId}/{assetId}/original.ext`; conferir posse da
   campanha antes de upload, leitura e exclusão. IAM da instância protege o
   bucket; o isolamento entre clientes continua sendo responsabilidade da API.
3. Registrar no banco bucket/key, workspace/campanha, MIME, tamanho e checksum.
   Preservar as origens existentes durante a transição e tratar retries sem
   duplicar objetos. Não salvar URLs temporárias como endereço permanente.
4. Autorizar o usuário na API antes de gerar URLs de leitura/upload. Se o
   navegador enviar diretamente ao S3, adicionar CORS somente para
   `https://agencianexos.vip`, com métodos/headers necessários e validação
   posterior de tamanho, checksum e tipo real do arquivo.
5. Gerar URL temporária nova na publicação para Meta e outros provedores,
   com tempo suficiente para o download e suas tentativas. Validar o fluxo
   real de cada provedor. Uma URL S3 assinada pode expirar antes do tempo pedido
   quando as credenciais temporárias da role expiram.
6. Migrar arquivos existentes por lote, verificar checksum e leitura, atualizar
   referências e manter backup antes de remover a origem. Não aplicar esse
   bucket de campanhas a consentimentos, material pago da Academy ou outros
   dados privados sem revisar seus contratos de acesso e exclusão.
7. Testar isolamento entre clientes, expiração, streaming, retries, falha de
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
que ele foi implantado em `us-east-2`. Ainda é necessário implementar e
homologar o adaptador S3 no backend antes de armazenar mídias das campanhas.
