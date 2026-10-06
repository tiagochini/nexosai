# Fechamento técnico do P0

Status: implementação, build completo e testes locais concluídos; fechamento
para liberação ainda pendente de evidência Asaas sandbox e ativação externa.

05/10/2026. [English](P0_SECURITY_CLOSEOUT.en.md).

Ativação local em 06/10/2026: por autorização do usuário, `founder@nexos.ai`
foi cadastrado como primeiro usuário master; seu UUID foi autorizado na Academy.
Login, sessão ativa, bloqueios e auditoria passaram. A credencial Asaas disponível
retornou 401 no sandbox; token local preparado; chave válida e endpoint público permanecem
pendentes. [Evidência atual e requisitos](./P0_REAL_ACTIVATION_STATUS.md).

## Implementado e validado localmente

- Administração Academy exige JWT vinculado a uma sessão de login ativa, UUID explicitamente autorizado e propriedade de workspace ativo. Revogação da sessão bloqueia o token antigo, mesmo após novo login. Cada solicitação autorizada registra ator, rota estática, método e resultado; nenhum corpo, senha, código ou e-mail entra nessa auditoria.
- PIN fixo, token mágico de proprietário e segredos na URL foram removidos do frontend separado `artifacts/nexos-academy`. O painel usa login individual e mantém o access token em memória; o cookie de refresh continua HttpOnly. A geração de brindes envia chave de idempotência e reutiliza a chave quando uma tentativa falha.
- Redis mantém cotas atômicas compartilhadas entre instâncias e após reinício, agrupando IPv6 por /56 e ignorando IP encaminhado de clientes diretos. Redis indisponível resulta em 503, sem consulta da compra ou fallback permissivo. Verificação, tutor, checkout e captura pública têm cotas independentes de 10 chamadas/15 minutos por origem.
- Verificação pública retorna somente `valid` e `productId`, com `Cache-Control: no-store`. O frontend não aceita flags antigas de acesso como autoridade, revalida códigos ao abrir e a cada cinco minutos e remove acesso revogado. O tutor exige código ativo de curso completo ou sessão administrativa autorizada antes de chamar a IA.
- Envios incertos podem ser conciliados por administrador individual após 15 minutos, com evidência do provedor, decisão explícita e chave idempotente. A decisão, o ator e hashes das evidências ficam persistidos na mesma transação que o resultado do envio. Não há reenvio automático na conciliação.
- Estornos e chargebacks, saldo negativo, bloqueio de consumo e concessões mensais idempotentes foram validados com concorrência. Não há compras históricas no banco local. Compras legadas sem concessão comprovada continuam exigindo revisão, não débito presumido.
- Revisão de campos dos logs e guard AST cobrem o runtime TypeScript da API. Proteção ampliada para perguntas, nomes, títulos, palavras-chave, códigos, respostas brutas, configurações e metadados. Canários opacos comprovam que a proteção não depende apenas de reconhecer o formato de um token.
- Boot de produção recusa segredos de assinatura ausentes, curtos ou com espaços; JWT aceita somente HS256. Teste `test:production-signing` cobre essa configuração sem iniciar serviços externos.

## Ativação segura

1. Cadastre normalmente a conta real do administrador. Configure `ACADEMY_ADMIN_USER_IDS` com seu UUID (separado por vírgula para mais de um). Não use e-mail como critério de privilégio. Entre novamente para receber token vinculado à sessão. A conta `founder@nexos.ai` foi criada localmente por autorização explícita em 06/10/2026; seu UUID é `dc97c52d-3769-4be3-bed1-c4239cc40796`. Senha inicial privada, fora do Git.
2. Mantenha `ACADEMY_ALLOW_LEGACY_ADMIN_SECRET=false`. O modo legado só existe para compatibilidade explícita em desenvolvimento/testes e nunca funciona em produção. As rotas de sessão/conciliação recusam essa alternativa em qualquer ambiente.
3. Aplique `0067_academy_admin_audit.sql` antes da API nova. Preserve as tabelas em eventual rollback; voltar ao código antigo reintroduz o acesso compartilhado e não deve ser uma estratégia de produção.
4. Configure Redis privado/persistente e a lista exata de proxies confiáveis. As cotas são por origem, inclusive para alunos atrás de NAT: avalie esse limite em homologação. Não remova o bloqueio em falhas para contornar indisponibilidade.
5. Configure a credencial do Asaas sandbox e os tokens/eventos dos webhooks; execute a jornada sandbox autorizada antes de ativar produção. A credencial legada configurada retornou 401 no sandbox em 06/10/2026; a jornada externa permanece pendente. Nenhum pagamento, e-mail ou estorno real foi feito.

