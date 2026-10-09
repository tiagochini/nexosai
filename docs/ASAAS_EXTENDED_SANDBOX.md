# Homologação Asaas: PIX, boleto, estorno parcial e chargeback

Verificação em 09/10/2026. Esta jornada usa exclusivamente Asaas sandbox,
Supabase de homologação e uma conta comum com workspace separado. Não utiliza
dinheiro real nem credenciais de produção. A homologação completa permanece aberta.

| Cenário | Prova externa | Resultado |
| --- | --- | --- |
| PIX de R$85 / pack de 500 | Emissão pela API pública, QR Code, confirmação no painel, GET canônico `RECEIVED`, callback real e uma concessão de 500 créditos | Passou |
| Boleto de R$85 / pack de 500 | Emissão pela API pública, linha digitável, confirmação no painel, GET canônico `RECEIVED`, callback real e uma concessão de 500 créditos | Passou |
| Cartão rejeitado para plano e pack | Cartões oficiais de rejeição; HTTP 400 com mensagem; nenhuma linha de pagamento e nenhum benefício novo | Passou |
| Estorno parcial PIX de R$42,50 | Autorização crítica executada após aprovação humana; histórico canônico `CANCELLED`, inclusive no reteste com nova chave sandbox; nenhum refund `DONE` e nenhuma reversão de créditos | Bloqueado pelo provider; motivo não retornado |
| Estorno parcial de cartão | Reteste de R$43,99 aceito em 09/10 com nova chave; refund canônico `PENDING`, sem reversão antecipada | Aguarda processamento; não repetir solicitação |
| Chargeback de pack | Solicitação aprovada pelo usuário enviada a `integracoes@asaas.com.br`; compositor confirmou “Mensagem enviada”; cobrança ainda `CONFIRMED` | Aguarda simulação pelo suporte Asaas |
| PIX de R$9.990 / plano Agency | Painel produziu `CONFIRMED` com repasse futuro; plano permanece Solo, sem créditos adicionais | Proteção passou; liquidação desse plano ainda pendente |

A nova chave foi configurada apenas no perfil privado de homologação. Consultas
autenticadas e solicitações de refund foram aceitas; o PIX voltou a `CANCELLED`
após autorização. A troca não resolveu o cancelamento e não comprova uma causa
por permissões. O backend foi reiniciado; `/api/healthz` e `/api/readyz` responderam
HTTP 200. Saldo preservado em 2.900; founder inalterado.

O teste encontrou e corrigiu a falta de CPF/CNPJ no checkout de PIX/boleto.
A interface agora solicita o documento; as rotas validam presença/formato,
normalizam pontuação e o encaminham ao provider. O Asaas valida o documento.
O documento não é persistido na metadata financeira desta correção.

Três repetições dos eventos não duplicaram benefícios. O histórico da conta
retornou apenas seu workspace; consultas pelo founder aos pagamentos de outro
workspace retornaram 404. Plano/saldo do founder permaneceram inalterados;
sessões da conta de testes foram revogadas. As cobranças necessárias às próximas
etapas foram preservadas, com histórico e saldo fictício na conta isolada.

[Resultados sanitizados](./ASAAS_EXTENDED_SANDBOX_RESULTS.json) e
[regressões Docker locais](./BILLING_LOCAL_VALIDATION.json). API/frontend com
tipos verificados; frontend compilado e limite do bundle aprovado. A regressão
de ativação cobre envio do documento ao builder, estado pendente, recusa de
`CONFIRMED` para PIX/boleto e concessão única sob notificações concorrentes.
Simulações locais de chargeback não substituem prova canônica externa.

## Retomada

O journal e as credenciais ficam somente em arquivos ignorados `.local`.
Consultar `node .local/asaas-advanced-journey.mjs inspect` antes de qualquer
mutação. Não solicitar outro refund enquanto existir um pendente.

1. Diagnosticar com o Asaas o cancelamento do refund PIX após autorização.
   O reteste com nova chave também terminou `CANCELLED`; não repetir indefinidamente.
   O histórico não retornou motivo. Saldo preservado: 2.900 créditos.
2. Após resolver o bloqueio, esperar refund `DONE`, conferir reversão de 250 créditos, saldo 2.650 e
   pagamento ainda `paid`. Repetir eventos autenticados e conferir saldo/ledger
   inalterados. A solicitação aceita e o rótulo do painel não bastam como prova.
3. Aguardar processamento do parcial de cartão já aceito em 09/10/2026.
   Não repetir enquanto houver refund PENDING. Cobrança de R$87,98; parcial
   R$43,99; somente DONE permite validar a reversão esperada de 250 créditos.
4. A solicitação de chargeback já foi enviada com autorização humana explícita.
   Aguardar resposta do suporte; não reenviar o mesmo pedido. Comprovante privado:
   `.local/asaas-chargeback-request-sent.jpg`. Nenhuma chave/token foi enviada.
5. Nas etapas aplicadas pelo Asaas, conferir o GET canônico e o webhook real:
   hold remove os 500 créditos originais uma vez; recuperação restaura uma vez.
   Conferir isolamento, replays e ledger e atualizar as evidências.

Envio real Academy e liberação de produção seguem seus próprios checkpoints.

## Referências oficiais

- [FAQ do sandbox e cartões oficiais](https://docs.asaas.com/docs/faq-sandbox).
- [Recursos testáveis: chargeback exige solicitação ao suporte](https://docs.asaas.com/docs/o-que-pode-ser-testado).
- [Ações críticas no sandbox](https://docs.asaas.com/docs/como-testar-a%C3%A7%C3%B5es-cr%C3%ADticas).
- [PIX pode ficar CONFIRMED em bloqueio preventivo](https://docs.asaas.com/reference/create-new-payment).
- [Estornos e valores parciais](https://docs.asaas.com/reference/estornar-cobranca).

## Fluxo administrativo implementado em 09/10/2026

Em `/admin`, aba Pagamentos, o administrador solicita o valor do estorno.
A aplicação grava a reserva antes da chamada Asaas: saldo visível mantido,
consumo de todo o workspace bloqueado. O aviso permanece nos pagamentos e
na página Créditos; somente o administrador acessa criação/consulta. Não há
rota ou botão de cancelamento para o usuário. Aprovação crítica é feita no Asaas.

Use **Consultar estorno** após a ação no Asaas. DONE desconta os créditos
proporcionais uma vez. CANCELLED comprovado no histórico da solicitação exata
libera a reserva via consulta administrativa, sem descontar saldo. Falha, timeout
ou ausência de prova mantêm o bloqueio e impedem nova solicitação automática.
Créditos ilimitados, chat, visão e transcrição também respeitam o bloqueio.
Aviso ao administrador é interno ao painel; não depende de envio de e-mail.

O parcial de cartão já existente foi consultado pela rota administrativa: saldo
2.900 preservado, `blockedByRefund: true`, usuário comum recebeu 403 ao tentar
criar/consultar administrativamente um estorno. Não foi criado outro refund.
Testes locais usam PostgreSQL Docker descartável e providers simulados.
