# NexOS AI

Plataforma de operação de marketing e lançamentos digitais com campanhas,
agentes de IA, produção de conteúdo, automações, integrações sociais, mídia paga,
CRM, mensageria e observabilidade operacional.

Este repositório foi exportado do Replit e também pode ser executado localmente.
O fluxo local suportado usa PostgreSQL e Redis instalados na máquina, API Express
na porta `8080` e aplicação React/Vite na porta `8081`.

## Estado do ambiente local

- aplicação: `http://localhost:8081`;
- API: `http://localhost:8080/api`;
- health check pelo frontend: `http://localhost:8081/api/healthz`;
- liveness: `http://localhost:8080/api/livez`;
- readiness: `http://localhost:8080/api/readyz`;
- PostgreSQL: banco local configurado por `DATABASE_URL`;
- Redis: configurado por `REDIS_URL`;
- proxy Vite: `/api` encaminha para a API na porta `8080`;
- `LOCAL_SAFE_MODE=true`: desativa recuperações de boot e schedulers;
- `DRY_RUN_MODE=true`: evita chamadas reais dos agentes cobertos pelo dry-run;
- webhooks Meta: duas URLs compatíveis usam o mesmo processador de DMs e comentários.

## Requisitos

- Windows 10/11, Linux ou macOS;
- Node.js 24;
- pnpm;
- PostgreSQL;
- Redis 6.2 ou superior recomendado pelo BullMQ;
- FFmpeg para os módulos de vídeo.

No Windows, o projeto atual foi validado com PostgreSQL e Redis executados pelo
Laragon/serviços locais.

## Configuração rápida

1. Instale as dependências:

   ```powershell
   pnpm install
   ```

2. Crie ou ajuste `.env.local`. O launcher local lê primeiro o `.env` local e
   depois `.env.local`; valores locais substituem os valores anteriores. Esses
   dois arquivos são ignorados pelo Git. Use `.env.example` como referência.

   ```dotenv
   DATABASE_URL=postgresql://USUARIO:SENHA_URL_ENCODED@127.0.0.1:5432/nexosAi
   REDIS_URL=redis://127.0.0.1:6379
   APP_URL=http://localhost:8081
   LOCAL_SAFE_MODE=true
   DRY_RUN_MODE=true
   META_WEBHOOK_AUTO_SUBSCRIBE=false
   ```

3. Confirme que PostgreSQL e Redis estão ativos.

4. Inicie o projeto:

   ```powershell
   pnpm run dev:local
   ```

O comando compila a API, inicia o backend em `8080` e o frontend em `8081`.

Consulte [Desenvolvimento local](docs/LOCAL_DEVELOPMENT.md) para restauração do
banco, diagnóstico e solução de problemas.

## Comandos principais

| Comando | Finalidade |
| --- | --- |
| `pnpm run dev:local` | API e frontend locais, usando provedores conforme o ambiente |
| `pnpm run dev:local:meta-test` | API e frontend com chamadas Meta de saída simuladas |
| `pnpm run dev:meta-gateway` | Gateway restrito às duas rotas de webhook Meta |
| `pnpm run typecheck:libs` | Compila os projetos TypeScript compartilhados |
| `pnpm run typecheck` | Valida todos os pacotes e artefatos |
| `pnpm run build` | Typecheck e build do workspace |
| `pnpm run security:scan` | Bloqueia arquivos sensíveis e padrões conhecidos de credenciais |
| `pnpm run security:audit-history` | Lista caminhos sensíveis ainda alcançáveis no histórico |
| `pnpm --filter @workspace/app run check:bundle` | Confere o limite de 500 KiB do JavaScript inicial |
| `pnpm --filter @workspace/db run push` | Sincroniza o schema em banco de desenvolvimento |
| `pnpm --filter @workspace/db run migrate:tracked` | Aplica migrations SQL já rastreadas |
| `pnpm --filter @workspace/db run bootstrap:check` | Confirma que o schema público está vazio |
| `pnpm --filter @workspace/db run bootstrap:empty` | Cria o schema atual em um banco totalmente vazio |
| `pnpm --filter @workspace/db run seed:plans` | Cria ou atualiza os planos essenciais |
| `pnpm --filter @workspace/db run verify` | Verifica schema, checksums, constraints e planos |

