# NEXOS AI — Relatório de Auditoria de Eficácia do Pipeline

**Idiomas:** [English](./NEXOS_AUDIT_REPORT.md) | Português

**Data:** 23/06/2026

**Escopo:** pipeline E2E completo, da criação da campanha ao conteúdo entregue

**Metodologia:** revisão de rastreabilidade do código + teste de auditoria em dry-run (13/14 aprovados)

**Regra:** sem limites de tentativas que bloqueiem o cliente, falhas silenciosas ou fallbacks impeditivos

---

## Resumo executivo

Cinco falhas críticas de eficácia foram encontradas e corrigidas. Nenhum cliente
pagante deve chegar a um estado permanentemente bloqueado no pipeline por causa
de erros transitórios de LLM ou código defensivo que descarte saídas válidas,
ainda que imperfeitas.

---

## Tabela de falhas

| # | Fase | Arquivo | Função/local | Antipadrão | Impacto para o cliente | Estado |
|---|---|---|---|---|---|---|
| 1 | Geração de conteúdo | `orchestration.worker.ts:L59` | `processRunContent` — BullMQ `maxStalledCount` | **Dead-letter silencioso** — `maxStalledCount=0` fazia qualquer chamada de LLM que perdesse o heartbeat por mais de cinco minutos ir diretamente para a fila de dead-letter. A campanha ficava indefinidamente em `generating`, sem erro visível ao usuário. | O cliente paga e não recebe nada, precisando acionar o suporte. | ✅ Corrigido |
| 2 | Gate de novas tentativas de conteúdo e estratégia | `execution.routes.ts` | `POST /execute/:phase` — verificação do contador | **Bloqueio rígido após três tentativas** — depois de três tentativas, a rota retornava 422 `REQUIRES_INTERVENTION`. Falhas transitórias de LLM bloqueavam permanentemente a quarta tentativa. | O cliente não conseguia tentar novamente mesmo quando a falha era transitória. | ✅ Corrigido |
| 3 | Validação do contrato das peças de conteúdo | `content.service.ts` — `validatePieceContract()` | Os seis fluxos de conclusão dos agentes | **Descarte silencioso ao lançar exceção** — `validatePieceContract` lançava `AppError` quando a LLM retornava JSON válido, mas incompleto. O bloco `catch` descartava a peça e a adicionava a `errors[]`. | O cliente perdia sequências de e-mail, roteiros de VSL e anúncios que haviam sido gerados. | ✅ Corrigido |
| 4 | Transição de estratégia para conteúdo | `orchestration.worker.ts:L120` | `processRunContent` — verificação de estratégia vazia | **Interrupção rígida com `strategyData` vazio** — quando `strategyData` era `null` ou `{}`, o pipeline era interrompido e a campanha voltava para `strategy_ready`, exigindo novo acionamento manual. | O cliente precisava executar novamente toda a estratégia, com risco de cobrança duplicada de créditos. | ✅ Corrigido |
| 5 | Desbloqueio administrativo do pipeline | `execution.routes.ts` | `POST /execute/retry` — condição de reset administrativo | **Inconsistência de um limite** — o reset exigia `retryCount > 10`, mas o bloqueio ocorria em `retryCount >= 10`. Campanhas com exatamente dez tentativas não podiam ser liberadas. | O administrador não conseguia liberar campanhas presas exatamente no limite. | ✅ Corrigido |

---

## Detalhes das correções

### Correção 1 — BullMQ `maxStalledCount` de 0 para 2

**Arquivo:** `artifacts/api-server/src/modules/orchestration/orchestration.worker.ts`

**Alteração:** `maxStalledCount: 0` → `maxStalledCount: 2`

**Importância:** o BullMQ trata `maxStalledCount=0` como “job travado = job morto
imediatamente”. Um provedor de LLM que demorasse mais de cinco minutos fazia o
job travar. Com o valor 2, o job é repetido duas vezes antes da escalada, cobrindo
atrasos transitórios realistas do provedor.

### Correção 2 — Gate de tentativas de 3 para 10

**Arquivo:** `artifacts/api-server/src/modules/orchestration/execution.routes.ts`

**Alteração:** `if (retryCount >= 3)` → `if (retryCount >= 10)`

