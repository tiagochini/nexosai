# NexOS AI — Referência de prontidão e correções para produção

English version: [PRODUCTION_READINESS_REMEDIATION.en.md](./PRODUCTION_READINESS_REMEDIATION.en.md)

**Data da revisão:** 06/10/2026
**Escopo:** monorepo, API, frontend, banco, Redis, filas, integrações, segurança,
recuperação, concorrência e qualidade de IA.

## 1. Estado verificado

- Build e typecheck aprovados no CI Linux.
- Scanner de segredos e auditoria do histórico aprovados.
- PostgreSQL verificado com 177 tabelas e 73 entradas de schema após a 0067.
- Cadastro transacional, cadastro concorrente, créditos concorrentes, fallback de
  orquestração, checkpoint/retomada e saúde operacional aprovados localmente.
- As 22 capacidades GLP22 permanecem em 20 `PARTIAL`, 2 `BLOCKED` e 0 `HEALTHY`.
- A auditoria inicial encontrou 75 vulnerabilidades no grafo de runtime:
  39 altas, 31 moderadas e 5 baixas. Após a correção de dependências,
  `pnpm audit --prod` não encontrou vulnerabilidades conhecidas em 03/10/2026.

## 2. Critério de prontidão

O sistema somente deve ser considerado pronto para produção aberta quando:

1. credenciais não forem enviadas a modelos de IA, logs ou armazenamento sem
   criptografia;
2. não houver vulnerabilidade alta conhecida em caminho de runtime exposto;
3. testes críticos rodarem automaticamente no CI com PostgreSQL e Redis
   descartáveis;
4. backup e restauração, indisponibilidade de dependências e recuperação forem
   exercitados;
5. carga e concorrência tiverem limites documentados;
6. uma jornada real ponta a ponta tiver sido concluída em sandbox autorizado;
7. a qualidade da IA for medida por avaliações reproduzíveis e revisão humana.

## 3. Plano priorizado

### P0 — Segurança de credenciais

- [x] Remover senha administrativa padrão Academy, proteger as 11 rotas
  revisadas e bloquear credenciais em URL; incluir autorização no scheduler manual.
  Evidência local e compatibilidade: [ACADEMY_ADMIN_SECURITY.md](./ACADEMY_ADMIN_SECURITY.md).
- [x] Migrar administração Academy para sessão individual revogável e UUID de
  proprietário autorizado; retirar PIN/token mágico do frontend e auditar solicitações.
  Evidência e ativação: [P0_SECURITY_CLOSEOUT.md](./P0_SECURITY_CLOSEOUT.md).
- [x] Usar aleatoriedade criptográfica nos códigos Academy de checkout/brindes
  e validar lotes de brindes antes da emissão, mantendo códigos existentes.
  Evidência local: [ACADEMY_ADMIN_SECURITY.md](./ACADEMY_ADMIN_SECURITY.md).
- [x] Limitar tentativas públicas de validação Academy por IP/sub-rede,
  resistir a cabeçalhos de origem falsificados e autenticar webhook/confirmador simulado.
- [x] Compartilhar cotas por Redis, bloquear em indisponibilidade, revisar
  revogação de códigos, revalidação do cliente, tutor e exposição de dados pessoais.
- [x] Bloquear webhook de billing sem token válido e exigir privilégio adicional
  para confirmação manual; compartilhar comparação segura com Academy/checkout.
  Evidência local: [BILLING_WEBHOOK_SECURITY.md](./BILLING_WEBHOOK_SECURITY.md).
- [x] Tornar confirmação de billing, saldo e extrato atômicos e idempotentes;
  validar concorrência entre confirmações, concessões e descontos com fixtures locais.
- [x] Conferir confirmação de billing com ID, valor, forma e estado atuais no Asaas;
  bloquear concessão em falhas/divergências, revalidar vínculo sob bloqueio e testar com mocks.
- [x] Conferir webhook Academy com pagamento, cliente, referência, valor e estado
  no Asaas; confirmar compra/conversão juntas e testar concorrência sem envio real.
  Evidência local: [ACADEMY_PAYMENT_CONFIRMATION.md](./ACADEMY_PAYMENT_CONFIRMATION.md).
- [x] Revisar reversões, dívida e recuperação com mocks/concorrência;
  confirmar ausência de compras históricas locais e implementar conciliação
  auditada de entregas incertas. Evidência externa permanece requisito de liberação.