## Conciliação de envio incerto

Interrompa o worker responsável e confira o caso no provedor antes de decidir. Quinze minutos são uma barreira adicional, não prova de rejeição. Se a evidência continuar ambígua, mantenha `sending`.

`POST /api/academy/admin/delivery-reconciliation`, com `Authorization: Bearer <access token>` e `Idempotency-Key`:

```json
{
  "jobId": "UUID",
  "decision": "accepted",
  "providerId": "opaque-provider-receipt",
  "evidenceReference": "reference-to-a-verified-provider-case"
}
```

Use `not_accepted` sem `providerId` somente para rejeição/ausência de aceitação comprovada. Depois dessa decisão, uma nova intenção explícita em `/admin/resend` pode criar outra tentativa. Evidências completas devem ser mantidas em armazenamento restrito pelo operador; o banco guarda somente hashes das referências. Estado inicial 0 na auditoria administrativa significa resultado ainda não registrado ou interrupção — não sucesso.

## Evidências e limites de liberação

Testes locais: `test:academy-p0-db`, `test:academy-quota-redis`, `test:academy-admin-security`, `test:academy-verification-security`, `test:academy-delivery-lifecycle-db`, `test:auth-sessions-http`, `test:auth-cookie-security`, `test:academy-access-outbox-db`, `test:billing-reversal-db` e `test:log-security`. Passaram guard do cliente, typecheck completo, build completo de todos os aplicativos/API, scanner de segredos, auditoria do histórico e auditoria completa de dependências. Após a correção das ferramentas, os testes P0 de banco, Redis, estornos e compatibilidade de dependências foram repetidos com sucesso. CI foi preparado com PostgreSQL e Redis descartáveis, mas não executado remotamente: sem push por determinação do usuário.

### Build e ferramentas — pendência resolvida em 05/10/2026

O inspector local mostrou recursão de otimização do Rollup ao incluir argumentos de chamadas no módulo React DOM de produção. Na mesma árvore de fontes, Rollup 4.64.0 travou; a comparação isolada com 4.59.0 passou em cerca de três segundos. A correção final fixa 4.63.6 no workspace/lockfile, mantendo tree-shaking e minificação habilitados. O build completo passou novamente após as demais alterações. Não houve correção permanente no CSS nem alteração dos limites do bundle para esconder falhas.

A auditoria anterior usava `--prod` e não cobria ferramentas de desenvolvimento. A auditoria completa identificou esbuild, postcss-selector-parser e braces vulneráveis. Atualizados esbuild para 0.28.1 e postcss-selector-parser para 7.1.6; como braces 3.0.4 não estava disponível no npm, removida a cadeia fast-glob/micromatch/braces do sandbox. A descoberta de mockups agora usa diretórios nativos, exclui arquivos privados/ocultos, não segue links simbólicos e tem dois testes de regressão. `pnpm run security:audit-dependencies` agora inclui desenvolvimento e passou sem vulnerabilidades conhecidas. CI usa essa auditoria e limita o job de build a vinte minutos.

O app principal passou seu orçamento de JavaScript inicial (449.1 KiB, limite 500 KiB). Avisos de chunks grandes na Academy/landing e avisos de sourcemap em componentes do app continuam não bloqueantes; otimização destes bundles não foi declarada concluída. Builds locais não certificam uma jornada real de navegador nem o CI Linux.

Fechamento técnico local não é liberação de produção. A conta master foi ativada e testada localmente. Restam ativação no ambiente externo, credencial/webhooks Asaas, jornada sandbox e execução remota autorizada. Retenção/acesso de logs, consoles de terceiros, scripts diagnósticos e serviços Python não são certificados por esse guard. O curso contém materiais estáticos no frontend: essas correções protegem administração/API/tutor, mas não são DRM; entrega de material pago exclusivamente pelo servidor é uma frente separada de licenciamento.
