# Execução e integrações — homologação de 13/10/2026

**Veredito: parcial.** Instagram/MAPA/Direct e pagamentos sandbox têm provas externas. Agendamento de campanha ainda não está implementado com confirmação por prévia; o estorno parcial continua pendente no Asaas. Não promovemos a campanha para execução externa nem oferta comercial.

## Provas atuais na Meta

Conta @agencianexosai consultada com a credencial persistida criptografada: HTTP 200. Post autorizado https://www.instagram.com/p/DeTIE6-DjHT/ consultado diretamente, ID 18121984933902161; uma publicação real anterior também permanece no banco. Não publicamos um novo post nesta sessão.

Usuário @professorbruceallan enviou comentário e Direct “mapa homologação 13”. Ambos foram processados automaticamente pelo callback real, sem sync manual ou replay injetado. Comentário recebido em 19:39:18.957 UTC e resposta pública enviada em 19:39:25.345 UTC; recibo público 18433752598197423. GET na Meta retornou HTTP 200, texto igual ao salvo e hidden=false. A resposta privada induzida pelo comentário tem recibo Send API em 19:39:20.404 UTC.

Direct recebido em 19:38:56.636 UTC e enviado em 19:38:57.926 UTC. GET das conversas/mensagens retornou HTTP 200; a nova mensagem de entrada foi encontrada, o ID de resposta enviado foi encontrado na Meta e o texto coincide com a requisição salva. Consulta usa token de Página e /{pageId}/conversations?platform=instagram; consultar essa edge no ID Instagram era apenas um erro do primeiro probe e foi corrigido no coletor.

A Página permanece inscrita no aplicativo para feed. As regras MAPA são determinísticas; isso comprova resposta por palavra-chave, não homologação geral de respostas de IA livre. Eventos antigos claimed/dead_letter foram preservados; não há certificação de que todas as falhas históricas foram resolvidas.

Webhooks públicos: Meta sem assinatura=401, vazio assinado=200, desafio de verificação=200 com challenge correto. Asaas sem token=401 e corpo vazio autenticado=200. Probes não continham eventos de negócio e não geraram mensagens, pagamentos ou créditos.

## Pagamentos, plano e saldo no Asaas sandbox

Só GET em https://api-sandbox.asaas.com/v3 com chave de homologação; nenhuma nova cobrança, compra, pedido de estorno ou mensagem ao suporte.

| Caso histórico reconsultado | Estado externo atual | Conciliação |
| --- | --- | --- |
| PIX pack R$85 | RECEIVED, HTTP 200 | Uma concessão de 500 créditos |
| Boleto pack R$85 | RECEIVED, HTTP 200 | Uma concessão de 500 créditos |
| PIX plano Agency R$9.990 | RECEIVED, HTTP 200 | Plano Agency ativo no workspace de teste; concessão incluída no livro |
| Cobrança originalmente usada no pedido de chargeback, R$87,98 | REFUNDED com refund DONE | Reversão única de 500 créditos; **não comprova ciclo chargeback HOLD/RELEASE** |
| Parcial de cartão R$43,99 | Refund PENDING, cobrança CONFIRMED | Saldo preservado; hold ativo; reversão não antecipada |

Workspace de teste: saldo 4.400, seis movimentos com cadeia coerente desde o saldo inicial e sem concessão duplicada dos quatro packs. Conta founder: saldo 0 preservado. Estes preços/casos são os planos/packs de homologação existentes; não certificam a futura oferta comercial de R$297/mês ainda provisória no briefing.

Encontrada falha na classificação da rota /api/billing/access: qualquer pagamento, inclusive pending/refunded, era apresentado como reason=paid. O teste HTTP reproduziu a falha. Corrigida a consulta para status paid. O novo teste passa para pending/processing/failed/refunded/cancelled/expired e paid. A política existente de acesso por plano atribuído, convite e admin foi preservada: esta correção não transforma a rota em nova política comercial de acesso.

## Agendamento: bloqueador real

schedulePostsForCampaign lança CAMPAIGN_SCHEDULE_CONFIRMATION_REQUIRED; o worker marca linhas antigas de campanha como falhas antes de chamar o provedor. Os testes passaram porque esse bloqueio é deliberado e protege contra publicação sem consentimento. **Isso não é prova de agendamento funcional.**

Próxima implementação: confirmação de data/horário, peça, conta e payload por prévia; registro durável vinculado ao Master Plan aprovado; revalidação no horário de envio; cancelamento e tratamento de resultado ambíguo sem publicar em duplicidade. Depois, testar em banco isolado e executar um post de homologação agendado com conteúdo e conta especificamente aprovados. A campanha real atual continua awaiting_approval; não alteramos sua aprovação.

## Testes e limites

16 regressões em PostgreSQL 17 + Redis descartáveis passaram: ownership/governança/publicação, bloqueio do scheduler legado, limites de transporte, chave natural, roteamento/retry de webhook, comentário/Direct MAPA, leitura de comentários, segurança de integração, plano/pack, token Asaas isolado, execução condicional e motivo de acesso pago. Testes de transporte usam provedores simulados; os readbacks Meta/Asaas acima são provas reais separadas. O boundary test usa fetch controlado com META_E2E_TEST_MODE=false para não substituir sua própria simulação por outra; a falha inicial foi configuração da bancada, não alteração de código do publisher.

Comando: node scripts/validate-execution-integrations.mjs. API typecheck/build passaram. Evidência estruturada em EXECUTION_INTEGRATIONS_VALIDATION_RESULTS.json. Sem migração ou push. Academy, vídeo/imagem, disparos de e-mail/WhatsApp, novos anúncios e oferta comercial fora desta sessão.

Próximo checkpoint: implementar a confirmação versionada do agendamento. Estorno parcial deve ser reconsultado até o provider concluir; não repetir um refund pendente.


## Atualização — estorno concluído em 13/10/2026

API canônica do pagamento pay_gl3wvdoscgq65dt9 agora retorna REFUNDED, com dois refunds DONE de R$43,99, total R$87,98. Não é apenas um parcial concluído: o valor integral foi devolvido em duas partes. Livro do NexOS confirma dois débitos de 250 créditos, com chaves distintas de versão 1/2: saldo 4.400 → 4.150 → 3.900. creditsReversed=500 e refundHold=false. Não solicitamos novo estorno nem editamos saldo; consultas somente leitura. Evidência em ASAAS_PARTIAL_REFUND_COMPLETION.json. Esta prova encerra a pendência financeira desse pagamento; falta implementar/homologar o agendamento.