- [x] Persistir a fila do e-mail de acesso na confirmação Academy por webhook;
  validar retomada de pendentes, claim concorrente e quarentena após queda de processo.
  Evidência local: [ACADEMY_ACCESS_EMAIL_OUTBOX.md](./ACADEMY_ACCESS_EMAIL_OUTBOX.md).
- [x] Migrar reenvios/admin/brindes para entrega durável e conciliação autorizada.

- [x] Remover segredos previamente versionados e limpar o histórico Git.
- [x] Impedir envio de tokens, chaves e screenshots ao assistente de integrações.
- [x] Remover tokens de logs da Academy.
- [x] Escapar valores dinâmicos nos e-mails do funil e de acesso Academy;
  validar e escapar URLs nos atributos dos templates revisados.
  Evidência local: [ACADEMY_FUNNEL_DELIVERY.md](./ACADEMY_FUNNEL_DELIVERY.md).
- [x] Revisar campos dos logs do runtime TypeScript da API, aplicar proteção
  de texto livre/códigos/metadados e testar canários opacos; serviços externos,
  scripts de diagnóstico e retenção não são certificados por essa evidência.
- [x] Proteger logger central/HTTP, erros e bindings filhos contra campos
  sensíveis; remover dados desnecessários nos pontos revisados.
  Escopo e limites: [LOG_SECURITY.md](./LOG_SECURITY.md).
- [x] Remover conteúdo privado dos logs revisados de Meta/WhatsApp, respostas
  de provedores e previews de IA; adicionar guard AST de logging ao workflow local.
- [x] Restringir salas de campanhas em tempo real ao workspace autenticado,
  validar origem de WebSocket/polling e desconectar ao expirar o token.
  Evidência: [REALTIME_SECURITY.md](./REALTIME_SECURITY.md).
- [x] Remover segredo padrão do webhook WhatsApp.
- [x] Validar assinatura HMAC do webhook WhatsApp.
- [x] Criptografar tokens de integrações em repouso com chave externa ao banco.
  Procedimento: [INTEGRATION_TOKEN_ENCRYPTION.md](./INTEGRATION_TOKEN_ENCRYPTION.md).
- [x] Migrar refresh token do `localStorage` para cookie `HttpOnly`, `Secure` e
  `SameSite`, com rotação e revogação.
  Procedimento: [AUTH_SESSION_SECURITY.md](./AUTH_SESSION_SECURITY.md).

Política de ambientes em 07/10/2026: Supabase exclusivo de homologação;
desenvolvimento e regressões em PostgreSQL local/Docker. As evidências remotas de
06/10/2026 são históricas; a suíte de regressão Supabase foi desativada.
[Comandos e limites](./SUPABASE_HOMOLOGATION.md).

### P0 — Condições de fechamento ainda abertas

- [x] Administrador real **local** criado por autorização explícita:
  `founder@nexos.ai`, UUID `dc97c52d-3769-4be3-bed1-c4239cc40796`. Login,
  autorização UUID/sessão, revogação e auditoria foram comprovados por HTTP.
  [Evidência sanitizada](./P0_REAL_ADMIN_ACTIVATION.json).
- [x] Conta master provisionada no banco Supabase de homologação, com UUID
  `94942b5f-23ea-47f4-b589-a37457db3b6c`; login, sessão, revogação e auditoria
  comprovados também na API compilada local. [Evidência](./SUPABASE_HOMOLOGATION.md).
- [ ] Implantar/validar a aplicação no ambiente público e provisionar o banco de
  produção separadamente; homologação Supabase não representa liberação de produção.
- [ ] Concluir a homologação de todos os fluxos Asaas: Campanhas e Academy passaram
  checkout público, cartão sandbox, webhook real, repetição e estorno integral em
  08/10/2026. Pacote de 500 créditos também passou pagamento, estorno real e
  idempotência em conta/workspace separados (900 → 1.400 → 900), sem alterar o
  founder. **Plano Agency corrigido e retestado:** ativação/créditos atômicos,
  900 → 2.900 no plano → 3.400 com pack; estornos reais restauraram Solo/900.
  Replays não duplicaram concessões/reversões; regressões Docker e tipos passaram.
  Cobranças billing estornadas, sessões de teste revogadas e histórico preservado.
  **Ampliação em 08/10/2026:** PIX e boleto de R$85 chegaram a `RECEIVED` e
  liberaram 500 créditos cada, uma vez, com webhook real; cartões rejeitados de
  plano e pack retornaram 400 sem criar pagamento/benefícios. CPF/CNPJ ausente no
  checkout foi corrigido. Estorno parcial PIX de R$42,50 autorizado, mas cancelado
  pelo provider, inclusive na única retentativa; sem reversão antecipada. Parcial
  de cartão foi recusado até o próximo dia. Solicitação de chargeback enviada
  ao suporte com autorização humana; simulação externa ainda pendente. PIX Agency
  sob bloqueio segue `CONFIRMED`, sem ativação antecipada. Envio efetivo do e-mail
  Academy ainda pendente. Não marcar homologação completa antes de conferir os
  estados canônicos e benefícios das etapas restantes.
  [Evidência ampliada](./ASAAS_EXTENDED_SANDBOX_RESULTS.json) e
  [procedimento de retomada](./ASAAS_EXTENDED_SANDBOX.md).
  [Evidência Campanhas/Academy](./ASAAS_SANDBOX_JOURNEY_RESULTS.json),
  [falha billing histórica](./ASAAS_BILLING_SANDBOX_RESULTS.json),
  [reteste billing aprovado](./ASAAS_BILLING_SANDBOX_RETEST_RESULTS.json).
