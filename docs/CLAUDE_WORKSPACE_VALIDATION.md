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
