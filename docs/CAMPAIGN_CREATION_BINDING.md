# Criação de lançamento com assinatura explícita — 11/10/2026

A tela enviava nome/tipo/faixa, mas o serviço de criação exigia produto e
assinatura comerciais explícitos. O schema da rota também descartava esses
campos. A criação falhava com HTTP 400 antes de qualquer chamada de IA.

A tela agora usa a assinatura ativa da visão autenticada do workspace e envia
ambos os UUIDs. Dados de outro workspace em transição não são utilizados. Sem
assinatura, informa o requisito; erros de permissão não são classificados
indiscriminadamente como limite de campanhas. Schema HTTP, OpenAPI e clientes
gerados incluem os campos obrigatórios. O serviço conserva a validação do par
produto/assinatura ativa dentro do workspace autenticado.

Regressão HTTP em PostgreSQL/Redis Docker descartáveis comprova criação 201,
status intake e persistência dos dois vínculos. Rejeita campos ausentes/UUIDs
inválidos, assinatura estrangeira, produto divergente e assinatura pausada;
outro workspace não recebe campanha. Teste incluído no runner P3.

Tipos de bibliotecas/frontend/API e build frontend passaram. Build conserva
avisos preexistentes de sourcemap. Runtime recompilado e reiniciado; pelo domínio
público, o founder possui a assinatura gratuita ativa, schema atualizado rejeita
pedido incompleto e healthz/readyz retornam 200. Sessão temporária encerrada.
Nenhuma campanha foi criada no banco de homologação durante a verificação;
nenhuma IA, cobrança ou publicação foi acionada.

[Resultados](CAMPAIGN_CREATION_BINDING_RESULTS.json). Próximo checkpoint: atualizar
a página no navegador e criar o lançamento para iniciar o briefing real. Nenhum
push executado.
