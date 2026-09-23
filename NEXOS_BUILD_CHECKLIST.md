# NexOS — Checklist Canônico de Construção

> Atualizado após cada unidade de desenvolvimento.
>
> Este arquivo responde três perguntas: **onde estamos**, **o que foi comprovado** e **qual é o próximo checkpoint**.

Última atualização: **23 de setembro de 2026**

## Estado executivo

- **Estágio operacional em foco:** transversal — Control Room e governança de capacidades;
- **Nível de maturidade em foco:** M03 — Drilldown de evidência;
- **Último nível concluído:** M02 — Contadores clicáveis;
- **Checkpoint atual:** M02 concluído e comprovado com fixture autenticado isolado;
- **Próximo checkpoint:** especificar e implementar timeline paginada com registros exatos, filtros e links de origem.

## Checklist dos 12 níveis de maturidade

| Nível | Entrega | Estado | Evidência atual | Próximo critério |
|---|---|---|---|---|
| M01 | Control Room UI | ✅ Concluído | API real, ownership, estados vazios, desktop/mobile e acesso Fundador/Arquiteto | Manter sem regressão |
| M02 | Contadores clicáveis | ✅ Concluído | Build, API real, fixture autenticado, composição exata, desktop/mobile e acessibilidade | Manter sem regressão |
| M03 | Drilldown de evidência | ▶️ Próximo | API atual retorna somente as 25 evidências mais recentes | Timeline paginada com registros exatos |
| M04 | Preview universal | ⬜ Pendente | — | Contrato para texto, imagem, vídeo, páginas, mensagens e anúncios |
| M05 | Version diff | ⬜ Pendente | — | Comparação entre versões e revisões |
| M06 | Approval Center | ⬜ Pendente | — | Aprovação/rejeição motivada e versionada |
| M07 | SLA e lembretes | ⬜ Pendente | — | `dueAt`, aviso, entrega e decisão |
| M08 | Autoexecução condicionada | ⬜ Pendente | — | Gates, política, idempotência e pausa |
| M09 | Contratos de realização | ⬜ Pendente | — | Preflight, attempt, receipt, QC e compensation |
| M10 | Council operacional | ⬜ Pendente | — | Decisão → ação → resultado comprovado |
| M11 | Verticais full-stack | ⬜ Pendente | — | Primeira vertical completa: Content/Social |
| M12 | Lifecycle autônomo | ⬜ Pendente | — | Homologação real do ciclo completo |

## Checklist dos 12 estágios operacionais

O estado abaixo será calculado capability por capability. Nenhum estágio é considerado concluído por alegação histórica.

| Estágio | Domínio | Estado do índice |
|---|---|---|
| L01 | Fundamentos de execução | 🟡 Auditoria das capabilities existentes pendente |
| L02 | Captura e primeiro contato | 🟡 Fundação implementada; indexação completa pendente |
| L03 | Conversação comercial | ⬜ Indexação e gap audit pendentes |
| L04 | Oferta, checkout e pagamento | ⬜ Indexação e gap audit pendentes |
| L05 | Recuperação de vendas | ⬜ Indexação e gap audit pendentes |
| L06 | Pós-venda e entrega | ⬜ Indexação e gap audit pendentes |
| L07 | Retenção, comunidade e indicação | ⬜ Indexação e gap audit pendentes |
| L08 | Conteúdo e presença digital | 🟡 Capacidades existentes; certificação full-stack pendente |
| L09 | Aquisição paga | 🟡 Fundação governada; homologação completa pendente |
| L10 | Inteligência e otimização | 🟡 Sistemas parciais; Council fechado pendente |
| L11 | Resiliência e governança | 🟡 Fundações implementadas; índice e certificação pendentes |
| L12 | Homologação de produção | ⬜ Matriz de certificação pendente |

## Última unidade concluída — M02 Contadores clicáveis

### Entregue no código

- [x] contador de previews/entregáveis acionável;
- [x] contagens por grupo de entregável acionáveis;
- [x] contadores de integrações totais, saudáveis e bloqueadas;
- [x] contador de checkpoints pendentes;
- [x] contadores de evidências por estado canônico: planejado, tentativa, confirmação do provedor e QC;
- [x] drawers com composição baseada na resposta persistida;
- [x] links para conteúdo, campanha e integrações;
- [x] detalhes de credenciais sem tokens;
- [x] detalhes de evidência já sanitizados pela API;
- [x] foco de teclado e rótulos acessíveis;
- [x] typecheck do frontend.
- [x] correção de categorias impossíveis detectadas no primeiro teste E2E;
- [x] tratamento seguro de `contextFingerprint` nulo.

### Validação concluída

- [x] build de produção;
- [x] reiniciar app e API;
- [x] abrir os contadores com fixture autenticado;
- [x] confirmar filtros e contagens;
- [x] confirmar que nenhum segredo aparece;
- [x] validar desktop em 1440×1000;
- [x] validar mobile em 390×844;
- [x] confirmar ausência de erros após correção do fixture;
- [x] confirmar ausência de overflow horizontal;
- [x] remover integralmente o fixture de teste;
- [x] atualizar M02 para concluído.

### Provas do checkpoint

- entregáveis: total 4, previews 3, drawers geral e filtrado corretos;
- credenciais: total 2, saudável 1, bloqueada 1, sem exposição de segredo;
- checkpoints: 1 aprovação pendente com link para a campanha;
- evidências: 4 registros, um para cada estado canônico;
- todos os contadores expostos como botões acessíveis;
- nenhum provider, publicação, mensagem, IA ou cobrança acionado;
- cleanup confirmado sem usuário, workspace ou campanha residual.

## Unidade atual — M03 Drilldown de evidência

### Escopo inicial

- [ ] contrato de paginação;
- [ ] filtros por estado, subject type, período e entidade;
- [ ] ownership por workspace e campanha;
- [ ] ordenação determinística;
- [ ] timeline com IDs e timestamps exatos;
- [ ] links para entidade de origem quando houver rota real;
- [ ] detalhes sanitizados;
- [ ] estado vazio e erro honestos;
- [ ] desktop e mobile;
- [ ] testes de paginação, filtro, sanitização e isolamento.

## Protocolo obrigatório após cada desenvolvimento

1. atualizar data e checkpoint atual;
2. marcar somente itens sustentados por prova;
3. registrar comandos e testes executados;
4. registrar riscos e limitações;
5. atualizar estágio operacional e nível de maturidade afetados;
6. indicar o próximo checkpoint único;
7. não avançar se houver falha crítica ou alta;
8. não usar interface ou documento como prova de execução externa;
9. manter o `NEXOS_CAPABILITY_INDEX.md` sincronizado;
10. preservar os fluxos anteriores incorporados.

## Referências

- [`NEXOS_CAPABILITY_INDEX.md`](./NEXOS_CAPABILITY_INDEX.md)
- [`NEXOS_WORKFLOW_MAP.md`](./NEXOS_WORKFLOW_MAP.md)