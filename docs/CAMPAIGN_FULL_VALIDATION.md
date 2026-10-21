# Campanha completa — validação de 13/10/2026

**Resultado: validação executada; campanha ainda não homologada de ponta a ponta.**
Escopo: campanha founder Primeiro Lançamento NexOS 2026, Etapa 1 de pesquisa.
Consulta ao banco em transação somente leitura, revisão no navegador com sessão
do usuário e regressões com fixtures em PostgreSQL/Redis Docker isolados.

## O que foi comprovado

| Critério | Evidência |
| --- | --- |
| Briefing completo | 21/21 campos, 40 mensagens, conclusão persistida |
| Retomada e correção | Sessão reaberta mostra briefing 100% e compositor; regressão de edição salva histórico e rascunho canônico |
| Contexto e estratégia | continuous_sales, not_applicable, 30_days, estratégia persistida e ressalvas presentes |
| Materiais salvos | Oito pacotes canônicos, expandidos em 77 unidades na interface; sete pacotes pendentes, um aprovado anteriormente |
| Revisão | Conteúdo por plataforma e página de interesse abrem no navegador; quatro checkpoints pendentes visíveis |
| Agentes | 31 concluídos, quatro esperando aprovação, dois com falha |
| Retomada de conteúdo | Teste interrompe após persistência e retoma sem repetir etapas/créditos em banco isolado |
| Governança | Testes Control Room e diff de versões passaram em fixtures; nenhuma aprovação da campanha real executada |

As 77 unidades de apresentação não são 77 registros independentes: são itens
expandidos dos oito pacotes de conteúdo. A página de interesse é uma prévia
do material gerado; abrir a prévia não comprova formulário/agendamento/CRM
operacionais, que continuam pendentes no briefing.

## Correções encontradas e verificadas

- Conteúdo usava capítulos fixos de lançamento de sete dias e metas sintéticas
  de alcance/leads. Agora aquisição contínua mostra o período do briefing,
  inventário real, calendário parcial e condições, sem abertura/fechamento de
  carrinho. Cartões e cronograma contínuos não usam faixas de performance
  sintéticas ou labels fixos de carrinho.
- API de agentes usa agentType, enquanto o mapa esperava agentRole. A leitura
  foi normalizada, mantendo compatibilidade com respostas antigas. Navegador
  confirmou nomes dos agentes, 31/37 concluídos e falhas visíveis.
- Nenhum texto gerado foi reescrito ou aprovado por esta validação. A comparação
  dos snapshots confirmou briefing, estratégia, conteúdo e checkpoints intactos.

## Pendências antes da homologação completa

1. **Resolvido em 14/10/2026:** o calendário e o plano de mídia foram regenerados
   e uma leitura nova do banco confirmou os dias 1–30 em ambos. Veja
   [CALENDAR_DURATION_CORRECTION_RESULTS.json](CALENDAR_DURATION_CORRECTION_RESULTS.json).
   Os artefatos seguem `pending_approval`; cobertura completa não equivale a
   aprovação editorial.
2. stories_sequence e analytics terminaram com indisponibilidade de provedor.
   Recuperar somente os passos com falha, preservando os oito pacotes existentes.
3. Os dois criativos continuam em concept_ready, sem preview nem final, com
   erro registrado. O fallback implementado ainda precisa entregar imagem real.
4. Copy de pesquisa contém afirmações sem comprovação e capacidade hipotética
   transformada em escassez afirmativa. Revisão necessária antes da aprovação.
5. Sete pacotes e quatro checkpoints continuam pendentes. Há zero versões
   operacionais materializadas para esta campanha; materialização/aprovação
   devem ser verificadas antes de qualquer execução externa.

O navegador mostra saldo NexOS zero. Não foi usado o botão de recarga, não
foi concedido saldo e não houve inferência paga adicional. A falta de saldo
atual não prova a causa histórica de cada falha; a recuperação requer verificar
também acesso/saldo dos provedores.

## Ajustes de conteúdo propostos para revisão

| Local | Problema | Redação sugerida |
| --- | --- | --- |
| Terceiro e-mail | “Nossa pesquisa mostra” sem evidência de pesquisa concluída | “Nossa hipótese é que esse retrabalho merece ser investigado. Queremos ouvir como isso aparece na sua rotina.” |
| Sétimo e-mail | “as vagas estão se preenchendo” sem agendamentos comprovados | “Estamos convidando produtores para demonstrações de pesquisa. Ao agendar, confirmaremos a disponibilidade para uma sessão com o contexto do seu produto.” |
| Página de interesse | Limite hipotético de capacidade apresentado como urgência factual | “Participe de uma demonstração de pesquisa. A disponibilidade de horários será confirmada após seu contato.” |
| Plano orgânico | Placeholders de vagas, metas de seguidores e contagens regressivas | Manter como hipóteses internas; usar em comunicação somente dados reais e confirmados. |

São propostas, sem alteração automática dos materiais existentes. O levantamento
não substitui a matriz completa de qualidade da tarefa Qualidade e fechamento.

## Verificação técnica

- Três testes de contrato de agentes/checkpoints: PASS.
- Renderização de aquisição contínua (30 dias, cobertura 21, sem carrinho/KPI sintético): PASS.
- Docker: intake editing, content checkpoint resume, Control Room e version diff: PASS.
- Typecheck e build frontend: PASS, 485,4 KiB iniciais para limite de 500 KiB.
- Containers exclusivos desta validação removidos; Redis de homologação preservado.

[Resultados sem conteúdo privado](CAMPAIGN_FULL_VALIDATION_RESULTS.json).
Captura privada da tela corrigida: .local/campaign-validation/content-continuous.png.
Próximo checkpoint: corrigir cobertura e afirmações dos materiais para revisão,
depois recuperar os passos que falharam e conferir os criativos reais.
Nenhuma publicação, anúncio, mensagem externa, cobrança nova ou push.

## Atualização de qualidade — 16/10/2026

O item de cobertura foi resolvido, conforme a evidência posterior acima. A
revisão de qualidade e fechamento continua parcial: os materiais reais ainda
precisam de revisão humana ligada ao hash da versão exata; não há evidência
posterior de recuperação de `stories_sequence` e `analytics`; e a validação de
segurança/créditos mantém bloqueios próprios. O fechamento consolidado e os
resultados de build/regressão estão em
[LAUNCH_QUALITY_CLOSEOUT_2026-10-16.md](LAUNCH_QUALITY_CLOSEOUT_2026-10-16.md).
