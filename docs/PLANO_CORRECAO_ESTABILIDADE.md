# Plano de correção de estabilidade e segurança — NexOS AI

## 1. Objetivo

Este documento descreve as correções recomendadas para reduzir o risco de:

- indisponibilidade da API ou dos aplicativos web;
- falhas de instalação e implantação;
- perda ou alteração indevida de dados;
- cadastros incompletos;
- execução de processos em estado inconsistente;
- exposição de credenciais, dados pessoais e integrações externas;
- regressões que não são detectadas pelo pipeline de validação.

O plano foi organizado por prioridade e deve ser executado em etapas pequenas,
com backup, revisão e evidências de validação antes da publicação em produção.

### Progresso iniciado em 02/10/2026

- Implementado bloqueio contra baseline falso em banco vazio.
- Baseline de banco legado agora exige flag explícita e tabelas canônicas.
- Removidas do boot as correções destrutivas e específicas de clientes.
- Cadastro de usuário e workspace colocado em uma única transação.
- Adicionada conversão de conflito concorrente de e-mail para HTTP 409.
- Corrigido desligamento de paid media, Academy, filas e PostgreSQL.
- Exceções não capturadas agora iniciam desligamento controlado.
- CORS de produção passou a exigir allowlist explícita.
- Removido o digest fixo de um token antigo do webhook Meta.
- Configurações Vite passaram a aceitar build sem `PORT` e `BASE_PATH` manuais.
- Typecheck do pacote `scripts` corrigido.
- Comandos com variáveis de ambiente convertidos para execução multiplataforma.
- Todos os projetos passaram no typecheck e todos os builds foram gerados.
- `.env.exemple` removido do estado versionado; launcher usa `.env` ignorado.
- `backup.sql` preservado localmente como `backup.local.sql` e retirado do estado
  versionado, com hash SHA-256 conferido após a movimentação.
- Adicionados endpoints separados `/api/livez` e `/api/readyz`.
- Inicialização de filas Redis ignorada em `LOCAL_SAFE_MODE` e erros esperados do
  probe Redis deixaram de gerar eventos não tratados no `stderr`.
- Launcher de Python multiplataforma adicionado; self-test do worker corrigido e
  aprovado mesmo em máquina sem FFmpeg.
- Criado bootstrap transacional do schema atual para PostgreSQL vazio, com
  checksum do snapshot e baseline das 67 migrations incrementais.
- Banco local vazio inicializado com 171 relações e verificado com 68 entradas
  de schema rastreadas (snapshot + migrations).
- Planos `solo` e `agency` inicializados por seed idempotente.
- Teste concorrente de cadastro criado; corrigido o reconhecimento de violação
  única encapsulada pelo Drizzle, evitando HTTP 500 em cadastro duplicado.
- Páginas, layout autenticado e módulos pesados passaram a usar carregamento por
  rota; o JavaScript inicial caiu de aproximadamente 4,9 MB para 392,4 KiB
  (119,7 KiB gzip), com orçamento de 500 KiB validado durante o build.
- Integração local com Redis validada em `6379`: Redis, filas e readiness ficaram
  saudáveis, mantendo o modo degradado seguro quando Redis estiver indisponível.
- Scanner de segredos sem dependências configurado no CI e validado nos arquivos
  versionáveis; um anexo com credenciais foi removido do Git atual e preservado
  apenas em cópia local ignorada para apoiar a rotação.
- Rollback do bootstrap validado em banco temporário: após aplicar as 170 tabelas
  e forçar falha transacional, nenhuma relação ou enum permaneceu.
- Auditoria segura do histórico configurada e executada: três caminhos sensíveis
  permanecem alcançáveis em cinco ocorrências de commits. O runbook de rotação,
  reescrita, validação, publicação coordenada e rollback foi documentado.
- CI de qualidade configurado para instalar com lockfile imutável e executar o
  typecheck e todos os builds em clone Linux limpo.

Ainda dependem de ação operacional: rotação das credenciais, remoção dos segredos
do histórico Git e validações em ambiente de homologação com PostgreSQL e Redis
descartáveis.

## 2. Regras para executar o plano

