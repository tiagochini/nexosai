# Provedores de IA — evidência da campanha — 12/10/2026

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

Ainda falta fechar conciliação de créditos/custos, testes controlados de
timeout/indisponibilidade/retry/fallback e revisão de qualidade de conteúdos.
Não houve inferência adicional, alteração de dados, aprovação ou publicação.

[Resultados sem conteúdo privado](AI_PROVIDER_CAMPAIGN_VALIDATION_RESULTS.json).
Próximo checkpoint: conciliar consumo e créditos antes de certificar cobrança.
