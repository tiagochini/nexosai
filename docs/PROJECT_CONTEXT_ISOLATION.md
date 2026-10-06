# Isolamento de usuários e projetos

Validado localmente em 06/10/2026. No modelo atual, projeto corresponde a uma
campanha, e o workspace pertence a um único usuário. As verificações de acesso
usam o proprietário atual no banco; o workspace informado no token não basta.

## Contrato implementado

- Toda rota que usa `requireAuth` verifica `workspace.ownerId = token.userId`.
  Token de outro proprietário e token anterior à troca de proprietário recebem
  401. A verificação também falha fechada quando o banco está indisponível.
- Memórias, Campaign Brain, checkpoints e serviços revisados de contexto exigem
  workspace e projeto. A API de memória exige `campaignId` para listar, contar,
  consultar e apagar. Gravações e captura de aprovação verificam o mesmo vínculo;
  não é possível copiar uma peça estrangeira usando seu ID.
- Um projeto inexistente ou de outro workspace interrompe `runAgent` e o gateway
  antes de chamar provedores. Não há retorno de contexto genérico que permita
  continuar silenciosamente uma execução com projeto inválido.
- O histórico automático entre campanhas e o agregador por vertical foram
  removidos da execução. Nenhuma memória de cliente marcada como referência
  pública, de outro projeto ou sem projeto entra nos prompts.
- Modo de pipeline, instruções de compliance e fallback pertencem à execução
  assíncrona de um projeto. Chamadas aninhadas recebem uma cópia das configurações;
  mudar workspace/projeto dentro da mesma execução é rejeitado.
- Presença social usa a campanha escolhida explicitamente. Sem escolha, permanece
  independente; não seleciona a campanha mais recente/ativa. Contexto de negócio
  e métricas semanais usam o mesmo projeto. Insights antigos ou sem origem
  identificada ficam ocultos, e mudar o projeto limpa o insight anterior.
- A tela de memória exige escolher um projeto. O chat separa usuário, workspace,
  projeto e papel do agente; cancela respostas pendentes quando o contexto muda.
  O histórico fica na sessão do navegador. Login, logout e troca de workspace
  limpam histórico privado e rascunhos locais antigos; preferências são preservadas.

## Banco e implantação

A migração `0069_project_memory_isolation.sql` adiciona uma chave composta de
memória para `(workspace_id, campaign_id)` e um trigger que impede reatribuir
uma memória a outro workspace ou projeto. O verificador exige ambos.

Registros legados com vínculo inválido são preservados com `campaign_id = NULL`;
ficam fora de consultas e prompts. Não há tentativa de adivinhar seu projeto.
Registros públicos, agregados de vertical e memórias antigas sem vínculo também
permanecem armazenados, mas não alimentam os agentes.

Em banco existente, faça backup e aplique as migrações rastreadas antes de ativar
a revisão: `pnpm --filter @workspace/db run migrate:tracked`, depois
`pnpm --filter @workspace/db run verify`. Em banco novo, use o bootstrap existente,
seed de planos e verificação. O bootstrap histórico não foi modificado.
O reparo é transacional; falhas não deixam DDL parcial. Não reative a versão
anterior da aplicação para rollback: ela contém os caminhos de mistura removidos.

## Evidência

`pnpm run test:p3-local` passou em imagem reconstruída, com PostgreSQL/Redis
descartáveis em rede interna e sem overlays de código. Os 23 grupos registrados
em [P3_VALIDATION_RESULTS.json](./P3_VALIDATION_RESULTS.json) incluem:

- concorrência entre workspaces e projetos, chamadas aninhadas, rejeição de troca
  de escopo e limpeza após falha;
- consultas e gravações cruzadas, exclusão de referências públicas/legadas,
  captura de conteúdo estrangeiro, token com proprietário incorreto, revogação
  por mudança de proprietário e DELETE com ID de outro projeto;
- interrupção de agentes/gateway antes do provedor, contexto canônico,
  seleção explícita na presença social e exclusão de insight de outro projeto;
- chave composta, vínculo imutável, reparo repetível de registro legado sem
  apagar conteúdo, sessões HTTP, realtime e retomada de conteúdo;
- limpeza de contexto privado no navegador e as regressões existentes do P3.

Tipos do banco/API/app e builds da API/app passaram. Scanner de segredos e guard
de logging passaram. Os builds mantêm os avisos existentes de sourcemap.
Os testes novos foram incluídos no workflow Quality e no runner local do P3.

## Limites e próximo checkpoint

Este checkpoint comprova os controles locais descritos; não certifica todo acesso
administrativo à infraestrutura nem implanta RLS em todas as tabelas. O usuário
da aplicação não recebe acesso SQL direto. Homologação externa e execução remota
do CI continuam pendentes; nenhum provider real foi chamado ou conteúdo publicado.

Conteúdo gerado antes desta revisão pode já ter usado o histórico compartilhado.
O filtro novo impede leituras cruzadas futuras, mas não prova a origem de cada
frase antiga. Audite esses artefatos antes de reutilizá-los em produção.
O próximo checkpoint é aplicar/verificar a migração no ambiente de homologação
e repetir os testes com dois usuários reais. M10 continua sendo o último nível
concluído; M11/M12 não são promovidos por este reforço transversal.
