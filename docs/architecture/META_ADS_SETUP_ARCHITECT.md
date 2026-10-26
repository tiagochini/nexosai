# Arquiteto de setup Meta Ads

O agente canônico de planejamento é o Traffic Intelligence. O pipeline salva a
resposta em `targetingData.trafficPlan`; o campo `metaSetupArchitect` traz o
diagnóstico e as dez seções do plano. O Media Buyer legado continua produzindo
um artefato de planejamento de mídia, enquanto o Traffic Intelligence controla
a recomendação de setup e a prontidão de campanha.

## Diagnóstico e prontidão

Antes de considerar um setup final, o plano registra volume semanal do evento de
otimização, evidência de Pixel/CAPI e deduplicação, capacidade criativa,
orçamentos mensal e diário, modelo de negócio e ciclo de venda, fase da conta e
restrições de marca/legais/região/posicionamento. Cada resposta inclui origem,
confiança e estado. O fluxo não considera completo um orçamento sem período e
limite diário, nem uma descrição de tracking sem evidência de Pixel, CAPI,
`event_id`, deduplicação e comparação com backend.

Campos ausentes produzem uma análise preliminar com perguntas, clearance
bloqueado e campanha não pronta. A decisão é aplicada no código depois do
modelo, para que texto gerado não possa remover o bloqueio. Event Match Quality
fica como “não verificado” sem valor e fonte confiável da Meta. Uma pontuação
interna nunca é apresentada como EMQ.

Tracking declarado como fraco mantém a recomendação em revisão condicional,
reduz o score de prontidão e exige correção antes de recomendar escala agressiva.
Um diagnóstico incompleto também bloqueia a compilação de um plano de
lançamento Meta, além dos requisitos de aprovação e conta já existentes.

## Regras de recomendação

Volume de conversões, learning, orçamento, número de públicos e janelas de
remarketing são heurísticas ajustáveis, justificadas pela evidência do cliente.
O agente não deve inventar benchmark, conversão, EMQ, ROAS, CPA, tamanho de
audience ou configuração da conta. Recomendações de arquitetura e criativo são
propostas; capacidades não suportadas ou não lidas de volta são identificadas
como indisponíveis ou não verificadas.

A saída `metaSetupArchitect.sections` cobre resumo executivo, diagnóstico,
arquitetura, configuração Campaign → Ad Set → Ad, públicos/exclusões,
Advantage+ Creative seletivo, otimização/aprendizagem, checklist, riscos e
próximos passos nos dias 7 e 14. O briefing exibe as lacunas e perguntas para o
usuário.

Planejamento não executa chamadas para criar ou ativar ativos Meta. A execução
permanece submetida ao Master Plan aprovado, escopo do workspace, autorização,
aprovação humana, dry-run, auditoria e estado pausado do fluxo de lançamento.

## Referências técnicas

O treinamento original contém heurísticas datadas e afirmações de produto. Elas
não foram convertidas em requisitos da API ou bloqueios universais. As páginas
oficiais são as fontes a consultar antes de adicionar uma validação técnica; a
documentação do Marketing API respondeu com limitação de acesso durante esta
implementação.

- [Meta Marketing API](https://developers.facebook.com/docs/marketing-api/)
- [Conversions API: deduplicar eventos de Pixel e servidor](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/)
- [Meta Business Help: fase de aprendizado](https://www.facebook.com/business/help/112167992830700)

Não foi homologada uma conta Meta real nesta implementação.
