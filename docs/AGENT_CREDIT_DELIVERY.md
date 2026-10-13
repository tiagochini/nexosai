# Segurança e créditos dos agentes — correção e validação, 13/10/2026

**PASS no escopo dos agentes de campanha.** Resolvidos os três bloqueadores registrados em SECURITY_CREDITS_VALIDATION.md. Não é certificação global de segurança nem autorização de publicação, gastos ou cobranças comerciais.

## Comportamento implementado

- runAgent e runAgentWithCritique usam o mesmo serviço de créditos, com conta/campanha/ação/valor e chave da operação verificados, bloqueio por estorno, dívida e isenção de administrador/conta ilimitada.
- Saldo zero impede novas chamadas pagas. O custo dinâmico definitivo é conferido novamente após receber os tokens: se o saldo foi consumido ou um estorno começou durante a inferência, nenhum débito parcial é feito. O resultado fica pendente para retomada depois de regularizar o saldo/bloqueio.
- Em runAgent, débito, resultado completo e checkpoint de aprovação são gravados na mesma transação. Erro na gravação desfaz o débito. Em critique, débito e entrega completa também são atômicos; checkpoints intermediários preservam o andamento.
- Resultado já salvo é recuperado pela mesma chave sem nova inferência e sem novo débito. Uma regeneração deliberada usa nova chave através do contexto de regeneração existente.
- Erro posterior à entrega não apaga o resultado nem marca a entrega persistida como falha. Pode ser retomada sem cobrar de novo.
- Falha antes da conclusão da transação preserva o resultado gerado em registro pendente, quando o banco está acessível. Se todo o banco estiver indisponível, não há transação de débito confirmada; preservação desse resultado em outro armazenamento não é certificada.
- Créditos consumidos estimados são distinguidos de débito efetivo/isento. Retomadas e isenções retornam zero créditos cobrados; uso de provedor continua registrado separadamente.
- Removida a resposta fictícia automática para erro de autenticação do provedor. Simulação exige DRY_RUN_MODE explícito.

Não usamos um crédito adicional de estorno para falha de persistência: a transação desfaz o débito original, impedindo estornos duplicados e mantendo o livro coerente.

## Evidências executadas

Onze regressões de segurança/créditos passaram em PostgreSQL 17 + Redis descartáveis, sem credenciais reais. Três regressões de controle/retomada da campanha também passaram. API typecheck e build passaram. Último teste específico repetido após os ajustes finais de metadados.

| Cenário | Resultado observado |
| --- | --- |
| Geração via adaptador Anthropic com HTTP controlado | Resultado completo, saldo, débito e aprovação persistidos |
| Repetição da mesma operação | Mesmo resultado/checkpoint; zero novas chamadas e débitos |
| Oito gerações concorrentes com a mesma chave | Um débito; soma de cobranças retornadas equivale a uma operação |
| Trigger PostgreSQL provoca falha após INSERT do débito, ao salvar a entrega | Saldo e livro preservados; resultado pendente; retomada cobra uma vez sem nova inferência |
| Falha de registro auxiliar depois do commit | Entrega completed recuperável; sem nova chamada ou cobrança |
| Saldo zero, dívida negativa e refundHold | Bloqueio antes de chamar provedor; dívida/estorno bloqueiam conta ilimitada também |
| Conta ilimitada | Consumo registrado com isenção; saldo mantido e cobrança retornada zero |
| Saldo esgotado durante a chamada | Sem saldo truncado/débito parcial; resultado retomado sem nova chamada |
| Estorno começa durante a chamada | Débito bloqueado; liberação permite retomada do resultado salvo |
| Revisão em três etapas | Débito compartilhado único, entrega completa e retomada sem chamadas |
| Falha de entrega na revisão | Rollback de débito e recuperação da entrega sem inferência adicional |
| Consulta de revisão por workspace alheio | Rejeição antes de recuperar resultado ou chamar provedor |

Testes externos reais de infraestrutura: verificação SQL READ ONLY passou; depois do reinício /api/livez, /api/readyz e https://agencianexos.vip responderam 200. A conta founder manteve saldo 0, modo ilimitado ativo e os mesmos 35 registros/zero chaves duplicadas. Não editamos dados reais de campanhas ou materiais.

## Reprodução e limites

Executar node scripts/validate-security-credits.mjs com Docker e a imagem nexos-api:p3-test preparada. Logs privados em .local/security-credit-evidence; resultados e hashes do código em AGENT_CREDIT_DELIVERY_RESULTS.json. Nenhuma migração necessária.

Imagens/vídeos, chamadas diretas de SDK fora destes runners, conciliação com a fatura dos provedores, transferências reais e cargas de produção ficam fora desta certificação. Os testes de provedor usam respostas HTTP controladas e persistência real no banco descartável, não uma nova compra/inferência paga.

Próximo checkpoint do lançamento: concluir a validação da campanha (cobertura dos 30 dias, agentes com falha, revisão dos materiais e aprovação da Etapa 1). A homologação técnica de segurança/créditos destes runners está concluída. Sem push.
