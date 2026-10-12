# Claude — autenticação corrigida

Validado em 12/10/2026. A variável ANTHROPIC_API_KEY estava ausente do perfil
local: a atualização anterior só substituía uma linha existente, sem inseri-la.
Os resultados 401 anteriores foram obtidos sem a credencial fornecida e NÃO
comprovam rejeição dessas chaves. Correção explícita no perfil ignorado pelo Git.

POST /v1/messages com claude-opus-4-5 retornou HTTP 200 com e sem cabeçalho
anthropic-workspace-id. Uma geração
curta adicional com modelo Haiku disponível retornou 200, com uso registrado
na resposta do provedor. Nenhum conteúdo de campanha foi alterado. Isso prova
autenticação e geração no provedor; a jornada completa do briefing e o
registro de consumo pelo gateway continuam no próximo checkpoint.

Helpers de validação agora rejeitam credencial ausente antes de fazer requisições.
Chave mantida exclusivamente no perfil local, nunca no Git.

[Evidência corrigida](./CLAUDE_KEY_VALIDATION_RESULTS.json).
[Diagnóstico](./CLAUDE_AUTH_DIAGNOSTIC_RESULTS.json).
Sem push.
