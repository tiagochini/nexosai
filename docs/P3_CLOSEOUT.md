# P3 — validação local e preparação da homologação externa

Escopo autorizado: validar localmente com provedores simulados e preparar a
homologação externa. Nenhuma conta real recebeu publicação, cobrança ou e-mail.

## Entregas e evidência

- Jornada conectada: cadastro real cria usuário/workspace; campanha e conteúdo
  aprovado são fixtures; publicação exige preview explícito e produz recibo e
  readback Meta simulados; captura HTTP consentida deduplica o lead; checkout
  usa Asaas simulado; pagamento e atribuição concorrentes resultam em uma venda
  e uma conversão de R$25. Referências de outro workspace são rejeitadas.
- Checkout rejeita valor divergente do pagamento canônico antes de reconhecer
  uma venda. Status pendente não vira pagamento; replay concorrente é idempotente.
- Funil Academy, outbox de acesso e delivery intents exercitam concorrência,
  falhas, retomada e quarentena de resultados ambíguos. Aceitação do provedor
  não significa entrega à caixa de entrada; resultado ambíguo não é reenviado
  automaticamente e não há promessa de exactly-once externo.
- Worker nativo recebe concessões HMAC de uso único com TTL de até 60 segundos,
  limitado ao lease. Escopo inclui workspace, worker, job, lease, método, objeto
  e hash do input. Emissão exige worker autenticado, lease e consentimento
  atuais. Consumo atômico no banco bloqueia replay e corrida. Download verifica
  SHA-256; output permanece sujeito à verificação técnica/lease/consentimento.
- Vídeo: controle de lease, cancelamento, retries, proveniência e upload HTTP
  real via FFmpeg/ffprobe foram exercitados com fixture CPU. Worker sem CUDA
  recusa anunciar/executar inferência GPU. Isso não certifica modelos de vídeo.
- Mídia paga: testes dos contratos suportados, preview/autorização, intent,
  concorrência, receipt/readback e recuperação condicional; nenhuma API de
  anúncios real foi chamada. Launch Google/TikTok permanece explicitamente
  indisponível; esta entrega não declara esses executores completos.
- Dataset e avaliador de IA versionados, cinco artefatos, mínimo 85/100,
  regressões de conteúdo/template/modelo e revisão humana vinculada ao artefato.
  Referências sintéticas passam, mas ficam bloqueadas para homologação de IA.
  Procedimento e limites: [AI_QUALITY_EVALUATION.md](./AI_QUALITY_EVALUATION.md).

Execute `pnpm run test:p3-local`. O runner monta PostgreSQL 17/Redis 7.4 sem
portas públicas em rede Docker interna, usa segredos novos e fixtures explícitas,
constrói a imagem da API, testa e remove somente os volumes desse projeto.
Não importa `.env` nem credenciais reais. O resultado completo é escrito em
[P3_VALIDATION_RESULTS.json](./P3_VALIDATION_RESULTS.json) apenas após sucesso.
O job `p3-product-local` foi preparado no CI; execução remota ainda não ocorreu.

Tipos e builds de todos os projetos passaram com concorrência de workspace 1
após esgotamento de memória na execução paralela. Scanner de segredos, guard de
logging, política/checksums de migração e regressões de IA passaram. Os builds
mantêm avisos existentes de sourcemap e tamanho de chunks. A interrupção local
do motor Docker não foi registrada como sucesso; a suíte foi repetida integralmente.

## Isolamento posterior de usuários e projetos

A regressão local passou novamente com 23 grupos, incluindo ownership HTTP,
memória/contexto por projeto, concorrência de agentes, sessões/realtime,
retomada de conteúdo e limpeza do histórico privado no navegador. A imagem
foi reconstruída sem overlays. A migração 0069 impede vínculos cruzados de
memória e preserva registros inválidos como histórico sem projeto.
[Evidência, implantação e limites](./PROJECT_CONTEXT_ISOLATION.md).

## Correção de integridade do bootstrap

Os testes detectaram que o snapshot histórico de tabelas não continha os
triggers procedurais e mantinha omitidas chaves de escopo de uma etapa temporária
de publicação. Essa etapa foi encerrada (`PUBLISH_STAGE_ONE=false`). A nova migração
`0068_restore_bootstrap_integrity.sql` restaura definições canônicas de revisão
de landing, aprovação/SLA, execução condicional/evidência, contratos de
realização, Council e relatórios sociais, incluindo a versão mais recente da
função de imutabilidade. Restaura 18 triggers e 37 chaves ausentes do snapshot,
sem reescrever dados ou migrations históricas. O verificador rejeita triggers
ausentes/desativados e chaves de escopo ausentes/não validadas.

Para banco existente: faça backup e execute `pnpm --filter @workspace/db
migrate:tracked`, seguido de `verify`. Banco novo usa `bootstrap:empty`, seed e
verify. A migração é transacional e repetível; o runner testa repetição, detector
de trigger desativado/chave removida e rollback completo do bootstrap. Dados
legados com vínculos inválidos fazem a migração falhar integralmente; investigue
e corrija com evidência antes de repetir, sem descartar a proteção. Proteções podem
revelar operações antigas de edição/exclusão que eram indevidamente permitidas.

Rollback operacional: pause dispatch, reverta API **e worker juntos** à versão
anterior e mantenha as proteções de integridade. Não edite checksums nem remova
triggers para acomodar uma aplicação antiga. Se houver incompatibilidade de
schema, restaure backup em outro banco, verifique e altere a conexão durante a
janela de manutenção. Grants antigos expiram; o broker não exige nova tabela.
Worker anterior sem grants não pode transferir objetos para a API nova.

## Homologação externa preparada — ainda pendente

| Etapa | Ambiente e evidência exigidos |
|---|---|
| Infraestrutura | Deploy conjunto API/frontend/worker, HTTPS, PostgreSQL externo com TLS verificado e backup/restauração externa; seguir [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md). Executar migrações/verify antes de iniciar dispatch. |
| Jornada | Workspace e contas de teste próprios, consentimento/autorização explícitos, IDs reais de campanha/conteúdo/publicação/lead/pagamento/atribuição e readback persistido. Repetir replay, falha/timeout, revogação e isolamento de workspace. |
| Academy | Provedor de teste, destinatário autorizado, recibo e entrega verificáveis; queda de host/banco e reinício entre intent/aceitação/registro. Conciliar resultados ambíguos por consulta/operador, sem reenvio cego. |
| Vídeo | GPU privada com CUDA/VRAM compatível, pesos locais aprovados e plugin real. Registrar model/revision/backend, hashes de entrada/saída, ffprobe, consentimento vigente, proveniência e custo; validar cancelamento, lease expirado e reinício. |
| Mídia paga | Conta Meta de teste, orçamento aprovado limitado, preview e readback reais, reconciliação de intent ambíguo e rollback dos objetos comprovadamente criados. Google/TikTok launch exige implementação adicional antes da homologação. |
| IA | Executar a matriz com versões reais de modelos/prompts; preservar contexto, outputs e hashes; responsável revisa os cinco artefatos e aprova o pacote conforme o protocolo. |
| CI e liberação | Confirmar workflows remotos e gates P0/P1 de administrador/Asaas. Registrar relatório sem segredos. Só então decidir liberação. |

P3 local entregue; a certificação completa de vídeo/mídia paga, qualidade de
modelos reais e homologação externa continuam abertas. M11/M12 e os gates de
consentimento mantêm seus critérios existentes.
