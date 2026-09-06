# Contrato de Produto e Autonomia — v0.2

**Chave:** `product-autonomy` · **Versão:** `0.2` · **Idioma:** pt-BR

Este contrato define a base operacional do NexOS AI. Cada workspace é isolado: dados, campanhas, integrações, decisões e evidências de um cliente não podem ser usados para operar outro workspace.

## Economia e operação

O produto opera em modelo híbrido. A plataforma presta automação, inteligência e governança; o cliente financia diretamente os provedores de mídia e anúncios aplicáveis. A operação é contínua e orientada a eventos, com monitoramento e resposta aos sinais operacionais.

Dentro de limites, orçamento, canais e políticas previamente aprovados, a otimização **intraplataforma** pode ser autônoma. Qualquer realocação **interplataforma** exige aprovação humana prévia e explícita.

## Limites obrigatórios

A automação deve pausar e encaminhar para revisão humana diante das classes `probable_illegality`, `fraud`, `rights_violation`, `severe_account_ban_risk`, `overspend` e `severe_reputational_crisis`. Uma pausa ativa bloqueia a próxima ação externa no escopo correspondente até resolução humana justificada. Nenhuma declaração de responsabilidade substitui ou anula uma pausa. A resolução não retoma campanhas automaticamente.

Atividades reguladas podem demandar regras, licenças, registros, avisos e validações adicionais. O NexOS AI não substitui aconselhamento jurídico, regulatório ou profissional. O cliente é responsável pela licitude de sua oferta, pelas autorizações necessárias, pelas alegações comerciais e pelo cumprimento das normas aplicáveis.

Ao fornecer textos, imagens, vídeos, marcas, listas, dados ou quaisquer ativos, o cliente declara possuir os direitos, permissões e bases legais necessários para seu uso na campanha e autoriza seu processamento para essa finalidade.

## Aceites e evidência

O aceite é registrado por workspace e pode ser delimitado a uma campanha. Cada aceite guarda a versão e o hash imutáveis do contrato, uma cópia exata da evidência apresentada, data/hora e metadados técnicos mínimos. Revogações e resoluções são registradas sem apagar evidência histórica.

Os detalhes de SLA por faixa/tier serão definidos posteriormente no modelo financeiro e não são estabelecidos por esta versão.