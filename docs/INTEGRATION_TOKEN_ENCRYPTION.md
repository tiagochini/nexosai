# Criptografia dos tokens de integração

[English](./INTEGRATION_TOKEN_ENCRYPTION.en.md)

Os campos `workspace_integrations.access_token` e `refresh_token` usam
AES-256-GCM na camada Drizzle. O banco recebe um envelope versionado com
identificador da chave, nonce aleatório de 12 bytes, tag de autenticação e
conteúdo criptografado. Leituras feitas pelo ORM retornam o token ao consumidor
interno. As colunas continuam sendo `text`; não há mudança de schema SQL.
Valores nulos permanecem nulos. SQL bruto não faz a conversão automaticamente.

## Configuração e instalação

1. Configure `INTEGRATION_TOKEN_ENCRYPTION_KEY` com 32 bytes aleatórios em base64
   canônico. Use um gerenciador de segredos em produção. A chave não deve ser
   versionada nem guardada junto ao backup do banco.
2. Preserve um backup do banco e uma cópia protegida da chave. Pare APIs e workers
   antigos antes da migração; eles não entendem envelopes criptografados.
3. Execute `pnpm --filter @workspace/db run tokens:check`. O comando valida os
   tokens e chaves sem persistir alterações. O resultado mostra somente contagens.
4. Execute `pnpm --filter @workspace/db run tokens:migrate`. Todos os tokens são
   convertidos na mesma transação, com bloqueio de gravação na tabela.
   Qualquer erro desfaz as alterações. Se não houver tokens, o resultado é zero.
5. Inicie a API e os workers atualizados com a mesma chave. Em produção, a API
   recusa iniciar sem configuração válida. Em qualquer ambiente, gravações de
   tokens exigem a chave e leituras recusam texto puro ou conteúdo adulterado.

Não existe fallback para uma chave de desenvolvimento ou para gravar texto puro.
O processo de migração também permite converter bancos legados antes da primeira
inicialização da versão nova. Execute-o fora do tráfego normal.

## Rotação e recuperação

Para rotacionar, pare os escritores, configure uma nova chave ativa e inclua a
anterior em `INTEGRATION_TOKEN_PREVIOUS_KEYS`, um array JSON de chaves base64.
Rode a verificação e a migração. O comando recriptografa os valores com a chave
ativa. Retome todos os consumidores com a nova configuração e remova a chave
anterior apenas após verificar a conversão e a estratégia dos backups antigos.

Uma falha na migração gera rollback automático. Para voltar ao código antigo,
restaure o backup anterior à migração com os escritores parados. Não inicie a
versão antiga contra o banco criptografado. Perder todas as chaves torna os tokens
irrecuperáveis: nesse caso, revogue-os e reconecte as integrações nos provedores.

## Verificação e limites

`pnpm --filter @workspace/db run test:token-encryption` testa nonce distinto,
integridade, chave ausente/incorreta, rotação e mapeamento SQL.
Acrescente `-- --database` para exercitar insert, leitura, update e `RETURNING`
no PostgreSQL usando tabela temporária e rollback, sem alterar integrações reais.

Esta correção cobre os dois campos de token desta tabela. Segredos em metadata,
outros campos, logs ou histórico de chat exigem verificações próprias. O banco
criptografado não protege os tokens na memória do processo nem substitui controles
de autorização e respostas que omitem credenciais.