1. Não executar `drizzle-kit push`, migrations ou scripts de limpeza diretamente
   no banco de produção sem backup e comparação prévia do schema.
2. Não copiar valores de `.env`, `.env.local` ou backups SQL para logs,
   issues, commits ou relatórios.
3. Criar uma branch específica para cada etapa relevante.
4. Exigir revisão de código para alterações de banco, autenticação, webhooks e
   inicialização do servidor.
5. Validar primeiro em um banco descartável e em ambiente de homologação.
6. Manter um procedimento de rollback documentado para cada implantação.

## 3. Ordem recomendada

| Ordem | Prioridade | Correção | Risco mitigado |
| --- | --- | --- | --- |
| 1 | P0 | Remover e rotacionar credenciais versionadas | Invasão, custos e indisponibilidade |
| 2 | P0 | Corrigir inicialização de banco vazio | Instalação sem schema |
| 3 | P0 | Retirar alterações de dados do boot da API | Corrupção silenciosa de dados |
| 4 | P1 | Restaurar build, typecheck e testes confiáveis | Regressões em produção |
| 5 | P1 | Tornar o cadastro transacional | Usuários órfãos e cadastro bloqueado |
| 6 | P1 | Corrigir exceções e desligamento gracioso | Processo inconsistente e deploy instável |
| 7 | P1 | Endurecer CORS, webhooks e configuração de produção | Acesso indevido e abuso da API |
| 8 | P2 | Separar probes de vida e prontidão | Tráfego enviado a instância degradada |
| 9 | P2 | Reduzir o bundle do frontend | Lentidão e falhas em redes móveis |

---

## 4. Etapa 1 — Credenciais e dados versionados

### Problema

O arquivo `.env.exemple` estava versionado com diversos valores sensíveis
preenchidos e foi removido do estado atual. O arquivo `backup.sql`, que continha
dados de banco, também foi retirado do estado atual e preservado localmente sob
um nome ignorado. Ambos ainda precisam ser removidos do histórico Git.
incluindo referências a usuários e tokens.

Remover apenas os arquivos do commit atual não é suficiente: os valores
continuam disponíveis no histórico do Git e devem ser considerados comprometidos.

### Passos de correção

1. Inventariar, sem exibir os valores, todas as credenciais presentes em:
   - `.env.exemple`;
   - `backup.sql`;
   - commits anteriores;
   - arquivos de configuração e documentação.
2. Rotacionar primeiro as credenciais nos respectivos provedores:
   - chaves de IA;
   - Meta e Instagram;
   - TikTok;
   - Asaas;
   - Resend e e-mail;
   - Redis;
   - ElevenLabs;
   - secrets de sessão, JWT e webhooks.
3. Invalidar tokens antigos e verificar uso suspeito, cobranças e acessos recentes.
4. Substituir `.env.exemple` por um arquivo sem valores reais ou consolidá-lo no
   `.env.example` existente.
5. Adicionar ao `.gitignore`:

   ```gitignore
   /.env.exemple
   /backup.sql
   *.sql.gz
   *.dump
   ```

6. Remover os arquivos do índice do Git sem apagar a cópia local antes de
   preservar o que for necessário em armazenamento seguro.
7. Reescrever o histórico com `git filter-repo` em uma operação coordenada.
8. Invalidar clones antigos e orientar a equipe a clonar novamente após a
   reescrita do histórico.
9. Armazenar backups criptografados fora do repositório, com acesso restrito e
   política de retenção.
10. Adicionar secret scanning ao CI e bloquear commits que contenham segredos.

### Validação

- A busca de segredos no repositório e no histórico não encontra valores ativos.
- Todas as credenciais antigas foram revogadas.
- O sistema inicia usando apenas secrets fornecidos pelo ambiente.
- Nenhum valor secreto aparece nos logs de build ou de inicialização.

### Critério de aceite

Nenhuma credencial ativa ou backup com dados reais permanece no Git atual ou em
seu histórico acessível.

---

## 5. Etapa 2 — Migrations em banco vazio

### Problema

`lib/db/scripts/apply-migrations.mjs` trata uma tabela de controle vazia como se
o banco já possuísse todo o schema. Nesse caso, registra as migrations como
baseline sem executar seus comandos SQL. Em um PostgreSQL realmente vazio, a
instalação termina sem criar as tabelas da aplicação.

