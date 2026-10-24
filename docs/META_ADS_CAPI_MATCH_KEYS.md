# Identificadores adicionais no CAPI legado

Com `marketingConsent: true`, o endpoint genérico de eventos aceita `externalId`, `firstName`, `lastName`, `city`, `state`, `postalCode` e `country`, além de e-mail, telefone, `fbp` e `fbc`.

## Normalização e envio

- A Meta recebe email, telefone, nomes, `external_id`, cidade, estado, CEP e país normalizados e com SHA-256. IP, user agent, `fbp` e `fbc` são enviados sem hash nos campos próprios do protocolo.
- O transporte TikTok recebe email, telefone, `external_id`, nome e sobrenome com SHA-256, além de IP, user agent e `ttclid` nos campos próprios. Campos de localização não são enviados ao TikTok por este adaptador.
- A consulta local, logs e respostas HTTP não retornam os valores destes campos.
- Consentimento negado bloqueia o dispatch e rejeita payload que inclua dados de usuário/evento.

Esses campos aumentam a cobertura de dados encaminhada pelo NexOS, mas não indicam correspondência bem-sucedida, pontuação EMQ ou elegibilidade no provedor. A evidência de envio continua sendo independente da verificação no Events Manager.

## Validação

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm --filter @workspace/api-server test:server-events-consent
pnpm --filter @workspace/api-server test:server-events-payload
pnpm --filter @workspace/api-server typecheck
```

## Referências primárias

[SDK oficial Meta para Node.js](https://github.com/facebook/facebook-nodejs-business-sdk) documenta a integração CAPI server-side. [SDK oficial Meta para Python: parâmetros de dados do usuário](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/user_data.py) lista os campos de correspondência. [Documentação de eventos TikTok for Business](https://business-api.tiktok.com/portal/docs/verify-events-setup/v1.3) fornece o formato do payload de eventos do servidor.