- [x] Concluir o build completo/frontend e tipos: Rollup fixado em 4.63.6 após
  diagnóstico/comparação local. Auditoria inclui ferramentas e passou sem vulnerabilidades conhecidas.

### P1 — Dependências e CI
- [x] Separar a entrega de material pago estático da Academy para autorização
  pelo servidor; o controle da interface não é proteção contra extração do bundle.

- [x] Atualizar dependências diretas vulneráveis da API e transitivas corrigidas.
- [x] Remover a cadeia antiga `html-pdf-node`/Puppeteer não utilizada.
- [x] Adicionar `pnpm audit --prod` ao CI, bloqueando qualquer severidade.
  Evidência: [DEPENDENCY_SECURITY_REMEDIATION.md](./DEPENDENCY_SECURITY_REMEDIATION.md).
- [x] Configurar testes críticos no CI com PostgreSQL e Redis descartáveis;
  suíte equivalente validada localmente em containers isolados.
- [x] Executar testes de autenticação, concorrência de cadastro e criptografia
  no CI com PostgreSQL descartável. Redis, pagamentos, Academy e retomada
  agora integram o workflow e passaram na validação local.
- [x] Configurar bootstrap de banco vazio, verificação e rollback no CI;
  execução local aprovada com 177 tabelas e 73 entradas de schema.
- [x] Executar auditoria de caminhos sensíveis em todo o histórico alcançável
  no workflow de segurança, com checkout completo e rejeição de clone raso.
- [x] Confirmar execução remota dos workflows da implementação original do P1.
  GitHub CLI autenticado; Quality, Security e Infrastructure concluíram com
  sucesso no SHA remoto `81b0d3e0`, que contém a implementação P1 `757ec7c0`.
  Confirmação por SHA, jobs e etapas em 08/10/2026:
  [evidência remota](./P1_REMOTE_CI_RESULTS.json),
  [fechamento e implantação](./P1_CLOSEOUT.md).
- [x] Publicar e confirmar CI remoto das alterações posteriores, incluindo
  ativação de planos `c2bc26d3`. Push autorizado e executado em 08/10/2026:
  `81b0d3e0` → `93a5db75`, com 11 commits publicados. Quality, Security e
  Infrastructure aprovaram os seis jobs nesse SHA; regressão de planos
  confirmada nos logs de banco e no artefato P3. Artefatos Docker, P2 e P3
  disponíveis, baixados e verificados. [Evidência atual por SHA, jobs, logs e
  artefatos](./P1_CURRENT_REMOTE_CI_RESULTS.json). Este CI usa infraestrutura
  descartável e não certifica implantação de produção.

### P2 — Infraestrutura e recuperação

- [x] Preparar Redis 7.4 suportado e validar localmente sua configuração.
- [x] Configurar Redis persistente, autenticado e monitorado, com AOF e volume.
- [x] Testar backup cifrado e restauração de todo o banco e dos dados Redis
  em destinos novos; comparar schema, linhas, valores e TTLs.
- [x] Executar falhas reais de PostgreSQL/Redis e falhas de provedores em
  servidor HTTP de loopback, incluindo timeout e resposta inválida.
- [x] Medir carga HTTP transacional, latência, saturação do pool e recuperação
  a 1, 8 e 32 clientes concorrentes, com saldo/extrato e replay verificados.

P2 concluído no escopo autorizado de preparação e validação **local**.
Procedimentos, limites e evidência: [P2_CLOSEOUT.md](./P2_CLOSEOUT.md) e
[P2_VALIDATION_RESULTS.json](./P2_VALIDATION_RESULTS.json). Ativação em servidor,
armazenamento externo/mídia, volume representativo e execução remota do novo CI
continuam pendentes; não constituem homologação de produção.