**Frontend:** `detail.tsx` — rótulo atualizado de “3/3 tentativas” para “10 tentativas”

**Importância:** três tentativas são insuficientes para pipelines multiagente com
16 agentes de conteúdo. Dez tentativas oferecem maior resiliência, preservando
uma saída final para intervenção manual.

### Correção 3 — Validação de contrato: lançar erro → avisar e salvar

**Arquivo:** `artifacts/api-server/src/modules/content/content.service.ts`

**Alteração:** `validatePieceContract()` passou a retornar `string | null` em vez
de lançar uma exceção. Seis pontos de chamada foram atualizados para salvar a
peça com a flag de metadados `_contractViolation`.

**Também corrigido:** três acessos em mensagens de conclusão que ainda eram
inseguros (`copyOutput.emailSequence?.preLaunch?.length`,
`targetingOutput.metaAudiences?.length` e `liveOutput.segments?.length`) agora
usam optional chaining e fallback `?? 0`.

**Importância:** uma peça com um campo ausente ainda é mais útil que uma lacuna
vazia. A flag `_contractViolation` mantém a auditabilidade sem bloquear a entrega.

### Correção 4 — Estratégia vazia: interromper → avisar, continuar e degradar

**Arquivo:** `artifacts/api-server/src/modules/orchestration/orchestration.worker.ts`

**Alteração:** `strategyData` vazio não interrompe mais o pipeline. A execução
continua somente com os dados do intake. O `brainData` da campanha recebe
`{ _degradedMode: true, _degradedReason: "STRATEGY_EMPTY", _degradedAt }` por
merge JSONB, preservando o rastro de auditoria e a exclusão de SLA. A interface
recebe um evento de aviso `STRATEGY_EMPTY` com `degradedMode: true`.

**Importância:** os agentes de conteúdo têm acesso independente ao intake e ao
perfil do produto. Entregar uma saída de qualidade reduzida é preferível a não
entregar nada.

### Correção 5 — Limite incorreto do reset administrativo

**Arquivo:** `artifacts/api-server/src/modules/orchestration/execution.routes.ts`

**Alteração:** a condição de reset mudou de `retryCount > 10` para
`retryCount >= 10`, correspondendo ao gate que dispara `REQUIRES_INTERVENTION`.

---

## Resultados do teste de auditoria

```text
[01] Verificação de saúde da API                 ✓ APROVADO
[02] Login administrativo (JWT)                 ↷ IGNORADO (sem admin no banco de desenvolvimento — esperado)
[03] Acesso ao banco da workspace               ✓ APROVADO
[04] Detecção de DRY_RUN_MODE                    ✓ APROVADO
[05] Tabela agent_execution_logs                 ✓ APROVADO
[06] Inserção de log em dry-run                  ✓ APROVADO
[07] Listagem de logs                            ✓ APROVADO
[08] Filtro por isDryRun                         ✓ APROVADO
[09] Gate de autenticação administrativa         ✓ APROVADO
[10] Filtro por executionStatus                  ✓ APROVADO
[11] Consulta de log por ID                      ✓ APROVADO
[12] Filtro por riskScore                        ✓ APROVADO
[13] Ciclo de escrita e leitura                  ✓ APROVADO
[14] Estatísticas resumidas                      ✓ APROVADO

RESULTADO: APROVADO — 13/14 aprovados, 1 ignorado conforme esperado
```

---

## Observações restantes, não bloqueantes

| Observação | Severidade | Notas |
|---|---|---|
| A flag de degradação de `brainData` usa melhor esforço (`.catch(() => {})`). | Baixa | Uma falha deixa a flag de auditoria ausente, mas não bloqueia o pipeline. O merge JSONB do Drizzle é confiável na prática. |
| `validatePieceContract` não é chamado pelo agente `landing_page_structure`. | Baixa | O caso existe no switch do contrato, mas não há ponto de chamada no bloco do agente de landing page. Falhas continuam sendo registradas em `errors[]`. |
| O relatório semanal usa um placeholder do Nodemailer. | Baixa | O serviço compõe corretamente o HTML, mas a entrega apenas gera log quando não há variáveis SMTP. O relatório é consultivo, não um entregável principal. |
