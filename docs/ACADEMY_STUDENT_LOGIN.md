# Contas e acesso dos alunos da Academy

O aluno usa e-mail e senha. Uma chave recebida após a compra serve para vincular o produto a uma conta nova ou existente, uma única vez. A repetição na própria conta é idempotente; outra conta recebe conflito. A compra continua sendo a fonte de autorização: suspensão, estorno ou revogação bloqueiam o material mesmo depois da vinculação.

## Implementação

- As credenciais usam `users`, compartilhadas com o NexOS. Cadastrar-se na Academy não cria workspace, plano ou créditos do SaaS.
- A sessão da Academy fica em cookie HttpOnly, SameSite=Strict e Secure em produção, com caminho `/api/academy`. Apenas o hash do segredo é salvo no banco. A sessão tem validade de 30 dias.
- Há uma única sessão por usuário em `academy_student_accounts`. Um login substitui atomicamente a anterior. Login e redefinição de senha se serializam pelo registro do usuário.
- Curso, mini-guia, PDF, tutor, ativação e progresso conferem a sessão no servidor. Uma chave isolada já não autoriza conteúdo. O acesso administrativo mantém sua autorização própria.
- A interface verifica a sessão a cada 15 segundos e ao recuperar o foco. A sessão antiga é bloqueada imediatamente nas novas requisições; uma página já aberta exibe o aviso e remove o material na próxima verificação. Arquivos já baixados não podem ser recolhidos.
- O progresso das aulas é salvo por conta no banco. Notas, quizzes e histórico do tutor permanecem locais, separados por usuário.
- Recuperação usa link com segredo aleatório, validade de 30 minutos e uso único. A redefinição encerra a sessão da Academy e revoga as sessões de atualização do NexOS. A resposta de solicitação não revela se o e-mail existe.
- As chaves antigas continuam válidas para ativação. Um código anteriormente salvo no navegador é sugerido no campo de ativação, sem autorizar o conteúdo sozinho.

## Implantação

1. Aplicar a migração `0072_academy_student_accounts.sql` pelo processo rastreado: `pnpm --filter @workspace/db run migrate:tracked`, usando a conexão autorizada do ambiente.
2. Conferir permissões de leitura/escrita do usuário da API sobre `academy_student_accounts` e as novas colunas de `academy_purchases`.
3. Publicar a API e a Academy juntas. Publicar apenas o frontend não disponibiliza este fluxo.
4. Manter Redis disponível para limites de tentativas, `APP_URL` apontando para a origem pública e `ALLOWED_ORIGINS` contendo essa origem. Configurar `ACADEMY_TRUSTED_PROXY_IPS` com os IPs exatos do proxy confiável para contabilizar as tentativas por cliente; cabeçalhos encaminhados por outros IPs não são confiáveis. A recuperação usa os provedores Resend/Gmail já configurados para a Academy.

## Validação

`pnpm run test:academy-students-local -- --ui` cria PostgreSQL descartável e não carrega arquivos `.env`. Executa bootstrap, migrações, testes de contas/sessões, entrega de conteúdo, regressão administrativa e navegador com dois contextos independentes. Requer Docker, build atual da Academy e Chromium instalado; `ACADEMY_TEST_BROWSER` permite informar seu executável. O ambiente descartável é removido ao terminar.

Os testes cobrem disputa pela mesma chave, logins concorrentes, rejeição da sessão antiga no curso/PDF/tutor, logout antigo sem revogar sessão nova, progresso, usuários existentes, recuperação de senha, desktop e celular. Os testes de e-mail não enviam mensagens reais; a entrega externa precisa ser validada no ambiente de implantação.