### Implementação recomendada

1. Separar explicitamente os dois cenários:
   - **banco vazio:** executar um bootstrap completo do schema base e, depois,
     as migrations incrementais;
   - **banco legado já estruturado:** registrar um baseline somente mediante
     confirmação explícita.
2. Não executar diretamente as migrations atuais em um banco vazio: a migration
   `0000` já pressupõe tabelas legadas como `workspaces` e `video_projects`.
3. Usar o snapshot versionado `bootstrap/0000_current_schema.sql` somente por
   meio do executor transacional, que recusa schemas públicos não vazios.
4. Introduzir uma flag administrativa, por exemplo:

   ```dotenv
   MIGRATION_BASELINE_EXISTING_SCHEMA=false
   ```

5. Antes de aceitar o baseline, consultar a existência de um conjunto mínimo de
   tabelas canônicas, como `users`, `workspaces`, `campaigns` e `plans`.
6. Recusar o baseline quando essas tabelas não existirem.
7. Registrar no log apenas:
   - nome da migration;
   - checksum;
   - horário;
   - resultado;
   - se foi execução ou baseline.
8. Manter uma transação por migration e o advisory lock já existente.
9. Garantir que uma migration já aplicada e posteriormente alterada continue
   causando falha por divergência de checksum.

### Testes obrigatórios

Criar testes automatizados para:

1. PostgreSQL totalmente vazio: todas as migrations devem ser executadas.
2. Banco legado com schema existente e flag de baseline: apenas o baseline deve
   ser registrado.
3. Banco vazio com flag de baseline: operação deve ser recusada.
4. Migration parcialmente aplicada: a transação deve sofrer rollback.
5. Migration já registrada com checksum diferente: operação deve falhar.
6. Duas instâncias concorrentes: somente uma deve aplicar as migrations.

### Critério de aceite

Um banco descartável vazio recebe o bootstrap completo e todas as migrations,
permitindo iniciar a API sem `drizzle-kit push`. Enquanto o bootstrap completo
estiver pendente, o critério provisório é que um banco vazio seja recusado sem
registrar um baseline incorreto.

---

## 6. Etapa 3 — Remover mutações de dados da inicialização

### Problema

`artifacts/api-server/src/index.ts` contém atualizações permanentes de dados
executadas durante o boot. Entre elas há filtros amplos por texto e uma correção
direcionada a uma workspace específica.

Reiniciar ou escalar a API não deve funcionar como uma migration de dados.

### Passos de correção

1. Classificar cada bloco atual de recuperação em uma das categorias:
   - recuperação operacional recorrente;
   - migration permanente de dados;
   - correção administrativa de um cliente;
   - código obsoleto que deve ser removido.
2. Manter no boot apenas recuperações operacionais seguras, limitadas por estado,
   idade, ownership e idempotência comprovada.
3. Mover correções permanentes para migrations versionadas.
4. Mover correções específicas de cliente para comandos administrativos que
   exijam parâmetros explícitos, confirmação, auditoria e dry-run.
5. Eliminar filtros amplos como `ILIKE '%nexos%'` para exclusão ou limpeza de
   conteúdo. Quando indispensável, selecionar previamente os IDs e produzir um
   relatório revisável.
6. Executar toda alteração destrutiva dentro de transação.
7. Criar modo `--dry-run` que mostre somente quantidade e IDs afetados.
8. Remover IDs de workspace, avatar, voz ou integração fixos do código da API.

### Validação

- Reiniciar a API duas vezes não altera dados funcionais.
- Subir duas instâncias simultaneamente não duplica nem conflita recuperações.
- Toda correção específica possui comando, log de auditoria e rollback.
- O boot não depende de registros pertencentes a um cliente específico.

### Critério de aceite

Inicializar, reiniciar ou escalar horizontalmente a API não modifica conteúdo de
clientes fora de recuperações operacionais formalmente definidas.

---

## 7. Etapa 4 — Build, TypeScript e testes

### Problemas encontrados

