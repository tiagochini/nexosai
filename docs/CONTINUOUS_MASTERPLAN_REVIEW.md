# Revisão de vendas contínuas — 12/10/2026

Problema reproduzido: briefing declarou continuous_sales por 30 dias, mas a
revisão usava duração fixa de 7 dias e cronograma estático de carrinho/escassez.
A tela buscava público em aliases e não em audience.description. A razão entre
meta e orçamento era apresentada como ROAS alvo sem aprovação.

## Correção

- Modelo e trilha persistidos têm prioridade sobre dados antigos do formulário.
- Período vem de campaign.timeline/launch.duration; ausente fica a definir.
- Modelos contínuos apresentam aquisição, qualificação, demonstração,
  acompanhamento e contratação/ativação condicionadas à oferta disponível.
- ROAS presumido removido. Público lê o campo canônico.
- Hipóteses, pendências e caminhos aparecem antes da aprovação.
- Decisões do usuário são preservadas fora dos últimos 40 turnos. O gateway
  inclui esse contexto nas chamadas de agentes com campanha, após ler o
  projeto pelo par workspaceId/campaignId. Conteúdo é enviado como dados,
  não como instruções privilegiadas de sistema.
- Prompt orienta a manter notas cumulativas de ressalvas e prazo declarado.
- Finalização não cria deadline de escassez por padrão em vendas contínuas.
- Progresso conta respostas obrigatórias, não histórico e notas adicionais.
- Ator automático system permanece na auditoria; não é escrito como UUID em
  created_by_user_id/approved_by_user_id.

## Campanha founder

Rascunho e intake sincronizados em homologação, com auditoria e cópia anterior
local ignorada. Público prioritário e ressalvas foram corrigidos a partir das
declarações explícitas da simulação. Campanha permanece intake, versão
canônica draft. Nenhuma aprovação, disparo, publicação ou geração dos agentes
de execução foi realizada nesta correção.

## Evidência

Regressões offline e PostgreSQL Docker verificam modelo/prazo, decisões após
rotação do histórico, snapshot canônico, negação de workspace alheio e ator
automático. Tipos frontend/API e build passaram. Navegador autenticado
confirmou 30 dias, público, dois caminhos e ressalvas; sem cronograma de
carrinho ou ROAS alvo inventado. Domínio público confirmou dados e saúde.

[Resultados](./CONTINUOUS_MASTERPLAN_REVIEW_RESULTS.json).

Esta tela consolida briefing e fluxo de revisão; não é evidência de um plano
detalhado já gerado pelos agentes. Próximo checkpoint: founder revisar e,
quando decidir, aprovar para validar estratégia/conteúdo gerados com essas
ressalvas. Condições de venda e integrações pendentes continuam pendentes.
Não houve push nem execução remota do CI desta revisão.