Não execute `db push` automaticamente sobre um banco restaurado ou de produção.
Primeiro compare o schema e preserve o backup.

Em um banco novo, execute `bootstrap:check`, `bootstrap:empty`, `seed:plans` e
`verify`, nessa ordem. O bootstrap só aceita um schema público totalmente vazio,
é transacional e registra o snapshot e as migrations incrementais com checksum.

O primeiro baseline de um banco legado exige backup, verificação das tabelas
canônicas e `MIGRATION_BASELINE_EXISTING_SCHEMA=true`. O executor recusa fazer
baseline em banco vazio; para esse caso use exclusivamente o bootstrap.

## Arquitetura resumida

| Diretório | Responsabilidade |
| --- | --- |
| `artifacts/app` | Aplicação principal React/Vite |
| `artifacts/api-server` | API Express, workers e módulos de domínio |
| `artifacts/landing` | Landing pública |
| `artifacts/nexos-academy` | Aplicação da Academy |
| `artifacts/video-editor` | Editor e pipeline audiovisual |
| `lib/db` | Schema Drizzle, conexão PostgreSQL e seeds |
| `lib/api-spec` | Contratos da API |
| `lib/api-zod` | Schemas de validação compartilhados |
| `lib/api-client-react` | Cliente React da API |
| `scripts` | Launchers, testes operacionais e utilitários |

A API usa módulos por domínio em `artifacts/api-server/src/modules`. As rotas
são agregadas em `artifacts/api-server/src/routes/index.ts` e publicadas sob
`/api`.

## Segurança no desenvolvimento

- `.env.local` é ignorado pelo Git.
- `.env` e `.env.local` podem conter credenciais reais, são ignorados pelo Git e
  não devem ser compartilhados. Credenciais que já apareceram no histórico do
  repositório precisam ser rotacionadas antes de qualquer publicação.
- Backups locais devem usar nomes como `backup.local.sql` e permanecer fora do
  Git. Armazene a cópia definitiva em local criptografado e com acesso restrito.
- `LOCAL_SAFE_MODE` impede schedulers e recuperações automáticas, mas não torna
  toda ação manual inofensiva.
- Para testar callbacks Meta sem enviar respostas reais, use
  `pnpm run dev:local:meta-test`.
- A assinatura automática `subscribed_apps` permanece desativada por padrão para
  não modificar as contas do banco restaurado.

## Meta: Manage Messages e Manage Comments

As duas rotas abaixo aceitam verificação `GET` e entregas `POST` assinadas:

```text
/api/social/webhooks/meta
/api/social-moderation/webhooks/meta
```

Ambas processam DMs e comentários pelo mesmo pipeline. Eventos duplicados são
protegidos por claims idempotentes persistidos no PostgreSQL.

Para receber callbacks reais em desenvolvimento é necessário um endereço HTTPS
público. Use um App Meta de desenvolvimento e o gateway restrito; não substitua
o callback do App de produção. Veja [Webhooks Meta no ambiente local](docs/META_WEBHOOK_LOCAL_DEV.md).

## Documentação

- [Desenvolvimento local](docs/LOCAL_DEVELOPMENT.md)
- [Webhooks Meta no ambiente local](docs/META_WEBHOOK_LOCAL_DEV.md)
- [Runbook do Meta App Review](docs/META_APP_REVIEW_TEST_RUNBOOK.md)
- [Arquitetura mestre](NEXOS_MASTER_ARCHITECTURE.md)
- [Mapa de workflows](NEXOS_WORKFLOW_MAP.md)
- [Máquina de estados](NEXOS_STATE_MACHINE.md)
- [Contratos dos agentes](NEXOS_AGENT_CONTRACTS.md)
- [Guardrails](NEXOS_GUARDRAILS.md)

`PROGRESS.md` é um registro histórico do plano de correção do ambiente Replit e
não deve ser usado como estado operacional atual.
