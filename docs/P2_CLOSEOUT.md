# P2 — infraestrutura e recuperação local

Escopo autorizado em 06/10/2026: preparar e validar localmente. Os serviços
existentes do computador e os ambientes de produção não são alterados.
Resultados reproduzíveis: [P2_VALIDATION_RESULTS.json](./P2_VALIDATION_RESULTS.json).

## Redis persistente e monitorado

`ops/redis/compose.yml` usa Redis 7.4, volume nomeado, reinício automático,
autenticação por arquivo externo, porta publicada somente em loopback e limite
de RAM de 768 MiB. Redis limita os dados a 512 MiB com `noeviction`, evitando
expulsão silenciosa de filas e cotas. AOF usa `everysec`, acompanhado de snapshots.
O healthcheck verifica PING, AOF ativo, status de escrita/rewrite e snapshot.

A linha 7.4 consta como suportada na
[política de segurança do Redis](https://github.com/redis/redis/security/policy).
AOF a cada segundo admite perda do último segundo em falha de host; persistência
não substitui backup externo. Referência:
[persistência Redis](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).
O patch executado consta no JSON. Revalidar patches/digest antes de ativação real.

Para instalar esse serviço local persistente, criar um segredo alfanumérico
aleatório com pelo menos 32 caracteres em arquivo fora do Git, definir
`REDIS_PASSWORD_FILE` com seu caminho e `REDIS_PORT` com uma porta livre, e executar:

```powershell
docker compose -p nexos-local-redis -f ops/redis/compose.yml up -d --wait
docker compose -p nexos-local-redis -f ops/redis/compose.yml ps
```

Configurar `REDIS_URL` da API com a mesma credencial. Não imprimir a URL nem
salvar segredo em arquivos versionados. Para uso entre hosts, exigir rede
privada/TLS, política de firewall e secret manager do ambiente. `down` preserva
o volume; `down --volumes` remove dados e é exclusivo do ensaio descartável.

## Recuperação da API

O pool PostgreSQL limita aquisição de conexão a cinco segundos, configurável
por `DB_CONNECTION_TIMEOUT_MS` (100–60000 ms). Erros de conexões ociosas são
tratados pelo pool; o healthcheck continua observando o estado do banco.

`/livez` confirma processo vivo. `/readyz` exige banco e Redis disponíveis,
pois Redis sustenta cotas de segurança. `/healthz` informa degradação, backlog,
heartbeats e contadores do pool sem credenciais, payloads ou erros privados.
Sondas usam Redis fresco e timers de timeout são liberados.

Produtores BullMQ possuem timeout de comando e reconexão contínua. Workers
reconectam sem abandonar a conexão após três tentativas. Erro de escrita ou
timeout não autoriza duplicar trabalho: preservam-se os IDs estáveis e as
conciliações/claims existentes. O prefixo `QUEUE_PREFIX` isola as filas por
ambiente. Os testes exercitam um worker inerte com a mesma configuração de
conexão, sem ativar consumidores de campanha, IA ou envio real.

## Backup e restauração

O ensaio faz `pg_dump` custom do banco inteiro, incluindo schema/migrações,
índices, constraints e todas as linhas. Compara contagem e SHA-256 de cada
tabela após `pg_restore --exit-on-error` em banco novo; o verificador de schema
também deve passar. Integrações usam ciphertext real com chave de fixture.
Redis é copiado por RDB após SAVE e restaurado em volume novo; tipos, valores,
TTLs e jobs diferidos devem permanecer.

`scripts/backup-crypto.mjs` cifra/decifra arquivos por streaming com AES-256-GCM,
nonce aleatório, cabeçalho autenticado e detecção de chave errada/adulteração.
Não sobrescreve o destino. A saída decifrada só é publicada após autenticação;
arquivos parciais são removidos. A chave de backup deve ser um arquivo de 32
bytes separado das chaves de integração, dos arquivos cifrados e do Git.

```text
node scripts/backup-crypto.mjs encrypt entrada.dump backup.enc arquivo-externo-de-chave
node scripts/backup-crypto.mjs decrypt backup.enc restauracao.dump arquivo-externo-de-chave
```

No ensaio, arquivos plaintext temporários e segredo Redis são removidos.
A chave de backup é efêmera; os arquivos cifrados de fixture são apenas evidência
do teste, não um backup recuperável do ambiente atual.

Procedimento para ativação futura: manter PostgreSQL, Redis e mídia no mesmo
checkpoint de aplicação (pausar escritores/consumidores); produzir dump e RDB;
cifrar; registrar checksum, versão, snapshot dos objetos de mídia e identificador
da versão das chaves; enviar para armazenamento externo; confirmar integridade.
Restaurar primeiro em serviços vazios isolados, com envio/IA/schedulers desativados;
recuperar chaves pelo secret manager; verificar schema, acesso, saldo, cotas e
outbox; reconciliar resultados ambíguos antes de liberar consumidores.

A política inicial para homologação é backup diário e antes de migrações,
retenção de sete diários/quatro semanais e ensaio mensal de restauração.
São parâmetros de operação a ativar, não automações externas já instaladas.
RPO desses backups é de até 24 horas; o RTO medido em fixtures consta no JSON
e não garante o RTO de um banco real. Object storage/GCS, réplicas, secrets de
produção e cópia fora do host exigem validação no ambiente específico.

## Carga, falhas e limites

`pnpm run test:p2-local` cria somente o projeto Docker `nexos-p2-tests`, em
portas 55440/56390/56391, com URLs fixas e fixtures inertes. Testa carga HTTP
com funções reais de saldo e débito a 1, 8 e 32 clientes concorrentes, espera
do pool sob queries de 150 ms, integridade do extrato e replay concorrente.
O JSON registra p50/p95/máximo, throughput, erros, espera e recursos do Docker.

São rajadas limitadas; não são benchmark da jornada inteira nem de IA/vídeo.
Para homologação local, usar oito requisições transacionais simultâneas como
limite inicial conservador; 32 são teste de pico. Revalidar com duração e volume
de dados representativos antes de definir admissão de produção. Investigar
p95 acima de 1 segundo, erros, pool com espera persistente, Redis acima de 80%
do limite, falhas de persistência e filas que não esvaziam.

As falhas incluem SIGKILL do Redis, parada prolongada, indisponibilidade do
PostgreSQL e memória Redis esgotada. Provedores usam servidor HTTP de loopback
com 429, 503, JSON inválido e timeout real, passando pelos verificadores de
billing e Academy. Nenhuma chamada externa ou credencial real é necessária.

O runner limpa os containers e volumes que ele criou em `finally`. O workflow
`Infrastructure recovery` repete esse ensaio no GitHub e publica somente o JSON
de métricas. Não houve push nesta sessão; sua execução remota continua pendente.

## Verificação final local

Build completo, typecheck e saúde operacional aprovados. Autenticação dos backups
(arquivo vazio, múltiplos chunks, adulteração, chave errada e destino existente),
guard de logging, scanner de segredos, proteção do cliente Academy e auditoria
de histórico passaram. O teste adicional de transporte é reproduzido com
`node --test scripts/backup-crypto.test.mjs` e também está configurado no CI.

O ready check dos clientes Redis permanece ativo para verificar o servidor antes
de declarar a conexão pronta. Tempos de recuperação de indisponibilidade incluem
o comando de reinício e a verificação operacional. O ensaio usa configuração de
teste inerte; não apontar os testes de falha para serviços existentes.

## Rollback

Não há migração de schema neste P2. Para desfazer configuração Redis, preservar
volume e snapshot antes de trocar imagem/configuração; não tentar downgrade
direto de arquivos sem compatibilidade comprovada. Manter consumidores parados
durante recuperação. Reverter código da API não deve reintroduzir crashes de
pool ou declarar prontidão com cotas indisponíveis.
