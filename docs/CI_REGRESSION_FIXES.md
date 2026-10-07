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

## P3: TypeScript ausente no runner e diagnóstico vazio — 07/10/2026

A falha em `scripts/test-p3-local.mjs` na chamada do teste de armazenamento
privado ocorria depois de construir a imagem: o job P3 não instalava dependências
no host, mas esse teste importa `typescript`. Reproduzido em Linux/Node 24.21.0:
`ERR_MODULE_NOT_FOUND: Cannot find package typescript`. As dependências dentro da
imagem não estão disponíveis para o processo Node do runner.

O job agora configura pnpm 11.19.0, cache e instalação com lockfile congelado
antes de executar o P3. O script captura stdout e stderr, preservando a redação
dos segredos das fixtures; a saída TAP do Node deixa de desaparecer nos erros.

Validação: três testes de armazenamento privado e avaliação de qualidade passaram
em container Linux sem rede, com checkout e TypeScript montados em leitura.
Uma falha controlada de processo comprovou que stdout chega ao diagnóstico e
que o segredo opaco da fixture é removido. Scanner de segredos/diff passaram.
Nenhum acesso ao Supabase. A suíte Docker completa e o job remoto não foram
reexecutados neste checkpoint; liberação do CI depende de executar o novo commit.
