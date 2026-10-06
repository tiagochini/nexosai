# Correções dos jobs Quality — 06/10/2026

Os logs remotos mostraram duas falhas independentes:

- `test:operational-health` importava o builder puro pela rota HTTP, carregando
  banco e workers sem `DATABASE_URL`. O builder foi extraído para
  `modules/operations/operational-health.ts`; a rota mantém os mesmos exports
  e comportamento. O teste importa o módulo puro e o CI remove explicitamente
  `DATABASE_URL`/`REDIS_URL` ao executá-lo.
- A chave fixa de criptografia do job de banco decodificava para 35 bytes,
  embora o serviço exija 32. O teste de criptografia anterior gerava sua própria
  chave e não detectava o erro do ambiente. O workflow agora gera 32 bytes
  aleatórios, mascara a chave e a exporta por `GITHUB_ENV` antes dos testes.
  A validação de criptografia da aplicação continua estrita.

Verificação local concluída:

- Reproduzida a falha de importação; teste de saúde passou após a correção com
  ambas as variáveis ausentes, incluindo estado degradado e exclusão concorrente
  de ticks de scheduler.
- Executado o gerador real do CI e validada sua configuração pelo serviço de
  criptografia, sem imprimir a chave.
- Bootstrap/seed/verificação e `test:content-checkpoint-resume` passaram em
  PostgreSQL/Redis descartáveis próprios. Verificação final: 177 tabelas, 74
  entradas de schema e zero usuários/workspaces/campanhas de teste residuais.
- Tipos/build da API, parsing YAML, scanner de segredos e guard de logging passaram.

Os containers e volumes de teste foram removidos. Nenhum banco da aplicação,
provedor ou credencial real foi utilizado. O commit é local, sem push;
o próximo checkpoint é reexecutar os jobs remotos com esta revisão.
