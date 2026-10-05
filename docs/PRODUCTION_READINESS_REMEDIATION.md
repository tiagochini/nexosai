# NexOS AI — Referência de prontidão e correções para produção

English version: [PRODUCTION_READINESS_REMEDIATION.en.md](./PRODUCTION_READINESS_REMEDIATION.en.md)

**Data da revisão:** 03/10/2026  
**Escopo:** monorepo, API, frontend, banco, Redis, filas, integrações, segurança,
recuperação, concorrência e qualidade de IA.

## 1. Estado verificado

- Build e typecheck aprovados no CI Linux.
- Scanner de segredos e auditoria do histórico aprovados.
- PostgreSQL verificado com 172 tabelas e 69 entradas de schema.
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

- [x] Remover segredos previamente versionados e limpar o histórico Git.
- [x] Impedir envio de tokens, chaves e screenshots ao assistente de integrações.
- [x] Remover tokens de logs da Academy.
- [x] Escapar valores dinâmicos nos e-mails do funil e de acesso Academy;
  validar e escapar URLs nos atributos dos templates revisados.
  Evidência local: [ACADEMY_FUNNEL_DELIVERY.md](./ACADEMY_FUNNEL_DELIVERY.md).
- [ ] Concluir auditoria de dados sensíveis nos logs dos demais módulos.
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

### P1 — Dependências e CI

- [x] Atualizar dependências diretas vulneráveis da API e transitivas corrigidas.
- [x] Remover a cadeia antiga `html-pdf-node`/Puppeteer não utilizada.
- [x] Adicionar `pnpm audit --prod` ao CI, bloqueando qualquer severidade.
  Evidência: [DEPENDENCY_SECURITY_REMEDIATION.md](./DEPENDENCY_SECURITY_REMEDIATION.md).
- [ ] Executar testes críticos no CI com PostgreSQL e Redis descartáveis.
- [x] Executar testes de autenticação, concorrência de cadastro e criptografia
  no CI com PostgreSQL descartável. Redis e demais fluxos continuam pendentes.
- [ ] Executar bootstrap de banco vazio, verificação e rollback no CI.
- [ ] Executar auditoria completa do histórico no workflow de segurança.

### P2 — Infraestrutura e recuperação

- [ ] Atualizar Redis para versão suportada, preferencialmente Redis 7.
- [ ] Configurar Redis como serviço persistente e monitorado.
- [ ] Testar backup e restauração completos.
- [ ] Executar testes de falha de PostgreSQL, Redis e provedores externos.
- [ ] Medir carga, latência, saturação e recuperação para concorrência real.

### P3 — Jornada e qualidade do produto

- [ ] Concluir jornada sandbox: cadastro → campanha → conteúdo → publicação →
  lead → checkout → atribuição.
- [x] Impedir que o funil Academy marque e-mails como enviados sem provedor
  configurado; avançar somente após aceitação pelo provedor, sem simulação em produção.
  Evidência local e limites: [ACADEMY_FUNNEL_DELIVERY.md](./ACADEMY_FUNNEL_DELIVERY.md).
- [ ] Certificar idempotência, concorrência e recuperação do envio Academy.
- [ ] Corrigir envio Gmail e validação de recibos no e-mail transacional de acesso Academy.
- [x] Tornar inscrição Academy transacional/idempotente por lead e reservar
  envios atomicamente entre boas-vindas/scheduler; bloquear resultados ambíguos.
  Testes locais de concorrência e queda de processo separado passaram. Há checagem
  somente de leitura e bloqueio explícito de resultados ambíguos. Queda de
  host/banco e conciliação real continuam pendentes em
  [ACADEMY_FUNNEL_DELIVERY.md](./ACADEMY_FUNNEL_DELIVERY.md).
- [ ] Implementar concessões de acesso a objetos para o worker de mídia.
- [ ] Concluir e certificar executores de vídeo e mídia paga.
- [ ] Criar conjunto versionado de avaliações de IA com critérios por artefato.
- [ ] Definir nota mínima, revisão humana e regressão de prompts/modelos.

## 4. Evidência exigida por correção

Cada item deve incluir:

- teste automatizado que falhe antes e passe depois;
- ausência de segredo em logs e respostas;
- resultado de typecheck e build;
- impacto em banco e procedimento de rollback, quando aplicável;
- atualização deste checklist;
- confirmação dos workflows remotos.

## 5. Estado de liberação

Enquanto houver item P0 aberto ou vulnerabilidade alta em caminho exposto, a
liberação recomendada é somente homologação ou canário restrito, sem credenciais
reais de clientes. Produção aberta exige P0 e P1 concluídos e evidência mínima de
P2 e P3.