- O comando oficial `pnpm run typecheck` não conclui de forma confiável.
- O pacote `scripts` apresenta erros de TypeScript.
- Existem imports com caminhos relativos incorretos.
- Alguns arquivos com `await` no topo não são reconhecidos como módulos.
- Há scripts com sintaxe de variáveis de ambiente específica de Linux.
- Os arquivos `vite.config.ts` exigem `PORT` e `BASE_PATH` até durante o build.

### Passos de correção

1. Corrigir `scripts/tsconfig.json`:
   - decidir se scripts podem importar código-fonte da API;
   - se puderem, remover a restrição incompatível de `rootDir` ou criar um
     pacote compartilhado para a lógica testada;
   - evitar compilar acidentalmente toda a API como parte do pacote de scripts.
2. Adicionar `export {}` aos scripts que usam top-level `await` e não possuem
   import/export, ou envolvê-los em uma função `main()`.
3. Corrigir caminhos que partem de `scripts/src`; referências a `artifacts`
   precisam subir dois níveis, ou usar aliases/pacotes do workspace.
4. Atualizar testes que ainda chamam funções com assinaturas antigas.
5. Substituir comandos como:

   ```text
   NODE_ENV=test tsx arquivo.ts
   export NODE_ENV=development && comando
   ```

   por uma solução multiplataforma, como `cross-env`, ou por launchers Node.
6. Alterar as configurações Vite para fornecer padrões seguros durante o build:

   ```ts
   const port = Number(process.env.PORT ?? "8081");
   const basePath = process.env.BASE_PATH ?? "/";
   ```

7. Manter a validação de porta para `dev` e `preview`, sem impedir a geração de
   assets estáticos.
8. Impedir reinstalação implícita de dependências durante `typecheck` no CI.
9. Fixar a versão de Node e pnpm usada localmente e no CI.

### Pipeline mínimo de CI

O pipeline deve executar, nesta ordem:

```text
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
testes unitários sem banco
testes de integração com PostgreSQL e Redis descartáveis
teste de migrations em banco vazio
smoke test de inicialização e /api/healthz
```

### Critério de aceite

Todos os comandos acima passam em Windows e Linux, em ambiente limpo, sem
variáveis secretas reais e sem intervenção manual.

---

## 8. Etapa 5 — Cadastro transacional

### Problema

O fluxo de cadastro cria o usuário e depois cria a workspace em operações
separadas. Se a criação da workspace falhar, o usuário permanece salvo e o e-mail
fica impedido de tentar novamente.

### Implementação recomendada

1. Envolver em uma única transação:
   - validação final do plano;
   - inserção do usuário;
   - inserção da workspace;
   - criação dos registros essenciais de onboarding.
2. Manter ações externas, e-mail e bônus de indicação fora da transação.
3. Criar uma chave idempotente para processamento do bônus de indicação.
4. Garantir unicidade do código de indicação no banco e tratar colisões com nova
   geração.
5. Converter violações de unicidade de e-mail em resposta de conflito previsível.
6. Não emitir tokens antes do commit da transação.

### Testes obrigatórios

1. Falha ao inserir workspace: nenhum usuário deve permanecer no banco.
2. Falha ao inserir usuário: nenhuma workspace deve ser criada.
3. Duas requisições simultâneas com o mesmo e-mail: somente uma deve vencer.
4. Falha no bônus de indicação: cadastro deve continuar válido e o bônus deve
   poder ser reconciliado depois.

### Critério de aceite

Não existe usuário ativo sem workspace válida como consequência de uma falha de
cadastro.

---

## 9. Etapa 6 — Exceções e desligamento gracioso

### Problemas encontrados

- Algumas exceções não capturadas relacionadas ao Redis são ignoradas.
- Mensagens de erro do Redis são ocultadas no `stderr` em desenvolvimento.
- Nem todos os schedulers iniciados possuem parada correspondente.
- O scheduler da Academy não mantém o identificador de seu intervalo.
- O pool do PostgreSQL deve ser encerrado explicitamente no shutdown.

### Passos de correção

1. Tratar falhas esperadas de Redis nos limites de conexão, fila e worker.
2. Não continuar o processo depois de `uncaughtException`.
3. Em `unhandledRejection`, registrar a causa e iniciar desligamento controlado.
4. Remover a substituição global de `process.stderr.write`; usar filtros do logger
   apenas para mensagens conhecidas e sem ocultar erros inesperados.
