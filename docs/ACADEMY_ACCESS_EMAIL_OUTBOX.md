# Fila durável de e-mails de acesso Academy

Atualização: 05/10/2026. Escopo: confirmação automática de pagamento por webhook.

## Funcionamento

A migração `0064_academy_access_email_outbox.sql` adiciona uma tabela com um
item único por compra. A confirmação, a conversão do lead e a criação desse
item acontecem na mesma transação. Se ela falhar, as alterações são desfeitas
juntas. Não há backfill nem reenvio de compras antigas.

O webhook apenas solicita uma tentativa depois do commit. Essa solicitação
pode se perder sem perder o item pendente. Fora do modo seguro local, o worker
consulta a fila ao iniciar e a cada minuto, em lotes de até 20. O bloqueio lógico
`scheduled → sending` no banco garante que só um processo reivindique cada
tentativa. Elegibilidade e adiamento usam o relógio do banco.

| Estado | Significado e ação |
| --- | --- |
| `scheduled` | Ainda não enviado. Worker pode reivindicar. Sem provedor configurado, aguarda 5 minutos e tenta novamente. |
| `sending` | Em andamento ou resultado desconhecido. Nunca é recuperado automaticamente por tempo decorrido. |
| `sent` | Provedor aceitou e devolveu comprovante. Não significa recebimento na caixa do cliente. |
| `failed` | Rejeição conhecida. Precisa de revisão, sem retry automático nesta etapa. |
| `skipped` | Compra não confirmada no momento da tentativa. Acesso não enviado. |

Uma queda após o commit, antes da reivindicação, permite retomada automática.
Após a reivindicação, não se sabe necessariamente se o provedor aceitou: o item
fica em `sending`. Consultar o provedor antes de qualquer reenvio. Isso também
vale se a aceitação ocorrer e a gravação do resultado falhar. Não há garantia de
entrega exatamente uma vez nem recuperação automática de resultados ambíguos.

## Segurança e operação

A fila guarda referência à compra, estado, tentativas, horários, ID do comprovante
e código de erro limitado. Não replica destinatário, código de acesso, HTML,
credenciais ou corpo de erros. Os dados da mensagem são lidos da compra somente
para enviar. O worker confere novamente se a compra está confirmada.

```powershell
pnpm --filter @workspace/api-server run academy:access-check
pnpm --filter @workspace/api-server run test:academy-access-outbox-db
```

A inspeção é somente leitura, com contagens e até 100 itens `sending`/`failed`,
sem destinatários, tokens ou conteúdo. Exit 0: sem itens nesses estados; 2: itens
em andamento/incertos ou falhos para conferir; 1: erro da inspeção. Não presume
que todo `sending` esteja abandonado. Carregar as variáveis privadas do ambiente
normalmente, sem incluí-las em comandos, documentação ou logs.

O modo seguro local existente continua ativo e desativa o worker automático,
assim como os outros schedulers. A fila permanece persistida; uma confirmação
interativa por webhook ainda solicita a tentativa imediata. Não foi habilitado
envio real nem alterada configuração privada durante os testes.

## Validação

Migração local aplicada e verificada: 173 tabelas públicas e 70 entradas de
histórico. Sem alteração de usuários/workspaces/campanhas existentes.
Testes com mocks cobrem unicidade, 16 workers concorrentes, comprovante persistido,
ausência de configuração/backoff, rejeição, resultado desconhecido e erro sem
persistência de conteúdo privado; rollback compra/fila e bloqueio de compra não
confirmada. Um processo novo retoma um item ainda não iniciado. Três processos
competem por outro item, o vencedor é encerrado pelo teste e o substituto não
reenvia o item incerto. Somente processos e UUIDs de fixtures são afetados.
As regressões de webhook, autorização, acesso, transporte e logs também passaram.

## Limites

Rotas de reenvio, confirmação administrativa e brindes ainda usam seus fluxos
anteriores; não recebem automaticamente essa garantia. Compras históricas
confirmadas não criam itens por replay. Pendentes: ferramenta autorizada de
conciliação/retry auditado, migração desses outros fluxos, indicadores operacionais,
reversões/revogação e teste ponta a ponta com provedores em sandbox.
Para rollback de aplicação, manter a tabela e seus itens; não apagar a fila.
