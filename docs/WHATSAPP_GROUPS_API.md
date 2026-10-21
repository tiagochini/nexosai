# WhatsApp Groups API no NexOS

O NexOS usa a conexão WhatsApp Business Cloud API do workspace para criar grupos oficiais vinculados a uma campanha. A identidade do número conectado permanece por workspace; o número do NexOS não substitui o número do cliente.

## Fluxo disponível

1. O workspace conecta seu número WhatsApp Business.
2. A tela de grupos consulta `GET /{phone-number-id}/groups` para verificar se a Groups API responde para aquele número. Essa consulta não garante permissão de criação.
3. Ao clicar em **Criar grupo da campanha via Meta**, o servidor valida que a campanha pertence ao workspace e solicita `POST /{phone-number-id}/groups`.
4. O grupo, ID, link de convite, conexão proprietária e estado de ciclo de vida são vinculados à campanha.
5. Envios por API aceitam apenas grupos criados pela Groups API, ativos e pertencentes à mesma conexão. Grupos informados manualmente ficam apenas cadastrados no NexOS.

Participantes entram pelo link de convite e precisam aceitar. A API não converte um grupo criado no aplicativo WhatsApp em um grupo gerenciável pela API. A documentação da Meta descreve os limites e endpoints da [WhatsApp Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups).

## Requisitos externos para homologação real

- A conta WhatsApp Business, o número e o app Meta precisam ter acesso à Groups API aprovado e as permissões exigidas pela Meta. Uma conexão Cloud API comum, ou uma resposta bem-sucedida à consulta de leitura, não prova que a criação será permitida.
- No painel de Webhooks do app Meta, habilitar e encaminhar os campos de ciclo de vida e eventos de grupo suportados pela Groups API para `/api/whatsapp/webhook`. O endpoint já valida a assinatura Meta e atualiza o estado de grupos associados à conexão.
- Testar criação com um grupo descartável, compartilhar o link com participantes de teste que consentiram e verificar a atualização de estado recebida pelo webhook. Somente depois validar envio em grupo.
- Respostas automáticas da IA permanecem desativadas para mensagens recebidas em grupos; o agente existente responde apenas em conversas individuais.

## Testes locais

`pnpm --filter @workspace/api-server run test:whatsapp-groups` cobre consulta, payload de criação, isolamento de workspace, bloqueio de grupos cadastrados manualmente e atualização de ciclo de vida. O transporte da Meta fica simulado em memória; nenhum grupo ou mensagem é criado externamente. Esse teste requer `DATABASE_URL` de um banco de teste descartável.

O NexOS não cria grupos de WhatsApp comuns, não adiciona participantes automaticamente a grupos existentes e não promete que todo número conectado será elegível. Se a Meta recusar a operação, o usuário ainda pode guardar o link de um grupo próprio para organização, sem envio ou gerenciamento via API.