### P3 — Jornada e qualidade do produto

Pré-requisito adicional concluído localmente: aplicação Docker com PostgreSQL
local opcional ou externo via TLS, ferramentas de schema explícitas e teste de
recuperação. [Guia Docker](./DOCKER_DEPLOYMENT.md) e
[evidência](./DOCKER_DEPLOYMENT_RESULTS.json). Ambiente real não foi ativado.

- [x] Validar jornada local simulada: cadastro → campanha/conteúdo fixture →
  publicação autorizada → lead → checkout → atribuição; sem inferência ou envio real.
- [x] Impedir que o funil Academy marque e-mails como enviados sem provedor
  configurado; avançar somente após aceitação pelo provedor, sem simulação em produção.
  Evidência local e limites: [ACADEMY_FUNNEL_DELIVERY.md](./ACADEMY_FUNNEL_DELIVERY.md).
- [x] Validar localmente idempotência, concorrência, retomada e quarentena do
  envio Academy; entrega/conciliação real e queda de host/banco seguem pendentes.
- [x] Corrigir envio Gmail e validação de recibos no e-mail transacional de acesso Academy.
- [x] Persistir outbox e validar localmente reconciliação/retomada do envio
  transacional de acesso Academy, sem reenvio cego de resultados ambíguos.
- [x] Tornar inscrição Academy transacional/idempotente por lead e reservar
  envios atomicamente entre boas-vindas/scheduler; bloquear resultados ambíguos.
  Testes locais de concorrência e queda de processo separado passaram. Há checagem
  somente de leitura e bloqueio explícito de resultados ambíguos. Queda de
  host/banco e conciliação real continuam pendentes em
  [ACADEMY_FUNNEL_DELIVERY.md](./ACADEMY_FUNNEL_DELIVERY.md).
- [x] Implementar concessões assinadas de uso único por lease/worker/objeto;
  validar expiração, isolamento, adulteração, replay e concorrência por HTTP.
- [ ] Concluir e certificar executores de vídeo e mídia paga.
  Controle de mídia, upload FFmpeg e contratos suportados passaram localmente;
  GPU/pesos reais, Meta externo e launch Google/TikTok continuam abertos.
- [x] Criar conjunto versionado de avaliações de IA com critérios para cinco artefatos.
- [x] Definir nota mínima 85/100, revisão humana vinculada ao artefato/template/modelo
  e regressões automatizadas. A qualidade de modelos reais ainda exige homologação.

P3 entregue no escopo **local** autorizado e homologação externa preparada.
Evidência, migração de integridade do bootstrap e pendências:
[P3_CLOSEOUT.md](./P3_CLOSEOUT.md), [resultados](./P3_VALIDATION_RESULTS.json)
e [protocolo de IA](./AI_QUALITY_EVALUATION.md). Certificação completa de executores,
provedores/modelos reais e execução remota do CI permanecem abertas.

### Reforço transversal — isolamento de usuários e projetos (06/10/2026)

Ownership atual, consultas de memória/contexto por projeto, ausência de
reaproveitamento entre campanhas, configurações concorrentes e histórico privado
do navegador foram reforçados. Migração 0069 e testes adversariais passaram
localmente em imagem reconstruída. Evidência e limites em
[PROJECT_CONTEXT_ISOLATION.md](./PROJECT_CONTEXT_ISOLATION.md). Aplicação em
homologação, CI remoto e auditoria de artefatos antigos seguem pendentes.

## 4. Evidência exigida por correção

Cada item deve incluir:

- teste automatizado que falhe antes e passe depois;
- ausência de segredo em logs e respostas;
- resultado de typecheck e build;
- impacto em banco e procedimento de rollback, quando aplicável;
- atualização deste checklist;
- confirmação dos workflows remotos.

## 5. Estado de liberação

As correções do P0 foram implementadas localmente com os limites documentados em
[P0_SECURITY_CLOSEOUT.md](./P0_SECURITY_CLOSEOUT.md). Isso não autoriza produção:
administrador validado localmente; ativação externa, Asaas sandbox/webhooks e CI remoto continuam pendentes; build completo local passou.
Enquanto houver condição de ativação do P0 aberta ou vulnerabilidade alta em caminho exposto, a
liberação recomendada é somente homologação ou canário restrito, sem credenciais
reais de clientes. Produção aberta exige P0 e P1 concluídos e evidência mínima de
P2 e P3.
