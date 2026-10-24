# Consentimento e `event_id` nos eventos de servidor

As rotas genéricas `POST /api/events/:workspaceId/track` e `POST /api/events/sequence/:sequenceId/track` agora exigem `marketingConsent` e `eventId` explícitos.

- Com `marketingConsent: false` e sem dados do usuário/evento, a API responde `202` com `tracked: false` e não agenda o envio ao provedor.
- Com consentimento falso, o corpo não pode incluir dados de usuário nem dados do evento.
- Com consentimento verdadeiro, `eventId` é validado e encaminhado aos transportes Meta e TikTok. O site deve reutilizar o mesmo identificador para as cópias browser/server da mesma conversão; IDs diferentes impedem a deduplicação por identidade de evento.
- O `eventId` deve ser opaco e estável para a conversão, sem conter e-mail, telefone ou outro dado pessoal.

O retorno `tracked: true` indica que o envio assíncrono foi agendado. Não confirma recebimento, correspondência, deduplicação ou atribuição no Events Manager. O caminho legado não grava recibos no pipeline CAPI local e esta mudança não adiciona fila, retry nem evidência do provedor. Use o fluxo de landing page publicado e sua chave de evento quando disponível; ele valida origem e escopo da página.

Consentimento recebido como campo do cliente é uma declaração do chamador, não uma verificação de registro legal. O produto que coleta o consentimento continua responsável por obtê-lo e respeitar sua revogação antes de enviar dados.

## Validação

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm --filter @workspace/api-server test:server-events-consent
pnpm --filter @workspace/api-server typecheck
```
