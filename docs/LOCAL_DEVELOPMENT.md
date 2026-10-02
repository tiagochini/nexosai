# Desenvolvimento local

Este guia descreve o ambiente local com banco novo ou restaurado.

## 1. Serviços necessários

### PostgreSQL

Crie o banco e configure a conexão. Exemplo de URL:

```dotenv
DATABASE_URL=postgresql://USUARIO:SENHA_URL_ENCODED@127.0.0.1:5432/nexosAi
```

Caracteres especiais da senha precisam estar codificados para URL. Por exemplo,
`@` dentro da senha não pode ser usado literalmente na URI.

Para um banco totalmente vazio, inicialize e valide o schema:

```powershell
pnpm --filter @workspace/db run bootstrap:check
pnpm --filter @workspace/db run bootstrap:empty
pnpm --filter @workspace/db run seed:plans
pnpm --filter @workspace/db run verify
```

O bootstrap recusa qualquer schema público que já contenha tabelas, views,
sequences ou enums. Para um banco restaurado, não execute `push` nem o bootstrap
antes de comparar o schema e preservar um backup verificável.

### Redis

```dotenv
REDIS_URL=redis://127.0.0.1:6379
```

Valide com:

```powershell
redis-cli ping
```

A resposta esperada é `PONG`. Redis 6.2 ou superior é recomendado; versões
anteriores podem funcionar, mas geram alerta do BullMQ e não são o alvo de
compatibilidade.

## 2. Arquivos de ambiente

O launcher `scripts/dev-local.mjs` aplica esta precedência:

1. variáveis do processo;
2. `.env`, arquivo local ignorado pelo Git;
3. `.env.local`, com os valores locais prevalecendo.

Configuração local mínima recomendada:

```dotenv
DATABASE_URL=postgresql://USUARIO:SENHA_URL_ENCODED@127.0.0.1:5432/nexosAi
REDIS_URL=redis://127.0.0.1:6379
APP_URL=http://localhost:8081
LOCAL_SAFE_MODE=true
DRY_RUN_MODE=true
META_WEBHOOK_AUTO_SUBSCRIBE=false
```

`.env` e `.env.local` são ignorados pelo Git. Não copie secrets para
`.env.example`, que deve conter somente placeholders.

## 3. Inicialização

```powershell
pnpm run dev:local
```

O launcher:

1. carrega os arquivos de ambiente;
2. compila `artifacts/api-server`;
3. inicia a API em `http://127.0.0.1:8080`;
4. inicia o Vite em `http://localhost:8081`;
5. encaminha `/api` do frontend para a API.

Verificação rápida:

```powershell
Invoke-WebRequest http://127.0.0.1:8081/api/healthz -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8081/api/livez -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8081/api/readyz -UseBasicParsing
```

O status esperado é `200`. Sem Redis, `/healthz` pode indicar `degraded`, pois a
API possui fallbacks para parte das operações; `/readyz` exige o PostgreSQL.

## 4. Modos de segurança

### `LOCAL_SAFE_MODE=true`

Desativa no boot:

- recuperação automática de campanhas e agentes;
- workers e schedulers de publicação e comunicação;
- varreduras que poderiam atuar sobre dados restaurados de produção.

Rotas acionadas manualmente continuam disponíveis. Portanto, esse modo não
substitui o cuidado com botões de publicação, endpoints de envio ou callbacks
reais.

### `DRY_RUN_MODE=true`

Simula as execuções de agentes cobertas pelo gateway de IA. Integrações externas
que não consultam esse flag podem continuar reais.

### `pnpm run dev:local:meta-test`

Além das proteções anteriores, ativa `META_E2E_TEST_MODE=true`. As chamadas de
saída feitas pelo transporte Meta são armazenadas em memória e não chegam à
Graph API. Esse é o modo indicado para testar Manage Messages e Manage Comments
com payloads locais.

## 5. Banco restaurado

O backup contém dados e tokens de integrações originalmente usados no Replit.
No ambiente local:

- mantenha `LOCAL_SAFE_MODE=true`;
- mantenha `META_WEBHOOK_AUTO_SUBSCRIBE=false`;
- não inicie schedulers contra o banco restaurado;
- use contas de teste ao validar integrações externas;
- rotacione tokens e chaves antes de reutilizar produção.

## 6. Typecheck e testes

```powershell
pnpm run typecheck:libs
pnpm run typecheck
pnpm --filter @workspace/api-server run test:meta-webhook-routing
pnpm --filter @workspace/api-server run test:meta-app-review
pnpm --filter @workspace/api-server run test:meta-e2e-harness
```

Se o pnpm tentar reinstalar módulos em um terminal não interativo, execute o
comando em um terminal PowerShell normal ou defina `CI=true` somente para essa
execução consciente.

## 7. Problemas conhecidos do ambiente atual

- Redis 5.x gera aviso do BullMQ; atualizar para 6.2+ é recomendado.
- O ngrok instalado exige um authtoken antes de abrir túneis.
- `localhost` não pode receber callbacks dos servidores da Meta.
- O domínio de produção não deve ser redirecionado para o ambiente local.
- O banco restaurado pode conter integrações reais; mantenha as proteções locais.

Para callbacks Meta externos, continue em
[Webhooks Meta no ambiente local](META_WEBHOOK_LOCAL_DEV.md).
