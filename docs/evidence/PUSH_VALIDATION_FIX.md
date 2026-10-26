# Validação do push — correção MAPA e execução P3

O push inicial bffd13a3 passou em Quality checks e Security checks. Infrastructure recovery passou em Docker e persistência/carga, mas falhou em test-mapa-comment-db: o caso com Direct desligado recebeu uma chamada extra originada pelo fluxo de outro post.

Corrigido o caminho comentário→sequência de DM: respeita enableInstagramPrivateReplies e o escopo dos posts; passa o post de origem para o resolvedor; aguarda a resolução; comentários não podem recorrer a outro post nem à keyword global reservada a DMs recebidas. A resposta determinística e o fluxo de Direct permanecem cobertos pelas regressões.

O teste agora confere também que post fora do escopo e respostas privadas desativadas não criam sequências em segundo plano. A jornada P3 demonstrou outra limitação da bancada: teste de edição de briefing terminava as asserções/cleanup, mas handles de SDK mantinham o processo vivo. O executor P3 agora encerra cada processo após o import com asserções e cleanup concluídos e propaga import rejeitado como exit 1. Não remove nem relaxa as asserções.

Validação local: 16 regressões de integrações passaram; typecheck/build da API passaram; toda a jornada P3 passou com código atual montado em banco/container descartáveis. Evidências em P3_VALIDATION_RESULTS.json (2026-10-14T00:13:01.426Z). Nenhuma inferência paga, publicação, cobrança ou alteração de dados founder.

A revisão corrigida será confirmada pelos workflows do GitHub; seus estados finais ficam nos próprios runs, vinculados ao SHA do push. O agendamento de campanha continua no checkpoint de implementação definido em EXECUTION_INTEGRATIONS_VALIDATION.md.
