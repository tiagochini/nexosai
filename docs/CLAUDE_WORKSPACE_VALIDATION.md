# Claude — workspace de homologação

Em 12/10/2026, o ID fornecido foi configurado em ANTHROPIC_WORKSPACE_ID no
perfil local de homologação. O gateway inclui anthropic-workspace-id nos
clientes nativos, inclusive gerações e continuações. Proxies mantêm sua
configuração própria. Tipos do servidor passaram.

A consulta real GET https://api.anthropic.com/v1/models retornou HTTP 401,
authentication_error, invalid x-api-key. Nenhuma geração foi realizada.
O ID do workspace não foi validado pela API, pois a autenticação falhou.
A configuração nova depende de reinício do servidor para entrar no runtime.

Próximo checkpoint: configurar uma chave válida no perfil de homologação,
reiniciar o servidor e validar uma resposta real pelo gateway.
Não houve push.

Referência: https://platform.claude.com/docs/en/get-api-key

## Nova chave — 12/10/2026

A segunda chave enviada foi salva apenas no perfil local ignorado pelo Git.
Repetição de GET /v1/models com o workspace: x-api-key retornou 401
invalid x-api-key; Authorization Bearer retornou 401 Invalid bearer token.
Nenhuma geração executada. O resultado não confirma acesso ao workspace.
[Evidência da repetição](./CLAUDE_KEY_VALIDATION_RESULTS.json).
