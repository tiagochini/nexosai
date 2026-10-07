# Verificação do comentário MAPA — 07/10/2026

O processador ignorava comentários Instagram com `value.id`, `value.text` e
`value.media.id`: o teste de integração retornava zero chamadas de resposta.
Corrigida a normalização desses campos, preservando o formato anterior de
Instagram e o formato Facebook. O nome também aceita `from.username`.

Verificação executada com código atual montado em leitura na imagem Linux
`nexos-api:p3-test`, PostgreSQL 17 descartável `nexos_p3` e transporte Meta
simulado em memória. Nenhuma conexão Supabase ou mensagem real foi feita.

- `test-mapa-comment-db.ts`: PASS para MAPA, mapa e frase com MAPA/pontuação/emoji.
- A configuração explícita da fixture `socialModerationConfig.immediateKeywordReplies`
  gerou uma resposta pública e uma privada habilitada por comentário.
- Texto esperado, mídia original, registro da ação e duas evidências de envio
  com identificador simulado foram conferidos no banco.
- Repetir o mesmo webhook não reenviou; conta desconhecida não usou a resposta
  do workspace existente; o workspace do segundo usuário ficou sem ações.
- `test-meta-webhook-routing.ts`: PASS para os formatos Instagram novo/anterior,
  Facebook e exclusão de comentários removidos/entregas de DM.
- Infraestrutura descartável removida após a execução.
- TypeScript da API e scanner de segredos: PASS.

O teste passa pelo processador de entrega já verificada e pela implementação
real de moderação/envio, com somente o transporte externo simulado. Não exercita
a assinatura HTTP neste checkpoint, a sequência automática `dmResponseFlow`
dos posts, IA, nem confirma aprovação/permissões ou recebimento no Instagram.
Esta evidência também não certifica o isolamento completo de todos os projetos.

Regressão incluída em `scripts/test-p3-local.mjs`; a suíte P3 completa e a CI
remota não foram executadas neste checkpoint. Próximo checkpoint: homologar
o comentário e o recebimento com conta Meta autorizada e configuração real.
