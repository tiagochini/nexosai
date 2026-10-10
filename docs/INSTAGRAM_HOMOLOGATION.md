# Homologação Instagram do founder

Conta autorizada para posts: **@agencianexosai**. Conta externa autorizada para
mensagem e comentário `mapa`: **@professorbruceallan**. Conexão e automações
devem pertencer ao workspace do founder@nexos.ai.

## Verificação realizada

O Supabase de homologação e a rota autenticada `/api/social/review-readiness`
confirmaram que esse workspace ainda não possui integrações Instagram/Facebook.
Sessões abertas no navegador não constituem uma integração no NexOS.
App e webhook Meta estão configurados. Nenhum post, comentário ou DM real foi
enviado nesta verificação.

Docker/Redis de homologação estavam indisponíveis; foram iniciados e passaram
autenticação/isolamento, schema e segurança. A aplicação foi reiniciada no perfil
de homologação. Saúde, readiness e login público do founder retornaram 200.

O NexOS utiliza Facebook Login, mas os dois fluxos OAuth e a lista de análise
solicitavam `instagram_business_manage_messages`, da família Instagram Login.
Foram alinhados para `instagram_manage_messages`. Tipos da API passaram; as
URLs produzidas pelas rotas autenticadas de Instagram e Facebook foram
verificadas no servidor ativo: host Facebook, permissão correta e sem mistura
com a permissão de mensagens Instagram Login. A sessão temporária de auditoria
foi encerrada pelo logout normal (204).

[Evidência sanitizada](./INSTAGRAM_HOMOLOGATION_RESULTS.json).
[Referência Meta: permissões da Conversations API no Facebook Login](https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a).

## Próximo checkpoint

1. Entrar no NexOS com founder@nexos.ai e abrir Integrações → Instagram Business.
   Concluir OAuth com a conta administradora da Página vinculada ao Instagram
   profissional @agencianexosai. Conferir o nome/ID efetivamente salvo antes de
   publicar: uma conta diferente não está autorizada para o post desta jornada.
2. Confirmar assinatura do webhook, token válido e vínculo somente ao workspace
   do founder. A ferramenta de controle do navegador estava indisponível; o
   consentimento externo ainda precisa ser concluído na interface pelo usuário.
3. Preparar/publicar o post autorizado “Teste de integração NexOS” pela rota
   normal de produto, guardar ID/permalink e comprovar publicação no provider.
4. Validar métricas e configurar a resposta `mapa` limitada à conta/post de teste.
   @professorbruceallan envia o comentário e a DM; conferir callback real,
   resposta pública/privada conforme configuração, IDs de envio e idempotência.
   Não criar eventos falsos para representar chamadas Meta reais.
5. Conferir os contadores no painel Meta e gravar a jornada quando concluída.
   A família `instagram_business_*` corresponde a outro fluxo de login; o teste
   do Facebook Login não deve ser registrado como prova dessa família.

Maturidade: preparação de conexão corrigida e verificada; testes externos ainda
bloqueados por ausência de conta conectada. Publicação do app e aprovações Meta
não foram alteradas. Nenhum push executado.
