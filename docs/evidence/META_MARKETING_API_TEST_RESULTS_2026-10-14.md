# Meta Marketing API — evidências de homologação

Data: 14/10/2026
Aplicativo: NexOS AI Integration
Conta de teste: @agencianexosai
Escopo: consultas somente leitura. Nenhuma campanha foi criada, editada ou publicada; nenhum anúncio foi impulsionado.

## Resultado das chamadas reais

As chamadas foram feitas no Graph API Explorer com Graph API v26.0 e retornaram HTTP/Graph API sem erro:

| Consulta | Resultado |
| --- | --- |
| Listar contas de anúncio autorizadas | Sucesso; uma conta retornada |
| Listar campanhas da conta | Sucesso; lista vazia |
| Consultar insights dos últimos 7 dias | Sucesso; lista vazia |
| Listar conjuntos de anúncios | Sucesso; lista vazia |
| Listar anúncios | Sucesso; lista vazia |

As listas vazias indicam que não há campanhas, conjuntos, anúncios ou métricas disponíveis nessa conta para comprovar leitura de dados de mídia. A descoberta da conta confirma a autorização básica, mas não substitui a homologação de leitura de campanhas e insights com dados existentes.

## Estado no painel da Meta

- `business_management`, `ads_read` e `ads_management`: aparecem como concluídas na tela de testes.
- Marketing API Access Tier: **0/500 chamadas requeridas** no momento da verificação; a Meta também exige taxa de sucesso mínima de 85%.
- O painel informa que a contabilização pode levar até 24 horas.

## Permissões do caso de uso do Instagram

Na tela do caso “Manage messaging & content on Instagram”, cinco permissões seguem com 0/1 chamada requerida: `instagram_manage_engagement`, `instagram_manage_contents`, `instagram_business_manage_insights`, `instagram_business_content_publish` e `instagram_business_manage_comments`. `instagram_business_manage_messages` e `instagram_business_basic` aparecem com 0 chamadas de teste, sem requisito 0/1 visível.

A sessão do navegador foi trocada para `@agencianexosai`. O consentimento de login direto pelo Instagram foi concluído para essa conta. O botão “Testar conexão” ainda falhou com `Invalid OAuth access token`. A revisão do código encontrou que o validador usava `graph.facebook.com` mesmo para credenciais marcadas `authType=instagram_login`; tokens do login direto precisam ser verificados pelo Instagram Graph. A correção foi enviada para `main` no commit `b69d230b`, e os workflows de qualidade, segurança e infraestrutura passaram. O backend de produção ainda mostra a resposta antiga: este repositório não tem workflow de publicação do container, então o push não atualizou o servidor.

As cinco consultas registradas acima são testes funcionais pontuais. Não foram repetidas artificialmente para tentar preencher a meta do painel. A contagem deve avançar com chamadas legítimas do uso da integração.

## Ajustes locais no NexOS

As referências do Graph API e do Marketing API usadas pelo NexOS foram atualizadas de v20.0 para v26.0 nos fluxos de OAuth, validação, sincronização de mídia paga e eventos de servidor. A atualização está apenas no workspace local; não foi publicada no servidor.

O validador de credenciais do Instagram agora identifica `authType=instagram_login` e consulta o perfil no host `graph.instagram.com`. O fluxo Facebook Login continua validado pelo Facebook Graph. A correção está no GitHub, mas ainda precisa ser incluída na imagem do serviço e publicada no host de produção. Depois, repetir “Testar conexão” com `@agencianexosai` e executar chamadas legítimas para cada permissão requerida no painel Meta.

Referência técnica conferida: [Login de Empresa no Instagram — documentação da Meta](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), atualizada em 13/03/2026. Ela documenta o fluxo de troca do código e token longo, o uso dos hosts `api.instagram.com` e `graph.instagram.com`, e os novos escopos `instagram_business_*`.

## Verificações locais

- `npm run typecheck`: passou para os projetos do workspace.
- `npm run test:paid-media` em `artifacts/api-server`: passou (`paid-media domain tests passed`).
- `pnpm exec tsx src/scripts/test-instagram-login.ts` em `artifacts/api-server`: passou, cobrindo validação do Instagram Login e preservação do Facebook Login.
- `git diff --check`: passou; somente avisos preexistentes de conversão LF/CRLF.

## Pendências para concluir a homologação

1. Publicar no host de produção a imagem da API contendo o commit `b69d230b` e repetir “Testar conexão” na aplicação com `@agencianexosai`.
2. Executar uma chamada legítima de cada uma das cinco permissões Instagram que exigem 1 chamada no painel, confirmar sucesso no webhook/mensagem/comentário ou leitura correspondente e registrar a evidência. Não gerar chamadas artificiais apenas para elevar a contagem.
3. Usar uma conta de anúncios com campanhas/insights acessíveis para validar retorno de dados reais, respeitando as permissões concedidas.
4. Aguardar a atualização do painel Meta e confirmar os 500 testes requeridos e a taxa mínima de sucesso de 85% do Marketing API Access Tier. Não há evidência de que essa etapa esteja concluída.

Tokens, segredos e identificadores completos da conta foram omitidos deste relatório.

## Atualização de status — 15/10/2026

O Founder confirmou que o requisito do Marketing API Access Tier (500 chamadas e
taxa de sucesso mínima de 85%) foi concluído. A captura `0/500` acima é o estado
observado em 14/10/2026 e não representa o status atual. Para a homologação
Instagram, as duas operações já foram executadas pelo fluxo Facebook Login, conforme
as evidências ao vivo em `docs/META_INSTAGRAM_TEST_FIXTURES.md`: a chamada de curtir
(`instagram_manage_engagement`) retornou sucesso e a exclusão temporária
(`instagram_manage_contents`) retornou `success=true`, seguida pela confirmação de
que a mídia não estava mais disponível. `GET /me/permissions` também mostrou os dois
escopos como `granted`. `instagram_manage_contents` remove um post, story ou reel;
não é permissão para apagar comentário.

Resta conferir a atualização assíncrona dos contadores no painel da Meta. Na captura
imediata após as operações, ambos ainda apareciam como `0/1`; a documentação informa
que a contabilização pode levar até 24 horas. Portanto, há evidência das chamadas
reais, mas ainda não há evidência de que os dois contadores do painel mudaram para
concluídos.
