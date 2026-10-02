# Remoção coordenada de credenciais do histórico Git

## Objetivo

Remover dos commits alcançáveis os arquivos sensíveis já retirados do estado
atual, sem tratar a reescrita como substituta da rotação das credenciais.

## Pré-requisitos obrigatórios

1. Rotacionar e revogar todas as credenciais encontradas nos arquivos afetados.
2. Conferir acessos, cobranças e uso suspeito nos provedores.
3. Suspender temporariamente pushes e merges no repositório.
4. Avisar todos os colaboradores de que os clones atuais serão descartados.
5. Criar um mirror privado e criptografado para recuperação emergencial.
6. Instalar `git-filter-repo` em uma máquina administrativa isolada.

## Auditoria antes da limpeza

Execute no clone administrativo:

```powershell
pnpm run security:audit-history
```

O comando informa somente caminhos e quantidades de commits, nunca os valores.
No estado conhecido em 02/10/2026, três caminhos precisam ser eliminados:

- `.env.exemple`;
- `backup.sql`;
- `attached_assets/Pasted-SESSION-SECRET-bkeBFa74QI-q70e4GySXVllFSR2vDcajRKXSfv7R_1790609764271.txt`.

## Reescrita

Faça a operação em um clone novo e exclusivo:

```powershell
git filter-repo --sensitive-data-removal --invert-paths `
  --path .env.exemple `
  --path backup.sql `
  --path attached_assets/Pasted-SESSION-SECRET-bkeBFa74QI-q70e4GySXVllFSR2vDcajRKXSfv7R_1790609764271.txt
```

Não adicione `--force` até confirmar que o clone é descartável, está sem mudanças
locais e possui um mirror de recuperação verificado.

## Validação antes do push

1. Execute `pnpm run security:audit-history`; o resultado deve passar.
2. Execute `pnpm run security:scan`; o resultado deve passar.
3. Confirme que branches e tags necessárias continuam presentes.
4. Compare a árvore do branch principal com o estado aprovado antes da limpeza.
5. Faça uma revisão por segunda pessoa dos comandos e evidências.

## Publicação coordenada

1. Force-push somente os refs revisados, dentro de uma janela anunciada.
2. Remova refs remotos obsoletos que ainda alcancem os blobs sensíveis.
3. Invalide caches, artefatos e mirrors públicos que possam conter os arquivos.
4. Oriente todos os colaboradores a apagar clones antigos e clonar novamente.
5. Reative pushes e merges apenas após a auditoria do remoto passar.

## Rollback

Se a topologia de branches ou tags ficar incorreta, interrompa a publicação e
restaure os refs usando o mirror privado. Nunca reative credenciais antigas nem
publique o mirror de recuperação.
