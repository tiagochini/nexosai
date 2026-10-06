# Supabase para testes e homologação NexOS

Preparado e validado em 06/10/2026. Banco remoto Supabase, API/frontend executados
localmente e Redis exclusivo da homologação. Nenhuma implantação pública foi feita.

## Estado comprovado

- PostgreSQL 17.11 com CA oficial e hostname validados (`verify-full`).
- 177 tabelas, 75 entradas de esquema/migração, 19 triggers ativos. Verificador
  do projeto aprovou checksums, planos, triggers e chaves de escopo validadas.
- Role SQL privada `nexos_homologation`: sem superuser, bypass RLS, criação de
  banco/role, membros administrativos, DDL no public ou escrita no histórico de
  migrações/marcador. A conexão postgres administrativa fica restrita aos scripts de preparo/checagem.
- Supabase habilitou RLS nas 177 tabelas. As políticas do backend permitem a
  role SQL privada; `anon`, `authenticated`, `service_role` e PUBLIC tiveram
  privilégios revogados no public, inclusive defaults para futuros objetos.
  A chave publicada recebeu 401 ao tentar ler a tabela de usuários.
- Essas políticas **não representam RLS por tenant**: a role backend acessa os
  dados necessários à aplicação; ownership e escopo de usuário/workspace/projeto
  são exigidos pelas rotas e serviços do NexOS. Os testes remotos comprovaram
  rejeições de leitura/escrita entre usuários e projetos, além de FK de escopo e
  imutabilidade. A chave pública Supabase não é usada pelo frontend NexOS.
- Cadastro concorrente, sessão/cookie/CSRF/rotação/replay/logout, realtime,
  isolamento de memória/contexto, retomada de conteúdo e criptografia passaram.
  O controle que remove triggers/constraints permanece exclusivo dos bancos
  locais descartáveis; proteções remotas ficaram ativas durante os testes.
- Fixtures removidas. Restaram founder e seu workspace; nenhum projeto, memória,
  conteúdo ou integração de teste. Todas as sessões usadas foram revogadas.
- API compilada passou readiness/health com Supabase e Redis, login/administração
  UUID e logout/revogação. O smoke usou safe mode e encerrou sua API temporária;
  ele não certifica workers, navegador, entrega por provedor ou publicação pública.
- Tipos da API, build, guards de alvo/perfil/HTTP e scanner de segredos passaram.

## Perfil e comandos

`.env.homologation.local` contém as conexões/chaves privadas. É ignorado pelo Git
e não herda `.env`, `.env.local`, credenciais de provedores ou NODE_OPTIONS.
O modelo sem segredos está em [HOMOLOGATION_PROFILE.example](./HOMOLOGATION_PROFILE.example).
Senhas em URIs precisam de URL encoding. Preserve as chaves de sessão e de
criptografia deste perfil; não gere outras a cada reinício.

```powershell
pnpm homologation:verify     # esquema, integridade e privilégios
pnpm homologation:test       # seis grupos de testes com fixtures e limpeza
pnpm homologation:redis      # iniciar/revalidar Redis exclusivo, se necessário
pnpm homologation:smoke      # API compilada temporária; requer build API e Redis
pnpm dev:homologation        # compila/inicia API 8090 e frontend 8091
```

Aplicação: `http://localhost:8091`. API: `http://localhost:8090/api`.
O launcher local habitual continua `pnpm dev:local`, com seu banco/configuração
anteriores. Não execute ambos na mesma porta.

O Redis Docker do projeto `nexos-homologation` ficou ativo em
`127.0.0.1:6385`, com senha por arquivo privado, volume próprio, database lógica
5 e filas com prefixo específico do projeto. Autenticação inválida foi rejeitada.
Para parar sem apagar o volume:

```powershell
docker compose -p nexos-homologation -f scripts/compose.homologation.yml down
```

Para aplicar futuras migrações/atualizar privilégios e planos, use
`pnpm homologation:prepare`. O bootstrap só é executado se faltar o histórico;
recusa esquema existente desconhecido. O processo protege os defaults antes de
criar tabelas, mantém as políticas RLS e verifica o resultado. Não use push-force
ou os testes de bootstrap/DDL descartável neste banco persistente.

## Administrador de homologação

Conta `founder@nexos.ai`, plano Agency e política founder existente de créditos
ilimitados. UUID remoto: `94942b5f-23ea-47f4-b589-a37457db3b6c`; workspace
`a03c9141-c1af-46de-a62c-44a2e122646c`. O UUID remoto já está no allowlist Academy
do perfil de homologação; não foi copiado o UUID do banco local.

A senha inicial está em `.local/founder-homologation-credentials.json`, fora do
Git e distinta da senha local. Login, revogação e auditoria real foram verificados.
Não foi declarada verificação da propriedade do e-mail. O comando
`pnpm homologation:founder` recusa reset de conta existente sem credencial privada
e preserva o cadastro; cria somente se o banco estiver sem usuários.

## Evidência e próximo checkpoint

- [Preparo](./SUPABASE_HOMOLOGATION_PREPARE_RESULTS.json)
- [Regressão de banco](./SUPABASE_HOMOLOGATION_TEST_RESULTS.json)
- [Ativação founder](./SUPABASE_HOMOLOGATION_FOUNDER_ACTIVATION.json)
- [Redis](./SUPABASE_HOMOLOGATION_REDIS_RESULTS.json)
- [API HTTP compilada](./SUPABASE_HOMOLOGATION_HTTP_SMOKE.json)
- [Estado e acesso público](./SUPABASE_HOMOLOGATION_STATE.json)

Próximo checkpoint: jornada de navegador na homologação e provedores externos
sandbox autorizados. Asaas ainda exige chave sandbox válida e URL pública do
webhook da aplicação. Este preparo não conclui M11/M12 nem libera produção.
