# Correção da duração do calendário

O briefing da campanha Primeiro Lançamento NexOS 2026 armazena `campaign.timeline: 30_days`, mas os agentes consultavam `campaign.durationDays` e recorriam a 21 dias. A retomada reutilizava peças salvas sem comparar a cobertura.

Correção: resolver compartilhado prioriza timeline canônico; calendário em blocos de até sete dias com chave de recuperação distinta; validação exige cada dia de 1 até a duração. Plano de mídia exige a mesma cobertura. Retomada regenera peças incompatíveis no mesmo registro, preservando o material antigo em caso de falha da geração e invalidando aprovação quando substituído.

Verificação: test-campaign-duration.ts passou (duração canônica e legada, 1/7/8/21/30/45 dias, últimos dois dias, lacunas, duplicação que deixa dia ausente, dias fora do intervalo, escopo aninhado de recuperação); typecheck e build passaram. Regeneração real concluída: calendário e mídia têm entradas para todos os dias 1–30. Leitura fresca do banco confirmou cobertura, e os hashes dos conteúdos estão em CALENDAR_DURATION_CORRECTION_RESULTS.json. Os mesmos IDs de peças foram mantidos, ambos pending_approval; campanha awaiting_approval. As três regressões de retomada/control room passaram e readyz local/público retornou 200. Cobertura não equivale à aprovação editorial. Não houve autorização de publicação, anúncios ou cobrança.
