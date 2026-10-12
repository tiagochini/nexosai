# Criativos — erro de saldo da OpenAI — 12/10/2026

A tela mostrava falta de chave/acesso ao DALL-E 3 para qualquer imageError.
Consulta somente leitura do criativo founder confirmou erro da OpenAI 429,
com indicação de ausência de créditos na conta da API. O conceito continua
em concept_ready. Não é evidência de chave ausente ou simples rate limit.

O gerador atual já usa gpt-image-1, com chave nativa prioritária e retorno
base64. Nenhuma troca de modelo foi realizada. A documentação oficial
também confirma que DALL-E 3 foi removido da API:
https://developers.openai.com/api/docs/models/dall-e-3

Correção: mensagem distingue saldo/limite financeiro, excesso de solicitações,
credencial, acesso/verificação e falha genérica. Não revela erro bruto do
provedor. Textos da tela de criativos agora usam geração por IA, sem exigir
DALL-E nem afirmar expiração de URL em uma hora para retorno base64.

Dois testes de regressão passaram (429 por saldo versus rate limit;
permissão, credencial e fallback seguro). Typecheck e build frontend passaram.
Não houve nova inferência, débito ou alteração de credencial/dados.

**Estado:** mensagem corrigida; geração real de imagem bloqueada externamente
por saldo/limite financeiro da OpenAI. A homologação anterior de completions
textuais não certifica geração de imagem nem saldo atual da conta.

**Próximo checkpoint:** responsável conferir saldo e limite de uso na
[OpenAI API Billing](https://platform.openai.com/settings/organization/billing/),
depois repetir a geração de um preview para homologar a entrega real.
Créditos do NexOS e saldo da API OpenAI são controles distintos. Sem push.
