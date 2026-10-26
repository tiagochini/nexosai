# Provedores de IA — homologação funcional concluída — 12/10/2026

Consulta somente leitura da campanha founder e execução do validador real de
completude confirmaram 21/21 campos obrigatórios, nenhum ausente, conclusão
do chat persistida e 40 mensagens. Modelo continuous_sales, trilha
not_applicable, período 30_days. Estratégia salva; status awaiting_approval.

O gateway registrou gerações reais nesta campanha:

| Provedor | Modelo | Chamadas | Tokens |
| --- | --- | ---: | ---: |
| Anthropic | claude-opus-4-5 | 54 | 1.459.144 |
| OpenAI | gpt-5.5 | 1 | 4.797 |
| Gemini | gemini-2.5-flash | 22 | 498.767 |

Essas contagens incluem chamadas de briefing e agentes da campanha; não
representam apenas uma execução do briefing. Há custos calculados e créditos
calculados em ai_provider_logs para os três provedores. O ledger registra
24 débitos Anthropic (3.530 créditos) e seis Gemini (15 créditos). Isso não
certifica conciliação entre chamadas, débitos e faturas dos provedores.

A evidência atual supera os checkpoints antigos que tratavam geração no
gateway como pendente. Autenticação e geração real dos três provedores,
briefing completo e estratégia persistida estão comprovados nesta campanha.

## Fechamento

O usuário refez manualmente o briefing e confirmou funcionamento nesta conversa.
A coleta atual validou 77 chamadas com totais de tokens consistentes e nenhum
registro sem tokens/custo/créditos calculados. Nenhuma chave de idempotência
duplicada foi encontrada nos débitos desta campanha. Hashes do briefing e da
estratégia permitem identificar os artefatos sem expor seu conteúdo no relatório.

Reexecutado `test-canonical-completion-chain.ts`: PASS nas 63 combinações de
credenciais, troca após erros 429/503/timeout simulado, ausência de credenciais
e falha de todos os provedores. Reexecutado `test-project-execution-isolation.ts`:
PASS em projetos concorrentes, configurações aninhadas e limpeza após falha.
São testes offline da cadeia real com erros injetados, sem interrupção real
dos serviços e sem chamadas pagas adicionais.

**Status: homologação funcional dos provedores concluída.** Critérios desta
tarefa atendidos: respostas reais, briefing completo e salvo, consumo registrado,
aceite manual e troca/erros verificados por testes controlados.

Conciliação completa entre chamadas, débitos e faturas fica explicitamente
na tarefa **Segurança e créditos**; a matriz completa de revisão de conteúdo
fica em **Qualidade e fechamento**, conforme cronograma de cinco tarefas.
O fechamento não certifica essas duas tarefas nem disponibiliza automaticamente
a oferta comercial. Não houve alteração de dados, aprovação ou publicação.

[Resultados sem conteúdo privado](AI_PROVIDER_CAMPAIGN_VALIDATION_RESULTS.json).
Próximo checkpoint: continuar a homologação da campanha completa; conciliar
consumo e créditos na tarefa correspondente antes de certificar cobrança.
