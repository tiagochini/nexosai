# NEXOS AI — Guardrails

**Protocolo obrigatório para qualquer alteração:**
> DIAGNOSTICAR → PLANEJAR → APROVAR → IMPLEMENTAR → TESTAR → DOCUMENTAR

---

## 1. Regras de Código

| Regra | Detalhes |
|-------|----------|
| **G-01** | Nunca criar arquivos com sufixo `v2`, `final`, `fixed`, `new`, `backup` |
| **G-02** | Nunca atualizar `status` de campanha via `db.update` direto — usar `transitionCampaign()` |
| **G-03** | Toda transição de status inválida lança `ValidationError` (Level 3 ativo) |
| **G-04** | Constantes de state machine importadas exclusivamente de `campaign-state-machine.ts` |
| **G-05** | Agents não fazem import direto de módulos de UI — fluxo sempre Backend → Frontend |
| **G-06** | Prompts de agente ficam no arquivo `.agent.ts` do próprio agente — nunca inline em routes/workers |
| **G-07** | Side-effects de aprovação ficam em `content-post-approval.ts` — nunca inline em route handlers |
| **G-08** | `runAgent()` chamado diretamente apenas em `agent.runner.ts` — demais módulos usam `runIsolatedAgent()` para execuções críticas |
| **G-09** | Nenhum `setInterval` iniciado sem `clearInterval` correspondente no shutdown |
| **G-10** | Nenhum `res.json()` em endpoint que retorna shape complexo sem Zod schema de validação |

---

## 2. Gates de Aprovação Humana Obrigatória

| Ação | Gate | Implementação |
|------|------|---------------|
| Iniciar fase de Estratégia | ✅ Clique explícito do usuário | `POST /campaigns/:id/execute {phase:"strategy"}` |
| Iniciar fase de Conteúdo | ✅ Clique explícito do usuário | `POST /campaigns/:id/execute {phase:"content"}` |
| Lançar campanha (`approved → executing`) | ✅ Clique + verificação de integrações | `POST /campaigns/:id/execute {phase:"launch"}` + `checkIntegrationsForLaunch()` |
| Aprovar checkpoint de estratégia | ✅ Aprovação explícita de checkpoint | `POST /campaigns/:id/checkpoints/:id/approve` |
| Aprovar conceito de criativo (DALL-E) | ✅ Aprovação explícita de concept | `POST /campaigns/:id/creatives/:id/approve-concept` |
| Aprovar preview de criativo | ✅ Aprovação explícita de preview | `POST /campaigns/:id/creatives/:id/approve-preview` |
| Ativar sequência de lançamento | ✅ Clique explícito | `POST /launch-sequences/:id/activate` |

### Gates FALTANDO (a implementar em Fase 3):

| Ação | Status | Recomendação |
|------|--------|--------------|
| Content approval → Social autopost | ❌ Fire-and-forget imediato | Adicionar confirmação modal antes de postar |
| Sequence scheduler → Dispatch | ⚠️ Automático após activate | Adicionar dry-run preview antes de ativar |

---

## 3. Regras de Agentes

| Regra | Detalhes |
|-------|----------|
| **A-01** | Todo novo `AgentRole` precisa de: tipo em `AgentRole`, entrada em `AGENT_PROVIDER_MAP`, arquivo `.agent.ts` com prompt |
| **A-02** | Agentes experimentais (sem integração na pipeline) ficam documentados em `agents/experimental/README.md` |
| **A-03** | `parseAgentJSON()` nunca retorna `null` silencioso em fluxos críticos — usar `runIsolatedAgent()` para controle |
| **A-04** | Prompts com mais de 500 tokens de sistema devem ter `max_tokens` ajustado proporcionalmente |
| **A-05** | Agentes que retornam JSON devem ter `requiredOutputFields` definido no contrato |

---

## 4. Regras de Schema / DB

| Regra | Detalhes |
|-------|----------|
| **D-01** | Novas tabelas requerem módulo backend correspondente antes de ir para produção |
| **D-02** | Enum changes no DB requerem migration explícita — nunca alterar enum inline |
| **D-03** | Toda nova tabela deve ser exportada de `lib/db/src/schema/index.ts` |
| **D-04** | `pnpm run typecheck:libs` antes de `pnpm --filter @workspace/api-server run typecheck` após mudanças de schema |

---

## 5. Regras de Integrações

| Regra | Detalhes |
|-------|----------|
| **I-01** | Pagamento NUNCA bloqueia execução de campanha (`blocksExecution = false` sempre) |
| **I-02** | Falha em integração de terceiro = log + graceful degradation, nunca HTTP 500 |
| **I-03** | Toda integração nova precisa de: `workspace_integrations` entry + rota de conexão + rota de desconexão |

---

## 6. Checklist Antes de Qualquer PR / Alteração

```
[ ] typecheck passa sem erros: pnpm run typecheck
[ ] Nenhuma nova instância de db.update(campaignsTable).set({status}) fora de transitionCampaign/updateCampaignStatus
[ ] Nenhum novo AgentRole sem arquivo .agent.ts correspondente
[ ] Nenhum novo setInterval sem clearInterval no shutdown
[ ] Side-effects de aprovação passam por content-post-approval.ts
[ ] Novos endpoints têm Zod schema de request/response
[ ] NEXOS_STATE_MACHINE.md atualizado se status machine mudou
[ ] NEXOS_AGENT_CONTRACTS.md atualizado se novo agente foi adicionado
```
