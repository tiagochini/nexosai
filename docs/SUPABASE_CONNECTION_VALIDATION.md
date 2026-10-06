# Teste de conexão Supabase

Validado em 06/10/2026, às 17:18 (America/Cuiaba). Escopo: conexão e metadados
somente leitura, sem migração, cadastro ou troca do banco ativo da aplicação.

- PostgreSQL remoto: conexão autenticada com sucesso; versão 17.11.
- TLS 1.3 com validação da CA oficial Supabase e do hostname. A primeira tentativa
  parou em `SELF_SIGNED_CERT_IN_CHAIN`; adicionar a CA oficial resolveu o problema.
- A sessão SQL usou `default_transaction_read_only=on` e `BEGIN READ ONLY`.
- O esquema `public` não possui tabelas: usuários, workspaces, campanhas, planos,
  histórico de migrações e auditoria Academy ainda não existem neste banco.
- A chave publicada foi aceita por `GET /auth/v1/settings` (200). A consulta de
  metadados `GET /rest/v1/` recebeu 401; acesso REST não foi certificado.
- O endpoint testado é `https://lwjkykbjynmqnixeoldd.supabase.co`;
  o link fornecido com sufixo `.com` não foi usado como endpoint do projeto.
- Senha e chave de teste estão somente em `.local/supabase-test-config.json`,
  ignorado pelo Git. O teste não modificou `.env.local` nem transferiu a conta
  founder do banco local. Não há dados pessoais no relatório de evidência.

[Evidência sanitizada](./SUPABASE_CONNECTION_VALIDATION.json).

Próximo checkpoint: preparar o esquema do NexOS neste banco externo e validar
migrações, constraints/triggers de isolamento e privilégios antes de conectar a
aplicação. Esse preparo ainda não foi executado; conectividade não certifica
isolamento, prontidão de produção ou compatibilidade completa do runtime.

Referências: [conexão PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres),
[TLS e CA](https://supabase.com/docs/guides/platform/ssl-enforcement),
[URL oficial da CA no dashboard](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).
