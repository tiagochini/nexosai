# Evidência de validação da reescrita do histórico

Data da validação: 02/10/2026.

## Escopo

A validação foi executada em um mirror temporário clonado diretamente de
`origin`, sem alterar o checkout local e sem publicar refs no GitHub.

Foram removidos em todas as revisões:

- `.env.exemple`;
- `backup.sql`;
- `attached_assets/Pasted-SESSION-SECRET-bkeBFa74QI-q70e4GySXVllFSR2vDcajRKXSfv7R_1790609764271.txt`.

## Resultado

- Integridade do mirror original: aprovada por `git fsck --full --strict`.
- Commits alcançáveis antes da reescrita: 1.454.
- Commits reescritos pelo `git-filter-repo`: 21.
- Primeiro commit alterado: `80bf793094dfe9d626ba263ce004da7762b15845`.
- Commits alcançáveis depois da remoção e poda: 1.452.
- Ocorrências dos três caminhos após a limpeza: zero.
- Comparação da árvore final, excluindo os alvos: nenhuma diferença.
- Integridade do mirror reescrito: aprovada por `git fsck --full --strict`.
- Push ou alteração remota: não realizados.

## Descoberta adicional

O checkout local falhou no `git fsck` devido a checksum de pack e CRC inválidos
em múltiplos objetos. Por isso, ele não deve ser usado como fonte da reescrita
definitiva nem submetido a `git gc` destrutivo. A operação final deve partir de
um clone novo do GitHub, depois de preservar o commit local ainda não publicado.

## Próxima condição de avanço

Antes da publicação definitiva, é obrigatório confirmar a rotação das
credenciais, congelar merges, preservar a alteração local sem reintroduzir os
blobs removidos e revisar o force-push com uma segunda pessoa.

O commit local à frente de `origin/main` foi preservado em um patch ignorado,
gerado com `--irreversible-delete`, dentro de `.local-recovery`. A comparação
com as 27 linhas significativas do anexo sensível resultou em zero coincidências.
Hash SHA-256 do patch: `3363F1C4DEA9632E9FE174BA3604AFB21BFF19DA682D7838D7DB63CC7EA51AAE`.

## Ensaio final com o commit local

Um segundo clone novo recebeu o patch seguro do commit local. Como o patch foi
gerado com `--irreversible-delete`, a exclusão do anexo foi resolvida por caminho
explícito e as demais alterações foram aplicadas diretamente no índice.

- Árvore reaplicada antes da limpeza: `68e474ba0763453b7f51f515872a6c1630000583`.
- Commits processados: 1.455.
- Commits reescritos: 22.
- Commits alcançáveis após poda: 1.453.
- Caminhos sensíveis alcançáveis: zero.
- Scanner do estado final: aprovado.
- Auditoria do histórico final: aprovada.
- `git fsck --full --strict`: aprovado.
- Hash da árvore após reescrita: idêntico ao hash anterior.
- Commit candidato temporário após reescrita: `b1a4e89f`.
- Push remoto: não realizado.