5. Implementar `stopFunnelScheduler()` com `clearInterval`.
6. Chamar `stopPaidMediaScheduler()` no shutdown.
7. Revisar todos os `setInterval` para garantir:
   - referência armazenada;
   - proteção contra inicialização duplicada;
   - função de parada;
   - `unref()` quando apropriado.
8. Ordem sugerida de shutdown:
   - marcar a instância como não pronta;
   - parar de aceitar novas conexões HTTP;
   - parar schedulers;
   - pausar e encerrar workers;
   - aguardar trabalhos em andamento por um prazo limitado;
   - fechar filas, Redis e PostgreSQL;
   - encerrar o processo.
9. Se o prazo expirar, registrar quais componentes não encerraram antes do exit
   forçado.

### Testes obrigatórios

- Enviar `SIGTERM` durante uma requisição comum.
- Enviar `SIGTERM` durante processamento de fila.
- Simular Redis indisponível no boot e durante operação.
- Reiniciar repetidamente e verificar ausência de intervalos duplicados.
- Confirmar que a porta é liberada e o processo termina dentro do prazo.

### Critério de aceite

Falhas não capturadas provocam reinício limpo, enquanto indisponibilidade
esperada do Redis usa o fallback previsto sem esconder erros nem deixar recursos
abertos.

---

## 10. Etapa 7 — Configuração e perímetro de segurança

### CORS

Em produção, ausência de `ALLOWED_ORIGINS` não deve liberar qualquer origem.

Implementar:

1. Falha de inicialização quando `NODE_ENV=production` e `ALLOWED_ORIGINS` estiver
   vazio.
2. Lista explícita de origens HTTPS permitidas.
3. Testes para origem permitida, origem negada e requisição sem `Origin`.
4. Avaliação separada para clientes server-to-server, que não devem depender de
   CORS como mecanismo de autenticação.

### Webhook Meta

O token de verificação deve vir apenas do secret ativo do ambiente. Um digest
fixo no código mantém compatibilidade permanente com um token antigo e dificulta
uma rotação completa.

Implementar:

1. Remover o digest fixo do token antigo.
2. Exigir `META_WEBHOOK_VERIFY_TOKEN` em produção quando o webhook estiver ativo.
3. Manter comparação em tempo constante.
4. Continuar validando `x-hub-signature-256` sobre os bytes brutos.
5. Criar procedimento documentado de rotação do token.

### Variáveis obrigatórias

Expandir a validação de produção para os recursos realmente habilitados. Por
exemplo, ativar publicação Meta sem os secrets Meta deve falhar na configuração
da funcionalidade, não somente na primeira requisição real.

### Critério de aceite

Uma implantação de produção com configuração incompleta falha cedo e apresenta
uma mensagem segura com apenas os nomes das variáveis ausentes.

---

## 11. Etapa 8 — Saúde, prontidão e observabilidade

### Implementação recomendada

Separar os endpoints:

- `/api/livez`: processo Node ativo, sem consultar dependências externas;
- `/api/readyz`: banco e dependências necessárias para receber tráfego;
- `/api/healthz`: visão operacional detalhada e sanitizada.

Definir por funcionalidade se Redis é realmente opcional. Se o fallback direto
não cobrir uma operação crítica, a ausência de Redis deve tornar a instância não
pronta para esse tipo de tráfego.

Adicionar métricas e alertas para:

- latência e erros do PostgreSQL;
- disponibilidade do Redis;
- filas aguardando, ativas e falhas;
- idade do job mais antigo;
- schedulers atrasados;
- quantidade de fallback direto;
- rejeições e exceções não tratadas;
- falhas de provedores externos;
- tempo e falhas de shutdown.

### Critério de aceite

O balanceador não envia tráfego a uma instância incapaz de atender, e a equipe
consegue distinguir processo vivo, instância pronta e serviço degradado.

---

## 12. Etapa 9 — Desempenho do frontend

### Problema

O bundle principal do aplicativo é muito grande e pode causar carregamento lento,
alto uso de memória e falhas em dispositivos móveis ou redes instáveis.

