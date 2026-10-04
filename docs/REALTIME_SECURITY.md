# Segurança das campanhas em tempo real

English: [REALTIME_SECURITY.en.md](./REALTIME_SECURITY.en.md)

## Falha corrigida

Antes, qualquer usuário autenticado podia solicitar `join:campaign` com um ID de
outro workspace. Eventos de campanha podiam chegar a essa conexão indevida.

Agora a entrada exige uma campanha do workspace do token, com proprietário
correspondente ao usuário autenticado e workspace ativo. A consulta aplica esses
critérios no banco. IDs inexistentes e de outros workspaces recebem a mesma
resposta `CAMPAIGN_NOT_FOUND`; entradas malformadas são rejeitadas antes da consulta.
Falhas de autorização não permitem a entrada e respondem `REALTIME_UNAVAILABLE`,
sem registrar tokens ou detalhes de consultas.

A conexão também valida o proprietário/status do workspace e a expiração do
JWT. Ao expirar, o socket é desconectado. Origem do navegador deve estar na
lista `ALLOWED_ORIGINS`; fora de produção também é aceito o origin de `APP_URL`.
`allowRequest` verifica o upgrade WebSocket, além de CORS para polling. Clientes
sem Origin continuam permitidos, mas exigem autenticação e autorização.

Cada conexão tem no máximo 50 assinaturas de campanhas, incluindo consultas
pendentes. Sair durante uma consulta cancela a entrada. O frontend remove a sala
quando o último consumidor sai, substitui a conexão ao trocar/renovar o token e
encerra a conexão no logout.

## Testes

```powershell
# Com DATABASE_URL, SESSION_SECRET e APP_URL configurados no ambiente:
pnpm --filter @workspace/api-server run test:realtime-security-db
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/app run typecheck
pnpm --filter @workspace/api-server run build
pnpm run security:audit-dependencies
pnpm run security:scan
```

O teste usa duas contas/workspaces e campanhas temporárias no PostgreSQL. Testa
WebSocket e polling: entrega autorizada, ausência de eventos para outro usuário,
IDs malformados, inexistentes e estrangeiros, saída com consulta pendente,
origem não confiável, credenciais inválidas, workspace de outro proprietário,
JWT expirado, desconexão por expiração, workspace suspenso, falha simulada da
consulta e recuperação. As fixtures são removidas ao final. O CI executa esse
teste com PostgreSQL descartável.

## Limites e operação

Esta etapa não certifica carga, Redis, entrega durável de eventos nem revogação
instantânea de todas as conexões já abertas quando uma conta é suspensa. Status
e proprietário são revalidados na conexão e na entrada da sala; a conexão
existente termina no logout do frontend ou na expiração do JWT. Um access token
copiado continua sujeito à sua validade, como na API HTTP. Revogação central de
access tokens permanece uma evolução separada.

Não há migração de banco. Para rollback, restaurar código/manifests/lockfile
juntos e refazer o build; isso reabre a falha e não é indicado em produção.

O build completo, auditoria e testes de segurança da correção anterior de
dependências passaram no [CI](https://github.com/tiagochini/nexosai/actions/runs/37159141875).
