# NexOS AI — Referência de prontidão e correções para produção

English version: [PRODUCTION_READINESS_REMEDIATION.en.md](./PRODUCTION_READINESS_REMEDIATION.en.md)

**Data da revisão:** 03/10/2026  
**Escopo:** monorepo, API, frontend, banco, Redis, filas, integrações, segurança,
recuperação, concorrência e qualidade de IA.

## 1. Estado verificado

- Build e typecheck aprovados no CI Linux.
- Scanner de segredos e auditoria do histórico aprovados.
- PostgreSQL verificado com 171 tabelas e 68 entradas de schema.
- Cadastro transacional, cadastro concorrente, créditos concorrentes, fallback de
  orquestração, checkpoint/retomada e saúde operacional aprovados localmente.
- As 22 capacidades GLP22 permanecem em 20 `PARTIAL`, 2 `BLOCKED` e 0 `HEALTHY`.
- A auditoria de dependências encontrou 75 vulnerabilidades no grafo de runtime:
  39 altas, 31 moderadas e 5 baixas.

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
- [ ] Concluir auditoria de dados sensíveis nos logs dos demais módulos.
- [x] Remover segredo padrão do webhook WhatsApp.
- [x] Validar assinatura HMAC do webhook WhatsApp.
- [x] Criptografar tokens de integrações em repouso com chave externa ao banco.
  Procedimento: [INTEGRATION_TOKEN_ENCRYPTION.md](./INTEGRATION_TOKEN_ENCRYPTION.md).
- [ ] Migrar refresh token do `localStorage` para cookie `HttpOnly`, `Secure` e
  `SameSite`, com rotação e revogação.

### P1 — Dependências e CI

- [ ] Atualizar dependências diretas vulneráveis da API.
- [ ] Substituir ou isolar a cadeia antiga `html-pdf-node`/Puppeteer.
- [ ] Adicionar `pnpm audit --prod` ao CI com política de severidade.
- [ ] Executar testes críticos no CI com PostgreSQL e Redis descartáveis.
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
