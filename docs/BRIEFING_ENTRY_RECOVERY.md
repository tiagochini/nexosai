# Entrada no briefing de lançamento — 11/10/2026

A página de briefing da campanha redirecionava qualquer campanha com produto
comercial para o Hub central. Esse Hub oferecia aprovação, sem executar a
conversa do lançamento. A campanha founder estava em `intake` e sua versão
canônica havia sido aprovada contendo somente `_conversationHistory`.

Removido o redirecionamento: a página da campanha carrega perguntas e conversa
mesmo quando existe vínculo comercial. A gravação existente continua espelhando
os dados no briefing canônico. Aprovação do Hub rejeita histórico/flags sem
respostas; lançamento exige ao menos três campos com conteúdo. Este mínimo não
certifica qualidade nem completude integral. Finalização conta respostas antes
dos defaults; defaults não completam um briefing vazio. O Hub oferece retorno à
conversa quando o rascunho possui campanha de origem.

O founder recebeu uma versão sucessora em rascunho vinculada à campanha correta,
sem apagar histórico ou alterar a antiga versão aprovada. Recuperação registrada
em auditoria. Status da campanha permanece `intake`; não houve geração, aprovação
nova, publicação, débito ou chamada a provedor durante a intervenção.

Regressão HTTP Docker comprova perguntas para campanha vinculada, bloqueio de
finalização vazia, bloqueio de aprovação de histórico sozinho e aprovação de
respostas coletadas sem executar a campanha. Casos de criação/isolamento continuam
passando. Testes de contrato, tipos API/frontend e build passaram. Build mantém
avisos preexistentes de sourcemap. Runtime atualizado: perguntas HTTP 200, guard
de aprovação `INTAKE_INCOMPLETE` HTTP 400, frontend sem redirecionamento e
healthz/readyz HTTP 200 pelo domínio público.

[Resultados](BRIEFING_ENTRY_RECOVERY_RESULTS.json). Próximo checkpoint: founder
abrir a conversa e validar uma resposta real do agente; não foi certificada
inferência real nesta correção. Nenhum push executado.
