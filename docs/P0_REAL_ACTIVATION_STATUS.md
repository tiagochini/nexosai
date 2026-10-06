# Ativação real do administrador e homologação Asaas

Atualizado em 06/10/2026, 21:06 UTC. **Administrador local ativado; Asaas sandbox pendente.**

## Evidência obtida

- O banco configurado pelo launcher local é PostgreSQL em `127.0.0.1:5432`,
  database `nexosAi`. A conexão funcionou e a tabela `users` tinha zero registros na inspeção inicial.
  A busca parametrizada e somente leitura por `founder@nexos.ai` não retornou
  usuário na inspeção inicial. Após autorização explícita para usar essa conta
  como primeiro usuário master, o cadastro real foi criado.
- Conta master local: `founder@nexos.ai`, UUID
  `dc97c52d-3769-4be3-bed1-c4239cc40796`, workspace
  `a15c8db7-c1e2-4b59-9071-617a7ba55aaf`, ativo, plano Agency e créditos ilimitados
  conforme a política existente do founder. `ACADEMY_ADMIN_USER_IDS` contém o
  UUID real e `ACADEMY_ALLOW_LEGACY_ADMIN_SECRET=false` em `.env.local`.
- Login com a senha gerada e `GET /api/academy/admin/session` passaram no servidor
  HTTP temporário local. Requisições sem autorização, sem sessão e com sessão
  revogada receberam 401. A auditoria persistiu status 200 para o ator real.
  [Evidência sanitizada](./P0_REAL_ADMIN_ACTIVATION.json). Todas as sessões de
  teste foram revogadas; a senha inicial está somente no arquivo privado
  `.local/founder-initial-credentials.json`, ignorado pelo Git. Não foi declarada
  verificação da propriedade do e-mail e nenhum e-mail foi enviado.
- Não havia API ativa na porta 8080. A configuração será carregada ao iniciar
  `pnpm dev:local`; não foi feita implantação em servidor externo.
- Existe uma credencial no campo legado `ASAAS_API_KEY`, mas a consulta GET
  ao sandbox oficial retornou HTTP 401. Não foi usada uma URL de produção.
  `ASAAS_SANDBOX_API_KEY` continua ausente. Um `ASAAS_WEBHOOK_TOKEN` aleatório
  foi preparado em `.env.local`, com cópia privada em
  `.local/asaas-sandbox-webhook-token.txt`, ambos ignorados pelo Git.
  `ASAAS_ENV=sandbox` e `ASAAS_SANDBOX=true` foram configurados localmente;
  o webhook ainda não foi registrado no provedor.
- `APP_URL` aponta para `localhost`; não há endpoint público de homologação
  configurado. Nenhuma cobrança, confirmação, estorno ou inscrição de webhook
  foi realizada. Dados retornados pelo provedor e credenciais não foram impressos.

## Dados necessários para continuar

1. Ao iniciar a aplicação local, entrar com a conta criada e guardar a senha
   inicial com segurança. A autorização Academy usa o UUID e uma sessão ativa. Em homologação
   externa/produção, provisionar explicitamente essa conta no banco correto;
   o UUID local não identifica automaticamente uma conta de outro banco.
2. Configurar uma chave sandbox válida de forma privada, não pelo chat, e
   usar o token local preparado ao registrar o webhook externo. `ASAAS_SANDBOX_API_KEY` é usado pelo checkout de produtos;
   Academy e billing ainda leem `ASAAS_API_KEY`, com seletores de ambiente
   distintos. Antes da jornada, verificar explicitamente a credencial e o
   ambiente de cada módulo; não presumir que configurar um campo altera todos.
3. Informar a URL HTTPS pública da aplicação que recebe `/api/academy/webhook`
   e validar sua
   autenticação antes de registrar eventos no provedor. Com esses pré-requisitos,
   executar criação/confirmação/reconciliação/replay/estorno no sandbox e
   comprovar o recebimento externo dos eventos. Testes simulados locais não
   substituem essa prova.

Fontes oficiais para a preparação: [autenticação Asaas](https://docs.asaas.com/docs/authentication),
[ambiente sandbox](https://docs.asaas.com/docs/sandbox) e
[confirmação exclusiva de sandbox](https://docs.asaas.com/reference/confirmar-pagamento).

A condição administrativa local foi cumprida; a condição Asaas e a ativação
externa do P0 permanecem abertas. Este checkpoint não altera
a maturidade M10/M11/M12 nem certifica os módulos administrativos legados que
ainda possuem critérios de e-mail fora da administração Academy por UUID.
