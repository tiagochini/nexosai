# Meta webhooks em desenvolvimento local

O painel Meta não consegue entregar callbacks diretamente para `localhost`.
Para manter produção ativa, use um App Meta de desenvolvimento separado e um
túnel HTTPS apontado apenas para o gateway restrito de webhooks.

## Serviços locais

Aplicação normal, com chamadas reais aos provedores quando acionadas:

```powershell
pnpm run dev:local
```

Aplicação segura para testes, com chamadas de saída da Graph API simuladas:

```powershell
pnpm run dev:local:meta-test
```

Em outro terminal, inicie o gateway. Ele expõe somente as duas rotas Meta e
responde `404` para todo o restante da aplicação:

```powershell
pnpm run dev:meta-gateway
```

## Túnel HTTPS

O ngrok está instalado, mas exige uma conta e um authtoken local. Cadastre o
token no perfil do ngrok, nunca em arquivos de ambiente do projeto ou no Git:

```powershell
ngrok config add-authtoken SEU_TOKEN
ngrok http 8090
```

Copie a URL HTTPS exibida e configure em `.env.local`:

```dotenv
META_WEBHOOK_PUBLIC_BASE_URL=https://SEU-ENDERECO.ngrok-free.app
```

Callbacks aceitos:

```text
https://SEU-ENDERECO.ngrok-free.app/api/social/webhooks/meta
https://SEU-ENDERECO.ngrok-free.app/api/social-moderation/webhooks/meta
```

As duas URLs executam o mesmo processador de mensagens e comentários. A
idempotência persistida impede que uma entrega duplicada gere duas respostas.

## Assinatura da conta no App Meta

`META_WEBHOOK_AUTO_SUBSCRIBE` permanece `false` por padrão. Isso evita que uma
cópia local do banco de produção altere todas as contas reais durante o boot.

Após conectar uma conta de teste, a assinatura pode ser feita explicitamente,
com uma sessão autenticada do proprietário do workspace:

```text
POST /api/integrations/oauth/meta-webhook-subscriptions/:integrationId
```

Para um banco exclusivamente de desenvolvimento, é possível ativar a assinatura
no final de cada OAuth:

```dotenv
META_WEBHOOK_AUTO_SUBSCRIBE=true
```

Não altere o callback do App Meta de produção para o túnel local. Isso desviaria
as entregas reais e faria produção deixar de recebê-las. Use um App Meta de
desenvolvimento ou troque o callback apenas durante uma janela controlada.
