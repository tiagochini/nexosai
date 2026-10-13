# Criativos — fallback de imagens — 13/10/2026

A cadeia de texto não era usada pelo gerador de criativos. O erro de saldo
OpenAI interrompia preview, final e regeneração sem tentar Gemini.

Os três caminhos agora usam um gerador compartilhado. Ordem dos provedores
configurados: OpenAI nativa (gpt-image-1), Gemini nativo
(gemini-2.5-flash-image), integração OpenAI compatível. Credenciais ausentes
são puladas; o processo não volta a um provedor já tentado. SDK OpenAI sem
retries internos; HTTP de ambos tem limite de 90 segundos por tentativa.

Erros de saldo/limite, indisponibilidade, timeout ou resposta sem imagem
avançam a cadeia. Só um arquivo raster com assinatura PNG/JPEG/WebP é aceito;
texto ou placeholder SVG não viram sucesso. Bloqueio de segurança não muda
de provedor. Falha total retorna erro explícito com registros técnicos seguros.
Versão final sem arquivo retorna a preview_ready, sem finalUrl/approvedAt;
sucesso limpa o erro antigo preservando os demais metadados do criativo.

A cobrança existente continua por operação, fora da cadeia: trocar de
provedor não insere outra dedução de créditos NexOS. Estorno/conciliação
de operações que falham completamente permanecem na revisão de créditos;
esta alteração não certifica faturamento nem qualidade visual equivalente
entre modelos. Os provedores podem ter custos e resoluções diferentes.

## Evidência

`test-creative-image-fallback.ts` passou com saldo 429, 503, timeout,
resposta vazia, falha total, erro sanitizado, bloqueio de segurança e
decodificação Gemini. Também executou os adaptadores HTTP reais com respostas
injetadas: OpenAI 429 seguido de Gemini 200 contendo PNG, exatamente duas
solicitações. Nenhuma requisição externa ou imagem paga foi gerada no teste.
Tipos API/app, builds API/app e testes das mensagens de erro passaram.

Contrato Gemini consultado na documentação oficial:
https://ai.google.dev/gemini-api/docs/generate-content/image-generation?hl=en

**Estado:** implementação e testes controlados aprovados; entrega de uma
imagem real por fallback ainda precisa ser homologada na conta configurada.
O saldo/acesso Gemini não é comprovado por chamadas anteriores de texto.
Próximo checkpoint: repetir um preview explicitamente pelo usuário e conferir
imagem entregue e provedor usado. Sem publicação e sem push.