### Passos de correção

1. Medir o bundle com um visualizador de chunks.
2. Aplicar carregamento sob demanda nas rotas principais.
3. Carregar editores, gráficos, geração de PDF e módulos audiovisuais somente
   quando o usuário acessar essas áreas.
4. Separar dependências pesadas em chunks estáveis.
5. Remover imports globais de componentes usados em poucas telas.
6. Definir orçamento de bundle no CI.

### Metas iniciais sugeridas

- bundle inicial JavaScript compactado abaixo de 500 KB;
- nenhuma rota comum deve baixar módulos do editor de vídeo antecipadamente;
- registrar e acompanhar LCP, INP e erros de carregamento de chunks.

### Critério de aceite

As telas essenciais carregam em conexão móvel simulada sem baixar recursos de
áreas que ainda não foram acessadas.

---

## 13. Matriz de testes antes da produção

| Área | Cenário mínimo | Resultado esperado |
| --- | --- | --- |
| Build | Clone limpo em Windows e Linux | Build completo sem ajuste manual |
| Banco | PostgreSQL vazio | Schema completo criado pelo bootstrap e migrations registradas |
| Banco | Migration com falha | Rollback sem registro parcial |
| Cadastro | Falha na criação da workspace | Usuário também revertido |
| Redis | Redis fora do ar | Degradação conhecida ou readiness bloqueada |
| Shutdown | `SIGTERM` com jobs ativos | Encerramento controlado e auditável |
| Boot | Duas instâncias simultâneas | Sem mutação ou recuperação duplicada |
| CORS | Origem desconhecida | Resposta bloqueada em produção |
| Webhook | Assinatura inválida | HTTP 401 sem processamento |
| Webhook | Token antigo revogado | Verificação rejeitada |
| Saúde | Banco indisponível | Readiness retorna HTTP 503 |
| Frontend | Rota inicial em rede móvel | Sem download antecipado de módulos pesados |

## 14. Estratégia de implantação

1. Fazer backup verificado do banco e testar a restauração.
2. Publicar primeiro as correções que não alteram schema.
3. Publicar o novo executor de migrations e validá-lo em banco descartável.
4. Executar migrations em homologação.
5. Rodar smoke tests e testes de cadastro.
6. Implantar em uma única instância canário.
7. Observar saúde, filas, erros e latência.
8. Aumentar gradualmente o tráfego.
9. Manter a versão anterior disponível durante a janela de observação.
10. Somente depois remover códigos temporários e mecanismos antigos.

## 15. Checklist de conclusão

- [ ] Credenciais antigas revogadas e rotacionadas.
- [ ] Segredos e backups removidos do histórico Git (estado atual já limpo).
- [x] Secret scanning configurado no CI e no comando `security:scan`.
- [x] Bootstrap e migrations aprovados no banco inicialmente vazio.
- [x] Baseline legado protegido por flag e verificação de schema.
- [x] Mutações específicas removidas do boot.
- [x] Typecheck direto de todos os projetos passa.
- [x] Build direto de todos os projetos passa em ambiente limpo de `PORT` e `BASE_PATH`.
- [x] Scripts de ambiente convertidos para Windows e Linux.
- [x] Cadastro de usuário e workspace é transacional.
- [x] Cadastro concorrente rejeita e-mail duplicado sem deixar registros órfãos.
- [x] Exceções não capturadas provocam desligamento seguro.
- [x] Schedulers conhecidos e pool PostgreSQL encerram no shutdown.
- [x] CORS de produção usa allowlist obrigatória.
- [x] Webhook não aceita token antigo embutido no código.
- [x] Probes de vida e prontidão estão separados.
- [x] Smoke tests de integração com PostgreSQL e Redis passam.
- [x] Bundle inicial está dentro do orçamento definido e protegido no build.
- [x] Rollback transacional do bootstrap foi testado em banco temporário.

## 16. Resultado esperado

Ao concluir este plano, o projeto deve possuir um caminho reproduzível desde um
clone limpo até uma implantação funcional, com banco corretamente versionado,
inicialização sem alterações silenciosas de dados, cadastro atômico, desligamento
controlado e validações suficientes para impedir regressões críticas.
