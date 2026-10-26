# P1 — implementação, evidência local e CI remoto

Revisão original: 06/10/2026. Confirmação remota: 08/10/2026. Autenticação do
GitHub CLI válida e CI remoto da implementação original confirmado. Este
documento não certifica produção aberta nem encerra as condições externas do P0.

O commit P1 `757ec7c0adac3ce0dc50bce5661d1da0bafff829` é ancestral do commit
remoto `81b0d3e0ec32622ae018f92ef04e6f163d531e53`. Nesse SHA, os três workflows
concluíram com sucesso em 07/10/2026, conforme API do GitHub consultada em
08/10/2026:

- [Quality checks](https://github.com/tiagochini/nexosai/actions/runs/37702406330):
  `typecheck-and-build` e `auth-database-tests` aprovados, incluindo conteúdo
  pago ausente no bundle público, bootstrap/migrações e testes com banco.
- [Security checks](https://github.com/tiagochini/nexosai/actions/runs/37702406380):
  scanner atual e auditoria de caminhos sensíveis no histórico aprovados.
- [Infrastructure recovery](https://github.com/tiagochini/nexosai/actions/runs/37702406303):
  Docker, persistência/recuperação/carga e jornada P3 isolada aprovados.

[Evidência remota por SHA e job](./P1_REMOTE_CI_RESULTS.json).
Na primeira conferência, os dez commits posteriores até `c2bc26d3` ainda não
estavam publicados. Com autorização posterior, o push de 08/10/2026 publicou
11 commits, incluindo o registro daquela conferência, em `93a5db75`.

## CI da revisão atual publicada

O SHA `93a5db7533daf62967d492dca19afd6c78ebf49b` inclui a correção de ativação
de planos e todas as alterações locais anteriores. Os três workflows e seus
seis jobs concluíram com sucesso, sem rerun nem correção adicional necessária:

- [Quality checks](https://github.com/tiagochini/nexosai/actions/runs/37852392718):
  build/tipos, dependências, conteúdo pago, autenticação e regressões de banco;
  logs confirmam ativação Agency, concessão única, isolamento, estorno,
  chargeback/recuperação e rollback por overflow.
- [Security checks](https://github.com/tiagochini/nexosai/actions/runs/37852392631):
  scanner atual e auditoria do histórico completo aprovados.
- [Infrastructure recovery](https://github.com/tiagochini/nexosai/actions/runs/37852392710):
  Docker/PostgreSQL externo com TLS, persistência/recuperação/carga e jornada P3.
  Os artefatos `docker-deployment-results`, `p2-infrastructure-results` e
  `p3-local-results` foram publicados, baixados e tiveram seus checks conferidos;
  a regressão de planos também passou no runner P3.

[Evidência atual por SHA, jobs, logs e hashes dos artefatos](./P1_CURRENT_REMOTE_CI_RESULTS.json).
O commit seguinte documenta esse resultado; sua execução de CI é acompanhada
separadamente. Os workflows usam infraestrutura descartável e provedores de
teste; não implantam produção nem substituem homologações de provedores reais.

## Material pago Academy

O frontend contém apenas o catálogo: títulos, duração e descrição comercial.
Conteúdo de aulas, exercícios, quizzes, glossário, bibliografia e mini-guia
ficam em `artifacts/api-server/src/modules/academy/content`.

`GET /api/academy/content/course` exige compra confirmada `complete-bundle`.
`GET /api/academy/content/mini-guide` e `/mini-guide.pdf` aceitam `mini-guide`
ou `complete-bundle`. Cada requisição confere revogação e bloqueio financeiro
no banco. Códigos seguem exclusivamente em `X-Academy-Access-Code`; parâmetros
de URL e flags do navegador não concedem acesso. Administradores usam a sessão
individual revogável já existente, com autorização e auditoria de proprietário.
As respostas autorizadas usam `private, no-store` e variam por credencial.
Cotas compartilhadas Redis bloqueiam em indisponibilidade.

O PDF original do mini-guia foi preservado e é gerado no servidor; a marca de
licença vem da compra autorizada. Exportação das aulas usa conteúdo previamente
autorizado, sem embutir aulas no código público. Material já recebido por um
aluno pode ser copiado; esta mudança controla a entrega inicial, não constitui DRM.

## CI e verificações

`quality.yml` usa PostgreSQL 17 e Redis 7 descartáveis, testa bootstrap com erro
forçado e rollback, verifica schema e migrações e executa autenticação, cookies,
WebSocket/polling, concorrência e reversões de pagamentos, Academy/outbox,
conteúdo pago, cotas Redis e checkpoint/retomada. A chave de criptografia do CI
é uma fixture pública exclusiva desse banco. Testes offline de fallback,
recuperação de boot e saúde também integram o workflow.

`security.yml` faz checkout com `fetch-depth: 0`, executa o scanner dos arquivos
atuais e audita nomes de arquivos sensíveis em todos os commits alcançáveis.
O auditor rejeita clones rasos. A auditoria histórica cobre caminhos proibidos;
não é uma detecção de todos os segredos possíveis no conteúdo de cada blob.

Evidência local desta revisão:

- Bootstrap, rollback, migrações e verificação: aprovados, 177 tabelas/73 entradas.
- Todos os testes de banco/Redis acima: aprovados; fixtures removidas e contagem
  final de usuários/workspaces/campanhas igual a zero no banco descartável.
- Autorização: rejeição de credenciais ausentes/em URL, compra pendente, produto
  incorreto, revogação, retenção financeira, reembolso e código inexistente;
  acesso válido e sessão de proprietário autorizado aprovados.
- PDF: resposta autorizada com assinatura PDF; reembolso bloqueia novo download.
- Build completo e typecheck: aprovados; API/Academy reconstruídas após a
  adaptação final do PDF para Node.
- Bundle público: 313 trechos de conteúdo pago ausentes em cinco arquivos
  JS/HTML, incluindo chunks; essa checagem bloqueia o CI após o build.
- Scanner atual e auditoria histórica de caminhos: aprovados.
- `pnpm audit --audit-level low`: sem vulnerabilidades conhecidas nesta revisão.

Para reproduzir localmente, usando apenas serviços próprios descartáveis:

```powershell
docker compose -p nexos-p1-tests -f scripts/compose.p1-tests.yml up -d --wait
pnpm run test:p1-local
pnpm run build
node scripts/check-academy-paid-bundle.mjs
docker compose -p nexos-p1-tests -f scripts/compose.p1-tests.yml down --volumes
```

O runner fixa URLs nas portas locais 55439/56389, sem carregar `.env` de produção.
Para retomar uma etapa, `--from test:academy-content-db` pula passos anteriores;
uma execução inicial requer banco vazio. Nenhuma cobrança, envio de e-mail ou
chamada a provedor real é necessária.

## Implantação e rollback

Publicar a API com as rotas protegidas antes do novo frontend. Remover bundles
antigos dos artefatos públicos e invalidar caches/CDN: esses bundles continham
material pago. Não servir o código-fonte da API nem usar Vite dev em produção.
Não há mudança de schema nem migração de dados neste P1. Se a implantação
falhar, suspender temporariamente a área paga e manter a API protegida;
restaurar o frontend antigo reintroduz a exposição do conteúdo.

O fechamento verificável do P1 e o CI das correções publicadas estão confirmados
pelos workflows vinculados ao SHA acima. Implantação de produção e limpeza dos
artefatos antigos mantêm as condições de publicação e rollback deste documento.
