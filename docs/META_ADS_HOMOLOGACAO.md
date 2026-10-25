# Homologação das correções Meta Ads

## Escopo implementado nesta rodada

- Regras de otimização Meta salvas por workspace/conta, com agenda de 15 a 1.440 minutos e janela de análise entre 1 e 30 dias. Avaliação compara os insights sincronizados e cria alertas persistentes no NexOS, sem editar campanha, conjunto ou anúncio. Alertas repetidos na mesma janela são deduplicados. A notificação é in-app; envio por e-mail/push não foi adicionado.
- Inspeção de experimento calcula por anúncio impressões, cliques, gasto, conversões identificadas em Purchase/Lead/CompleteRegistration, CTR, CPC, CPA e ROAS. O resultado é guardado em `meta_experiments.evidence`. Para o split test legado, a comparação é descritiva e NexOS não declara vencedor; somente a Meta pode fornecer resultados estatísticos oficiais quando disponíveis. O teste usa 20 conversões por variante como referência operacional mínima de amostra, não como prova de significância.
- Integração de eventos de compra/checkout documentada para backend de clientes usando o endpoint de ingestão já existente, chave opaca de dataset, consentimento, evento idempotente e deduplicação browser/server pelo `eventId` compartilhado. O passo que instala o envio no ERP/checkout depende de acesso e mudança no sistema de cada cliente.
- Públicos atuais: website, CRM consentido, engajamento de página/Instagram e lookalike de origem permitida. O NexOS continua exigindo catálogo/conjunto de produtos pré-existente. A automação de criativo agora permite opt-in para `image_animation`, enhancement nativo da Meta que pode animar criativo de imagem quando a conta/criativo forem elegíveis; isso não gera um arquivo de vídeo para download. Gestão do feed de catálogo continua não implementada.

## Passo a passo

1. **Aplicar a migration `0077_paid_media_optimization_rules.sql`** no banco de homologação através do comando `node lib/db/scripts/apply-migrations.mjs`, com `DATABASE_URL` apontando explicitamente para homologação. Na sessão de implementação essa variável estava ausente, portanto a migration ainda não foi aplicada.
2. Inicie o API e a aplicação usando o build corrente. Confirme em `GET /api/paid-media/optimization-rules` que a rota exige login e retorna lista vazia para workspace sem regras.
3. Em **Mídia paga → Integrações & Sync**, sincronize uma conta Meta de teste e os insights de campanha. Confirme que a conta está selecionada e que o intervalo avaliado já tem dados completos até ontem.
4. Abra **Mídia paga → Regras e alertas**. Cadastre uma regra com nome, conta e pelo menos um limite (CPA, ROAS ou CTR). A regra deve nascer pausada.
5. Clique **Ativar** e confirme a regra. O worker executa a avaliação na janela seguinte (até 1 minuto para buscar regras vencidas, respeitando o intervalo configurado). Não há chamadas de mutação à Meta durante a avaliação.
6. Para validar alerta, use uma regra cujo limite seja deliberadamente excedido pelos insights disponíveis. Confira `GET /api/paid-media/optimization-alerts`, dados e datas da janela, marque como lido e rode a mesma janela novamente: não deve criar duplicata. Pause a regra e confirme que não surgem alertas novos.
7. Prepare um experimento A/B com dois anúncios pausados, aprove e registre somente se a conta de homologação autorizar essa operação. Aguarde o período do estudo, clique **Conferir registro** e valide as métricas A/B persistidas e exibidas. Compare os números com Insights da Meta para o mesmo período e atribuição. A UI deve continuar mostrando que não há vencedor estatístico confirmado.
8. Para compra/checkout, cadastre o dataset de teste no NexOS e use a chave somente no backend de homologação do checkout. Envie `Purchase` com `eventId` estável, horário UTC, valor/moeda e `marketingConsent: true`, usando somente identificadores permitidos. Reenvie a mesma compra e confirme que aparece como duplicada e não gera segundo envio. Envie um evento sem consentimento e confirme `consent_withheld`. Confira recibos no NexOS e a chegada no Events Manager; recibo local não equivale a confirmação Meta.
9. Faça uma passada visual nas abas Públicos Meta e Lançamentos. Confirme suporte atual para website, lista CRM consentida, página/Instagram e lookalike; use somente públicos de teste com consentimento. No Master Plan, valide `image_animation` desligado por padrão e só opte por ele após conferir elegibilidade e resultado no anúncio pausado. Confirme que feed de catálogo permanece não gerenciado no fluxo atual.
10. Não ative campanhas, anúncios ou orçamento de produção durante esta homologação. Para testar operações reais de estudo/audiência, use uma conta de teste e autorização específica; os checks automatizados desta rodada não chamaram a Graph API.

## Evidências executadas

- TypeScript API: `tsc -p artifacts/api-server/tsconfig.json --noEmit` — passou.
- TypeScript app: `tsc -p artifacts/app/tsconfig.json --noEmit` — passou.
- `artifacts/api-server/src/scripts/test-meta-advanced-workflows.ts` — passou em armazenamento simulado, sem banco ou Graph API reais; inclui métricas derivadas e a regra de não declarar vencedor.
- O mesmo teste avançado confirma que `image_animation` é aceito como enhancement explícito.
- `artifacts/api-server/src/scripts/test-optimization-rules.ts` — passou em critérios de gasto mínimo, CPA/ROAS/CTR e amostra sem denominador.
- `artifacts/api-server/src/scripts/test-paid-media-event-receipts.ts` — passou em consentimento, idempotência e entrega simulada dos eventos.
- Migration 0077 — arquivo criado, não executado porque `DATABASE_URL` não estava configurado na sessão.
