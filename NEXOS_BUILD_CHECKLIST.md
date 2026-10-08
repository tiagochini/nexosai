# NexOS — Checklist Canônico de Construção

**Asaas sandbox real — 08/10/2026:** Campanhas e Academy concluíram checkout
público, pagamento com cartão fictício, webhook real, repetição sem duplicação e
estorno integral. Academy liberou acesso (200) e revogou após estorno (403), com
um único job de entrega; Campanhas registrou um único evento pago e um estornado.
Corrigida compatibilidade com `refunds: null` da API real. Cobranças estornadas e
produto de homologação desativado; histórico preservado.
[Evidência](docs/ASAAS_SANDBOX_JOURNEY_RESULTS.json). E-mail efetivamente enviado
e validações externas adicionais ainda pendentes; maturidade geral inalterada.

**P1: CI remoto confirmado — 08/10/2026:** GitHub CLI autenticado. Quality,
Security e Infrastructure concluíram com sucesso no SHA remoto `81b0d3e0`,
que contém a implementação original P1 `757ec7c0`; seis jobs aprovados.
[Evidência por SHA](docs/P1_REMOTE_CI_RESULTS.json) e
[fechamento P1](docs/P1_CLOSEOUT.md). Pendência remota do P1 original encerrada.
Alterações locais posteriores, incluindo `c2bc26d3`, ainda precisam de CI no
próprio SHA após publicação autorizada; nenhum push realizado. Este fechamento
não certifica produção nem promove a maturidade das capacidades.

**Planos e créditos corrigidos — 08/10/2026:** ativação transacional e créditos
incluídos corrigidos após a falha histórica. Reteste em conta comum separada:
Solo/900 → Agency/2.900 → Agency/3.400 com pack de 500; estornos reais restauraram
Solo/900. Ledger teve uma concessão e uma reversão por compra; três repetições
de confirmação e estorno não duplicaram efeitos. Tokens incorretos/cruzados
retornaram 401; pagamento de outro workspace retornou 404 inclusive para founder.
Consulta de assinatura exclui packs e respeita acesso vitalício. Regressões
Docker e tipos passaram; CI/P3 incluem a regressão de ativação. Histórico
preservado, sessões de teste revogadas e plano/saldo founder inalterados.
[Reteste billing](docs/ASAAS_BILLING_SANDBOX_RETEST_RESULTS.json),
[regressões locais](docs/BILLING_LOCAL_VALIDATION.json) e
[política de ativação/reversão](docs/BILLING_PLAN_ACTIVATION.md).
Próximo checkpoint: entrega real Academy e conexão Meta/MAPA. PIX/boleto,
estorno parcial, chargeback e rejeição de cartão ainda exigem prova externa.
Produção não foi utilizada; maturidade geral inalterada.

**Webhooks Asaas separados — 08/10/2026:** tokens informados para Campanhas
e Academy configurados somente no perfil privado de homologação. Overrides
`ASAAS_PRODUCT_WEBHOOK_TOKEN` e `ASAAS_ACADEMY_WEBHOOK_TOKEN` isolam os endpoints;
valor ausente mantém compatibilidade, valor explicitamente vazio bloqueia acesso.
HTTP público: token próprio 200; token cruzado/ausente 401. Eventos de verificação
ignorados, sem cobrança ou concessão. [Evidência](docs/ASAAS_WEBHOOK_CONFIGURATION.json).
Próximo checkpoint: salvar as configurações no Asaas sandbox e verificar entrega
real e liquidação ponta a ponta. Maturidade geral inalterada.

**Administração global por UUID — 08/10/2026:** Command Center e privilégios
administrativos relacionados usam `PLATFORM_ADMIN_USER_IDS`, sem autorização por
e-mail. Ações administrativas exigem sessão ativa vinculada ao usuário e workspace;
frontend consulta a permissão do servidor. Founder habilitado no perfil privado de
homologação. Regressões Docker e domínio público validados; produção não ativada.
[Evidência](docs/PLATFORM_ADMIN_UUID_VALIDATION.json) e
[configuração](docs/PLATFORM_ADMIN_UUID.md). Maturidade geral inalterada.
Próximo checkpoint: desbloquear o aplicativo Meta e concluir a jornada Asaas sandbox.

**Meta — homologação de 08/10/2026:** credenciais existentes copiadas somente
para o perfil privado e runtime reiniciado. API pública confirma OAuth habilitado,
gera retorno Instagram e valida/rejeita assinatura de webhook com evento vazio.
[Evidência](docs/META_HOMOLOGATION_CONFIGURATION.json). Nenhuma conexão/publicação
real; maturidade inalterada. Próximo checkpoint: cadastrar retorno no painel Meta,
autorizar a conta e verificar recebimento real do comentário MAPA.

**Asaas sandbox — 07/10/2026:** chave de homologação autenticada com HTTP 200,
perfil privado configurado em sandbox e runtime reiniciado. Produção permanece
separada; nenhuma criação de cliente/cobrança/webhook nesta validação.
[Evidência](docs/ASAAS_SANDBOX_AUTHENTICATION.json). Maturidade inalterada;
próximo checkpoint: jornada sandbox de checkout, liquidação e webhook público.

**APIs de IA — homologação de 07/10/2026:** autenticação/listagem de modelos
OpenAI e Gemini passou; chaves nativas guardadas somente no perfil privado e
runtime reiniciado. Anthropic exige ID de workspace, ainda não informado.
[Evidência sem segredos](docs/AI_PROVIDER_HOMOLOGATION_RESULTS.json).
Nenhuma geração/inferência real certificada; maturidade inalterada. Próximo
checkpoint: resolver escopo Anthropic e validar a jornada de IA na homologação.

**Login de homologação — 07/10/2026:** Sonner montado e erro persistente no
formulário; launcher autoriza os dois endereços loopback da interface.
TypeScript/UI negativa e bloqueio de origem externa verificados; API reiniciada
e pronta. [Evidência](docs/LOGIN_HOMOLOGATION_VALIDATION.md). Maturidade inalterada;
`https://agencianexos.vip` configurado: prontidão/login/administração por UUID
passaram pelo domínio público; sessão de verificação encerrada. Próximo checkpoint:
retornos/permissões Meta e recebimento real do comentário MAPA.

**Comentário MAPA — 07/10/2026:** corrigida leitura de `id/text/media.id` no
webhook Instagram. Testes Linux/Docker passaram para resposta imediata configurada,
envio público/privado simulado e repetição/conta desconhecida. Supabase preservado.
[Evidência e limites](docs/MAPA_COMMENT_VALIDATION.md). Maturidade inalterada;
próximo checkpoint: recebimento real em conta Meta autorizada na homologação.

**CI P3 — correção de 07/10/2026:** reproduzida em Linux a ausência de TypeScript
no runner; workflow instala dependências antes do P3. Diagnóstico passa a incluir
stdout/stderr com segredos de fixtures ocultos. Três testes do runner passaram em
Linux; execução remota do novo commit permanece pendente. Supabase não foi acessado.
[Evidência e limite](docs/CI_REGRESSION_FIXES.md). Maturidade inalterada.

**Dados padrão Supabase — 07/10/2026:** esquema e privilégios verificados;
planos Solo/Agency carregados, founder preservado e duas pastas padrão criadas
no seu workspace. Nenhuma fixture ou memória compartilhada entre projetos foi
inserida. [Carga verificada](docs/SUPABASE_HOMOLOGATION_DEFAULT_DATA.json).
Próximo checkpoint: jornada de navegador e provedores sandbox na homologação.
Maturidade inalterada; desenvolvimento/regressões permanecem locais/Docker.

**Separação de ambientes — 07/10/2026:** Supabase reservado à homologação;
desenvolvimento no PostgreSQL local/Docker e regressões em bancos descartáveis
locais/Docker. Removido `homologation:test`; o runtime de testes bloqueia conexões
Supabase. Perfil de homologação separado, dados e evidências históricos preservados.
Próximo checkpoint: jornada de navegador e provedores sandbox na homologação.
[Política e comandos](docs/SUPABASE_HOMOLOGATION.md). Maturidade inalterada.

**Supabase — homologação de 06/10/2026:** esquema externo preparado (177 tabelas,
75 entradas de esquema/migração e 19 triggers ativos), TLS verificado, role privada
e acesso público bloqueado. Seis grupos de regressão, administração founder por
UUID e API compilada com Redis exclusivo passaram. Perfis, portas e filas locais
permanecem separados. Próximo checkpoint: jornada de navegador e provedores
sandbox autorizados. [Guia/evidência](docs/SUPABASE_HOMOLOGATION.md).
Maturidade permanece inalterada; implantação pública não foi feita.

> Atualizado após cada unidade de desenvolvimento.
>
> Este arquivo responde três perguntas: **onde estamos**, **o que foi comprovado** e **qual é o próximo checkpoint**.

Última atualização: **6 de outubro de 2026**

## Estado executivo

- **Estágio operacional em foco:** transversal — Control Room e governança de capacidades;
- **Nível de maturidade em foco:** M11 — fechamento das autorizações Content/Social; fundamentos M12 continuam locais;
- **Último nível concluído:** M10 — Council operacional;
- **Checkpoint atual:** P3 local: jornada simulada, entrega Academy, concessões de objetos, integridade do schema e framework de qualidade de IA; evidência e limites em [P3_CLOSEOUT](./docs/P3_CLOSEOUT.md). M11/M12 seguem incompletos; M10 é o último nível concluído.
- **Próximo checkpoint:** homologação externa do P3 com contas próprias, GPU/pesos aprovados, matriz real de IA e CI remoto; concluir os vínculos de aprovação/autorização pendentes antes da operação autônoma.

## Checkpoint transversal — isolamento de usuários e projetos (06/10/2026)

**Ativação real P0 — checkpoint de 06/10/2026:** por autorização explícita,
`founder@nexos.ai` foi criado como primeiro usuário master local. UUID Academy,
login, sessão, revogação e auditoria passaram por HTTP; segredo legado desativado.
A credencial disponível retornou 401 no Asaas sandbox; o token local foi preparado, mas faltam chave válida
e URL pública da aplicação para o webhook. Não houve cobrança ou implantação
externa. M10/M11/M12 permanecem no estado anterior.
[Evidência e requisitos](./docs/P0_REAL_ACTIVATION_STATUS.md).

**Isolamento de projetos e usuários (06/10/2026):** ownership atual verificado
por requisição; memória e contexto vinculados a workspace/projeto; referências
entre projetos removidas; configurações concorrentes de agentes isoladas;
histórico privado do navegador separado e limpo na troca de conta/workspace.
Migração 0069, testes negativos e 23 grupos locais passaram em imagem reconstruída.
[Evidência e limites](./docs/PROJECT_CONTEXT_ISOLATION.md). CI remoto, aplicação
da migração em homologação e auditoria dos artefatos antigos permanecem pendentes.
M10 continua concluído; M11/M12 permanecem incompletos.

## Checkpoint transversal — P1/P2 local (06/10/2026)

Correção posterior dos jobs Quality: teste de saúde isolado de banco/Redis e
chave de criptografia de CI gerada com 32 bytes. Ambos os erros dos logs remotos
foram corrigidos e reproduzidos/validados localmente; tipos/build da API e
segurança passaram. [Evidência](./docs/CI_REGRESSION_FIXES.md).
Próximo checkpoint deste reparo: reexecutar o CI remoto com a revisão corrigida.

- [x] P1: material pago Academy autorizado pelo servidor; dependências, CI
  crítico, bootstrap/rollback e auditoria de histórico preparados e validados
  localmente. Evidência: [P1_CLOSEOUT.md](./docs/P1_CLOSEOUT.md).
- [x] P2: Redis 7.4 autenticado/AOF, restauração cifrada integral, quedas reais
  de Redis/PostgreSQL, recuperação de produtores/workers, falhas de provedores
  em loopback e carga transacional concorrente passaram em containers isolados.
  Evidência: [P2_CLOSEOUT.md](./docs/P2_CLOSEOUT.md) e
  [resultados medidos](./docs/P2_VALIDATION_RESULTS.json).
- **Limite:** escopo local; CI remoto, ativação/backup externo e jornada real
  continuam pendentes. M10 permanece o último nível concluído; M11/M12 e os
  estados de capacidades GLP22 não são promovidos por estes testes.
- **Próximo checkpoint de prontidão:** homologação externa do P3;
  os gates de consentimento e homologação real acima continuam obrigatórios.

## Checkpoint anterior ao P3 — implantação Docker (06/10/2026)

- [x] API e frontend em imagens Linux, configuração externa de segredos e Redis
  privado; PostgreSQL opcional em Compose local ou externo por `DATABASE_URL`.
- [x] Bootstrap/seed/verificação explícitos nos dois modos, certificado/nome
  verificados no banco externo, rejeição de hostname incorreto e recuperação
  após parada do banco sem reiniciar a API.
- [x] API sem root e gravações persistentes após recriação; build das imagens,
  typecheck, scanner de segredos e guard de logging aprovados.
- **Evidência:** [guia Docker](./docs/DOCKER_DEPLOYMENT.md) e
  [resultado local](./docs/DOCKER_DEPLOYMENT_RESULTS.json).
- **Limite:** simulação de infraestrutura externa em stack isolado; provedor,
  domínio HTTPS e CI remotos ainda não ativados. Workers/schedulers continuam
  no processo atual; não há promoção de maturidade ou certificação de vídeo.
- **Próximo checkpoint:** P3 — jornada sandbox e qualidade de IA.

## Checkpoint transversal — P3 local (06/10/2026)

- [x] Jornada conectada com cadastro real, campanha/conteúdo fixture, publicação
  autorizada simulada, lead consentido, checkout e atribuição concorrente idempotente.
- [x] Regressões de Academy/outbox, mídia nativa e execução condicional;
  concessões de objeto assinadas, curtas, vinculadas ao lease e de uso único.
- [x] Integridade restaurada em bancos novos/existentes por migração 0068:
  18 triggers e 37 chaves omitidas; estágio temporário encerrado e verificação
  detecta triggers desativados e chaves ausentes/não validadas.
- [x] Dataset de cinco artefatos, mínimo 85/100 e revisão humana vinculada;
  referências sintéticas não certificam qualidade de modelos reais.
- **Evidência:** [P3_CLOSEOUT](./docs/P3_CLOSEOUT.md) e
  [resultados locais](./docs/P3_VALIDATION_RESULTS.json).
- **Limite:** vídeo GPU/modelos reais, Meta externo e launch Google/TikTok
  continuam sem certificação. M10 permanece o último nível concluído.
- **Próximo checkpoint:** executar o roteiro de homologação externa do P3 com
  contas próprias, GPU/pesos aprovados, matriz real de IA e CI remoto.

## Checklist dos 12 níveis de maturidade

| Nível | Entrega | Estado | Evidência atual | Próximo critério |
|---|---|---|---|---|
| M01 | Control Room UI | ✅ Concluído | API real, ownership, estados vazios, desktop/mobile e acesso Fundador/Arquiteto | Manter sem regressão |
| M02 | Contadores clicáveis | ✅ Concluído | Build, API real, fixture autenticado, composição exata, desktop/mobile e acessibilidade | Manter sem regressão |
| M03 | Drilldown de evidência | ✅ Concluído | Contrato OpenAPI, paginação determinística, filtros exatos, sanitização, ownership, links verificados e E2E desktop/mobile | Manter sem regressão |
| M04 | Preview universal | ✅ Concluído | Endpoint paginado, sete fontes persistidas, renderizadores seguros, filtros, ownership e E2E desktop/mobile | Manter sem regressão |
| M05 | Version diff | ✅ Concluído | Catálogo honesto, Master Plan e revisões de página, diff determinístico/sanitizado/limitado, ownership e E2E desktop/mobile | Manter sem regressão |
| M06 | Approval Center | ✅ Concluído | Decisões imutáveis por snapshot, ownership composto, stale/race/idempotência, motivos, UI responsiva e E2E autenticado | Manter sem regressão |
| M07 | SLA e lembretes | ✅ Concluído | Obrigação exata por snapshot, aviso 1h antes, due/escalation/expiration, recibos append-only, auditoria, concorrência e E2E desktop/mobile | Manter sem regressão |
| M08 | Autoexecução condicionada | ✅ Concluído | `paid_media_pause` governado, locks PostgreSQL cross-process, receipt+readback, recovery fail-closed e E2E desktop/mobile sem rede | Manter sem regressão |
| M09 | Contratos de realização | ✅ Concluído | Ledger universal e dois adapters reais (`paid_media_pause`, `paid_media_launch`), UI, receipt+readback, QC, recovery e testes adversariais | Manter sem regressão |
| M10 | Council operacional | ✅ Concluído | Ciclos, atas, decisões e resultados append-only; binding exato, UI, idempotência concorrente e teste DB adversarial | Manter sem regressão |
| M11 | Verticais full-stack | ▶️ Em andamento | Inbox/relatórios por workspace; preview→confirmação por fingerprint; deduplicação no banco; publicação Facebook com receipt/readback e evidência em simulação local | Vínculo imutável da aprovação, política de autopublicação, recuperação/métricas e homologação real |
| M12 | Lifecycle autônomo | ▶️ Em andamento (fundamentos locais) | API e painel de observação; reconciliação de carrinhos sem envio; projeções de venda/refund atômicas e reparo; testes DB de escopo, paginação e concorrência | Prova de entrega/ativação, política de execução, otimização, recuperação e homologação real do ciclo completo; M11 ainda não concluído |

## Checklist dos 12 estágios operacionais

O estado abaixo será calculado capability por capability. Nenhum estágio é considerado concluído por alegação histórica.

| Estágio | Domínio | Estado do índice |
|---|---|---|
| L01 | Fundamentos de execução | 🟡 Auditoria das capabilities existentes pendente |
| L02 | Captura e primeiro contato | 🟡 Fundação implementada; indexação completa pendente |
| L03 | Conversação comercial | ⬜ Indexação e gap audit pendentes |
| L04 | Oferta, checkout e pagamento | ⬜ Indexação e gap audit pendentes |
| L05 | Recuperação de vendas | ⬜ Indexação e gap audit pendentes |
| L06 | Pós-venda e entrega | ⬜ Indexação e gap audit pendentes |
| L07 | Retenção, comunidade e indicação | ⬜ Indexação e gap audit pendentes |
| L08 | Conteúdo e presença digital | 🟡 Capacidades existentes; certificação full-stack pendente |
| L09 | Aquisição paga | 🟡 Fundação governada; homologação completa pendente |
| L10 | Inteligência e otimização | 🟡 Sistemas parciais; Council fechado pendente |
| L11 | Resiliência e governança | 🟡 Fundações implementadas; índice e certificação pendentes |
| L12 | Homologação de produção | ⬜ Matriz de certificação pendente |

## Última unidade concluída — M02 Contadores clicáveis

### Entregue no código

- [x] contador de previews/entregáveis acionável;
- [x] contagens por grupo de entregável acionáveis;
- [x] contadores de integrações totais, saudáveis e bloqueadas;
- [x] contador de checkpoints pendentes;
- [x] contadores de evidências por estado canônico: planejado, tentativa, confirmação do provedor e QC;
- [x] drawers com composição baseada na resposta persistida;
- [x] links para conteúdo, campanha e integrações;
- [x] detalhes de credenciais sem tokens;
- [x] detalhes de evidência já sanitizados pela API;
- [x] foco de teclado e rótulos acessíveis;
- [x] typecheck do frontend.
- [x] correção de categorias impossíveis detectadas no primeiro teste E2E;
- [x] tratamento seguro de `contextFingerprint` nulo.

### Validação concluída

- [x] build de produção;
- [x] reiniciar app e API;
- [x] abrir os contadores com fixture autenticado;
- [x] confirmar filtros e contagens;
- [x] confirmar que nenhum segredo aparece;
- [x] validar desktop em 1440×1000;
- [x] validar mobile em 390×844;
- [x] confirmar ausência de erros após correção do fixture;
- [x] confirmar ausência de overflow horizontal;
- [x] remover integralmente o fixture de teste;
- [x] atualizar M02 para concluído.

### Provas do checkpoint

- entregáveis: total 4, previews 3, drawers geral e filtrado corretos;
- credenciais: total 2, saudável 1, bloqueada 1, sem exposição de segredo;
- checkpoints: 1 aprovação pendente com link para a campanha;
- evidências: 4 registros, um para cada estado canônico;
- todos os contadores expostos como botões acessíveis;
- nenhum provider, publicação, mensagem, IA ou cobrança acionado;
- cleanup confirmado sem usuário, workspace ou campanha residual.

## Última unidade concluída — M03 Drilldown de evidência

### Entregue no código

- [x] contrato OpenAPI e clientes/Zod regenerados;
- [x] endpoint paginado separado sem alterar o contrato do resumo M01/M02;
- [x] cursor HMAC com expiração e vínculo a workspace, campanha, filtros e limite;
- [x] paginação seek determinística por `createdAt DESC, id DESC`;
- [x] filtros por estado, subject type, período e entidade;
- [x] ownership por workspace e campanha;
- [x] timeline com IDs e timestamps exatos;
- [x] links somente para entidade persistida e pertencente à campanha;
- [x] detalhes recursivamente sanitizados e limitados também por bytes;
- [x] total e facets exatos;
- [x] estados de carregamento, erro inicial, erro de próxima página, vazio filtrado e fim da lista;
- [x] Escape, controles nativos, rótulos e foco de teclado;
- [x] layout responsivo sem overflow horizontal.

### Validação concluída

- [x] migração rastreada `0039_control_room_evidence_pagination.sql` aplicada;
- [x] typecheck das bibliotecas, API e frontend;
- [x] build de produção do frontend;
- [x] testes focados M01/M02 e M03;
- [x] `git diff --check`;
- [x] app e API reiniciados e saudáveis;
- [x] E2E autenticado com 30 registros e três páginas lógicas verificadas;
- [x] filtros de estado, tipo, UUID, período e combinação verificados;
- [x] validações de UUID e período inválidos verificadas;
- [x] link de origem real e ausência de links inventados verificadas;
- [x] sanitização e ausência de segredos verificadas;
- [x] desktop 1440×1000 e mobile 390×844 verificados;
- [x] correção de Escape retestada isoladamente;
- [x] cleanup confirmado com zero resíduos em todos os fixtures.

### Provas do checkpoint

- primeira página: 25 de 30 registros; segunda carga: 30 de 30, sem lacunas ou duplicatas;
- quatro estados e seis subject types exercitados com contagens exatas;
- ordenação determinística comprovada inclusive com timestamps empatados;
- resumo M02 permaneceu limitado aos 25 registros do contrato anterior;
- somente o `social_post` real e pertencente à campanha recebeu link de origem;
- registros órfãos e tipos sem rota permaneceram sem link;
- erro de página adicional preserva os registros já carregados;
- nenhum provider, publicação, mensagem, IA, cobrança ou scheduler foi acionado;
- workflows do app e da API permaneceram saudáveis após a validação.

### Riscos e limitações remanescentes

- M03 é inspeção somente leitura; preview, diff e aprovação pertencem a M04–M06;
- hoje apenas `social_post` possui uma rota de origem persistida e verificável;
- facets refletem o conjunto filtrado atual, conforme o contrato;
- o bundle principal continua emitindo o aviso pré-existente de tamanho, sem falha de build.

## Última unidade concluída — M04 Preview universal

### Entregue no código

- [x] contrato OpenAPI e clientes/Zod regenerados;
- [x] endpoint read-only paginado separado sem alterar os contratos M01–M03;
- [x] ownership por workspace e campanha em todas as fontes;
- [x] sete fontes persistidas: conteúdo, media brief, creative, post social, asset, página e projeto de vídeo;
- [x] representações normalizadas para texto, imagem, vídeo, página, mensagem, anúncio e dados estruturados;
- [x] estados honestos `ready` e `unavailable`, com disponibilidade semântica por fonte;
- [x] JSON vazio serializado tratado como ausência de conteúdo;
- [x] cursor HMAC com expiração e vínculo a workspace, campanha, filtros e limite;
- [x] ordenação determinística por `updatedAt DESC`, `kind ASC`, `id DESC`;
- [x] filtros por fonte, status e período;
- [x] URLs restritas a HTTP(S) ou caminhos internos, sem credenciais, query ou fragmento;
- [x] preview de página sanitizado, sem scripts, atributos, navegação, formulários ou requisições externas;
- [x] CTA de anúncio somente simulado e vídeo sem autoplay;
- [x] estados de carregamento, erro inicial, erro de página adicional, vazio filtrado e fim da lista;
- [x] Escape, controles nativos, rótulos, foco de teclado e layout responsivo;
- [x] fallback seguro para payload desconhecido.

### Validação concluída

- [x] codegen e typecheck das bibliotecas, API e frontend;
- [x] build de produção do frontend;
- [x] testes focados M01/M02, M03 e M04;
- [x] `git diff --check`;
- [x] app e API reiniciados e saudáveis;
- [x] E2E autenticado com 23 registros, sete fontes e duas páginas;
- [x] filtros de fonte, status, período, combinação, inválido e vazio verificados;
- [x] todos os renderizadores e o estado indisponível verificados;
- [x] HTML hostil inertizado sem requisição externa;
- [x] fallback de payload desconhecido verificado isoladamente;
- [x] desktop 1440×1000 e mobile 390×844 sem overflow;
- [x] teclado, Escape, fechamento e links de origem verificados;
- [x] cleanup confirmado com zero resíduos em todos os fixtures.

### Provas do checkpoint

- primeira página: 20 de 23 previews; segunda carga: 23 de 23, sem lacunas ou duplicatas;
- contagens exatas por fonte: 6 conteúdo, 3 media briefs, 3 creatives, 4 posts sociais, 3 assets, 2 páginas e 2 projetos de vídeo;
- registros com apenas metadados permaneceram indisponíveis;
- roteiro `"{}"` e JSON recursivamente vazio permaneceram indisponíveis;
- texto social não vazio permaneceu corretamente disponível mesmo sem mídia;
- página hostil foi reduzida a markup inerte, sem tags perigosas ou atributos;
- anúncio exibiu CTA desabilitado; vídeo exibiu controles e não iniciou automaticamente;
- M01–M03 permaneceram visíveis e funcionais;
- nenhum provider, publicação, mensagem, IA, cobrança ou scheduler foi acionado;
- workflows do app e da API permaneceram saudáveis após a validação.

### Riscos e limitações remanescentes

- M04 é somente leitura; comparação, aprovação, edição, regeneração e execução pertencem a M05–M09;
- projetos de vídeo não possuem URL final própria na tabela atual; o preview usa somente roteiro/storyboard persistidos;
- formulários e checkout ainda não possuem uma fonte persistida dedicada no contrato M04;
- o bundle principal continua emitindo o aviso pré-existente de tamanho, sem falha de build.

## Última unidade concluída — M05 Version diff

### Entregue no código

- [x] catálogo read-only de fontes versionadas por campanha e workspace;
- [x] comparação de snapshots imutáveis do Master Plan;
- [x] comparação de revisões persistidas de páginas;
- [x] fontes mutáveis declaradas honestamente com `history_not_persisted`;
- [x] distinção entre histórico existente e histórico comparável;
- [x] seleção explícita de versão base e alvo, sem “versão atual” inferida;
- [x] diff determinístico por JSON Pointer, com adições, remoções, alterações, categorias e contagem de campos inalterados;
- [x] categorias para texto, estrutura, CTA, mídia, regras, fase e Master Plan;
- [x] sanitização de chaves sensíveis, credenciais, JWT, PEM e URLs sem falso resultado idêntico;
- [x] limites globais de profundidade, nós, itens, mudanças e bytes, com avisos de comparação incompleta;
- [x] contrato OpenAPI fortemente tipado e clientes React/Zod regenerados;
- [x] drawer responsivo com loading, erro, retry, vazio, histórico insuficiente, resultado inalterado e truncamento;
- [x] troca de fonte ou versão remove imediatamente qualquer resultado anterior;
- [x] Escape em dois níveis, controles acessíveis e ausência de overflow horizontal;
- [x] preservação dos contratos e interfaces M01–M04.

### Validação concluída

- [x] codegen e typecheck das bibliotecas, API e frontend;
- [x] build de produção do frontend;
- [x] testes focados M01/M02, M03, M04 e M05;
- [x] fixture M05 real de banco com ownership, IDOR, determinismo, sanitização, limites e imutabilidade;
- [x] diferenças isoladas após 4.096 caracteres, em valores sensíveis e somente em query/credenciais de URL;
- [x] payload adversarial de 3.500 itens com resposta limitada e aviso explícito;
- [x] revisão arquitetural independente sem bloqueadores críticos, altos ou médios;
- [x] `git diff --check`;
- [x] app e API reiniciados e saudáveis;
- [x] E2E autenticado com usuário, workspace, campanha e token temporários isolados;
- [x] Master Plan com três versões e página com duas revisões comparados pela UI;
- [x] desktop 1440×1000 e mobile 390×844 sem overflow;
- [x] reset imediato de resultado, Escape, fechamento, fontes indisponíveis e comparação de página verificados;
- [x] cleanup confirmado com zero usuário, campanha ou marcador residual.

### Provas do checkpoint

- todos os quatro endpoints protegidos exercitados no E2E retornaram 200;
- Master Plan: primeira comparação com 1 adição, 3 alterações e 6 campos inalterados; segunda seleção gerou resultado novo após reset explícito;
- página: 2 alterações reais, incluindo HTML e headline, com antes/depois;
- fontes sem histórico permaneceram visíveis e não acionáveis;
- diferenças em texto longo, segredo e URL permaneceram detectáveis sem expor caudas, tokens, credenciais, query ou fragmento;
- payload acima do orçamento marcou `summary.truncated` e `comparison_incomplete_due_to_limits`;
- mobile: documento e viewport com 390 px, cards contidos no drawer e botão de fechar alcançável;
- nenhuma escrita, aprovação, regeneração, publicação, IA, cobrança, scheduler ou provider foi acionado pelo M05.

### Riscos e limitações remanescentes

- M05 compara somente fontes com histórico imutável persistido: versões do Master Plan e revisões de página;
- conteúdo, media briefs, criativos, posts sociais, assets e projetos de vídeo ainda não possuem histórico persistido e não recebem versões inventadas;
- catálogos retornam no máximo 100 metadados por fonte e sinalizam truncamento;
- comparações que excedem os limites globais são parciais e sempre exibem aviso explícito;
- M05 é somente leitura; aprovação, rejeição e binding de decisão pertencem ao M06;
- o bundle principal continua emitindo o aviso pré-existente de tamanho, sem falha de build.

## Última unidade concluída — M06 Approval Center

### Entregue no código

- [x] inventário e adaptação das autoridades canônicas de Master Plan, conteúdo e checkpoints;
- [x] registro append-only de cada decisão com workspace, campanha, ator, subject, versão, snapshot completo e contexto;
- [x] aprovação, rejeição e solicitação de mudanças com motivo obrigatório nos dois últimos casos;
- [x] hash canônico calculado antes da sanitização, mantendo alterações ocultas detectáveis;
- [x] proteção contra versão obsoleta, corrida concorrente e replay idempotente conflitante;
- [x] invariantes de banco para ownership composto de campanha, subject e ator;
- [x] FKs tipados para Master Plan, conteúdo e checkpoint, checks de coerência e trigger contra update/delete;
- [x] status real `revision_requested` para conteúdo;
- [x] conclusão transacional de checkpoints pela máquina de estados canônica, com um único audit;
- [x] previews públicos redigidos e limitados, catálogo limitado a 25 itens e resposta total limitada a 192 KB;
- [x] adapters ainda não governados declarados honestamente como indisponíveis;
- [x] UI responsiva com pendências, histórico imutável, hashes, contexto, motivos, stale state e avisos de truncamento/redação;
- [x] nenhuma aprovação inicia publicação, execução, geração, provider ou cobrança.

### Validação concluída

- [x] migrations rastreadas `0040` a `0044` aplicadas e idempotentes;
- [x] OpenAPI, clientes React e schemas Zod regenerados;
- [x] typecheck das bibliotecas, banco, API e frontend;
- [x] builds de produção da API e frontend;
- [x] testes focados M01–M05 preservados;
- [x] teste M06 com dois workspaces, ownership/IDOR, stale, corrida, idempotência e versão exata;
- [x] teste de update/delete bloqueado pelo banco, FKs compostos, ator estrangeiro e bindings de checkpoint;
- [x] teste adversarial acionando os limites de previews e decisões recentes;
- [x] fixture legado do Master Plan atualizado sem enfraquecer o gate de produto/intake;
- [x] revisão arquitetural independente sem bloqueadores críticos, altos ou médios;
- [x] app e API reiniciados e saudáveis;
- [x] E2E autenticado em 1440×1000 e 390×844;
- [x] stale conflict distinto, motivos obrigatórios, `revision_requested` e transição após o último checkpoint verificados pela UI;
- [x] ausência de overflow horizontal e controle de fechar alcançável no mobile;
- [x] cleanup confirmado do usuário, workspace, campanha e decisões do fixture.

### Provas do checkpoint

- catálogo inicial exibiu 6 pendências reais: 1 Master Plan, 3 conteúdos e 2 checkpoints;
- aprovação, rejeição e solicitação de mudanças geraram exatamente uma decisão imutável por snapshot;
- tentativa de aprovar o Master Plan alterado após a abertura retornou conflito 409 e não criou decisão;
- a versão atualizada pôde ser revisada e aprovada após reload;
- a campanha permaneceu `awaiting_approval` até o segundo checkpoint e depois passou uma única vez para `approved`;
- seis decisões finais continham workspace, campanha, ator, subject, hashes e bindings de versão/contexto aplicáveis;
- motivos de rejeição e revisão foram persistidos;
- nenhum crédito, provider log, execução de agente, evidência externa ou publicação social foi criado;
- o sucesso informou explicitamente que nenhuma publicação ou execução foi iniciada.

### Riscos e limitações remanescentes

- M06 governa somente Master Plan, conteúdo e checkpoints; page, social, creative e video permanecem `adapter_not_governed`;
- o catálogo mostra no máximo 25 pendências por resposta e avisa quando está truncado;
- decisões recentes também podem ser reduzidas para respeitar o orçamento total de 192 KB;
- o E2E confirmou ausência de efeitos externos nas tabelas com escopo por campanha; tabelas legadas sem `campaign_id` continuam dependentes das garantias de código e testes focados;
- M06 não executa efeitos; a autoexecução condicionada existe somente no contrato restrito do M08;
- o bundle principal continua emitindo o aviso pré-existente de tamanho, sem falha de build.

## Última unidade concluída — M07 SLA e lembretes

### Entregue no código

- [x] obrigação operacional separada da decisão imutável e vinculada a workspace, campanha, ator, subject e hash exato;
- [x] janela imutável `warningAt < dueAt < escalationAt <= expiresAt`, com aviso fixo uma hora antes do vencimento;
- [x] canal `in_app` governado; canais externos rejeitados até possuírem autorização e recibo;
- [x] eventos append-only de aviso, vencimento, escalonamento e expiração, cada um com receipt e audit;
- [x] scheduler de 60 segundos com seleção determinística de eventos devidos ainda ausentes, sem starvation após 250 itens;
- [x] locks compartilhados entre agendamento, decisão e scheduler, com revalidação transacional contra expiração;
- [x] decisão resolve somente a obrigação do snapshot exato; expiração nunca aprova;
- [x] contadores exatos por estado e detalhes/histórico limitados aos itens do catálogo;
- [x] UI responsiva para agendar, acompanhar prazo, próximo evento e histórico imutável;
- [x] estado expirado sem controles de decisão e com explicação explícita de segurança;
- [x] nenhuma operação M07 publica, executa, gera, chama provider externo ou cobra créditos.

### Validação concluída

- [x] migration rastreada `0045_approval_sla.sql` aplicada e em paridade com o schema Drizzle;
- [x] OpenAPI, cliente React e schemas Zod regenerados;
- [x] typecheck do banco, bibliotecas, API e frontend;
- [x] builds de produção da API e frontend;
- [x] testes focados M07 e regressão M01–M06;
- [x] replay idempotente, conflito de janela, ownership, stale snapshot, expiração e triggers append-only verificados;
- [x] ticks concorrentes produzem um único evento/audit por tipo;
- [x] revisão arquitetural independente concluída com PASS e sem bloqueadores;
- [x] app e API reiniciados e saudáveis;
- [x] E2E autenticado em 1440×1000 e 390×844;
- [x] persistência após reload, aviso in-app via polling e expiração sem ações de decisão verificados;
- [x] ausência de overflow horizontal e erros de console/API no fluxo autenticado.

### Provas do checkpoint

- resumo exibiu duas pendências, uma expirada e, após agendamento, uma vencendo em breve;
- o aviso foi persistido com diferença exata de 3.600.000 ms para o vencimento;
- reload preservou status, deadline, próximo evento e histórico in-app;
- item expirado exibiu quatro eventos e zero controles de aprovar, rejeitar ou solicitar revisão;
- nenhuma ação externa foi iniciada durante o E2E;
- testes M01–M06 continuaram aprovados após a integração do M07.

### Riscos e limitações remanescentes

- apenas o canal in-app está autorizado; e-mail e WhatsApp exigem autorização, adapter e receipt próprios;
- a expiração encerra a obrigação, mas não recria nem descarta automaticamente o subject;
- o M07 continua restrito aos subjects governados pelo M06: Master Plan, conteúdo e checkpoints;
- aprovação M07 continua sem executar; somente uma política M08 separada e vigente pode autorizar a pausa governada;
- o bundle principal continua emitindo o aviso pré-existente de tamanho, sem falha de build.

## Última unidade concluída — M08 Autoexecução condicionada

### Entregue no código

- [x] política versionada, desativada por padrão, autorizada somente pelo owner, revogável e com expiração obrigatória;
- [x] binding imutável ao Master Plan aprovado, hash do snapshot e fingerprint de contexto exatos;
- [x] única ação suportada: `paid_media_pause`; resume, budget, bid, launch, social e cross-platform continuam não suportados;
- [x] aprovação permanece sem efeitos externos e nunca cria intento de execução;
- [x] preflight determinístico e fail-closed para policy atual, campanha, binding, proposta, ownership, credencial, saúde/freshness e teto diário;
- [x] intent e attempt duráveis/idempotentes antes da chamada externa;
- [x] locks advisory PostgreSQL de sessão em ordem campanha → intent, compartilhados com criação/revogação e mantidos durante apply/readback;
- [x] recuperação após restart somente por readback, sem repetir `apply`;
- [x] sucesso somente com receipt do provider e readback independente correspondente; mismatch/erro exige recuperação;
- [x] finalização transacional na mesma conexão física do lock, com fencing por owner;
- [x] recibos/evidências sanitizados recursivamente e limitados por profundidade, nós e bytes;
- [x] painel responsivo com estado, binding, alvo, limites, bloqueadores, histórico e revogação, sem botão manual de executar.

### Validação concluída

- [x] migrations rastreadas `0046`–`0052` aplicadas e schema Drizzle em paridade;
- [x] OpenAPI, clientes React e schemas Zod regenerados;
- [x] typecheck do banco, API e frontend;
- [x] builds de produção da API e frontend;
- [x] teste adversarial M08 e regressões M01–M07 aprovados;
- [x] concorrência com provider atrasado comprovou uma chamada, revogação bloqueada durante a chamada e zero apply duplicado;
- [x] supersession, daily ceiling, restart, stale binding, CAS, mismatch, append-only, tenant scope e FKs compostas verificados;
- [x] revisão arquitetural independente concluída com PASS e sem bloqueadores críticos, altos ou médios;
- [x] app e API reiniciados e saudáveis;
- [x] E2E autenticado em 1440×1000 e 390×844 com integração bloqueada e sem rede externa;
- [x] política ativa, expiração válida, bloqueio `CREDENTIAL_UNHEALTHY`, revogação e histórico vazio verificados;
- [x] ausência de overflow horizontal, controle de fechar e ausência de botão de execução confirmados;
- [x] cleanup confirmado com zero resíduos do fixture e preservação do usuário/workspace existentes.

### Provas do checkpoint

- a política criada pela UI ficou ativa em v1 e foi depois revogada, mantendo o binding exato;
- integração com `blocksExecution=true` permaneceu inelegível e produziu zero intents, zero attempts, zero receipts e zero evidências de confirmação;
- a proposta permaneceu `approved`, sem transição para `executing` ou `verified`;
- duas execuções concorrentes sobre o mesmo intent produziram exatamente um apply e uma verificação;
- revogação concorrente só concluiu após a chamada já autorizada terminar;
- intent elegível de policy superseded foi bloqueado sem chamada ao provider;
- intents com action de outra policy ou policy de outra campanha foram rejeitados pelo banco;
- nenhum provider real, publicação, mensagem, IA ou cobrança foi acionado no E2E.

### Riscos e limitações remanescentes

- M08 cobre somente pausa de mídia paga; nenhuma outra mutação está autorizada;
- revogação impede novas chamadas, mas não pode cancelar retroativamente uma chamada externa que já cruzou a fronteira autorizada;
- perda catastrófica da sessão de lock deixa a tentativa durável para readback-only; um teste com `pg_terminate_backend` permanece uma cobertura adicional, não um bloqueador estrutural;
- credenciais e saúde operacional devem permanecer frescas; falha ou dúvida bloqueia execução;
- recibo sem readback correspondente nunca é apresentado como sucesso;
- o bundle principal continua emitindo o aviso pré-existente de tamanho, sem falha de build.

## Protocolo obrigatório após cada desenvolvimento

1. atualizar data e checkpoint atual;
2. marcar somente itens sustentados por prova;
3. registrar comandos e testes executados;
4. registrar riscos e limitações;
5. atualizar estágio operacional e nível de maturidade afetados;
6. indicar o próximo checkpoint único;
7. não avançar se houver falha crítica ou alta;
8. não usar interface ou documento como prova de execução externa;
9. manter o `NEXOS_CAPABILITY_INDEX.md` sincronizado;
10. preservar os fluxos anteriores incorporados.

## Referências

- [`NEXOS_CAPABILITY_INDEX.md`](./NEXOS_CAPABILITY_INDEX.md)
- [`NEXOS_WORKFLOW_MAP.md`](./NEXOS_WORKFLOW_MAP.md)
## Última unidade concluída — M09 Contratos de realização

### Entregue no código

- [x] Contrato de realização unificado atuando como ledger para execuções externas;
- [x] Suporte restrito a `paid_media_pause` e `paid_media_launch`, explicitly labeling any other verticals as unsupported/not governed;
- [x] State machine determinística para cada contrato (proposal, preflight, provider_confirmed, artifact_qc, recovery, etc.);
- [x] Tracking de idempotency key, context fingerprint, bind hash e masterplan association;
- [x] Orquestração transacional de retry, compensação durável e readback;
- [x] UI nativa responsiva M09 conectada ao Control Room (sumários e logs visuais dos attempts);
- [x] Actions rigorosas no Frontend: Retry, QC, Monitor, Compensate (execute só se valid).
- [x] Componentes `RealizationContractPanel` e Drawer implementados com a estética correta.

### Validação concluída

- [x] Migrations Drizzle aplicadas, OpenAPI definitions integradas e sem quebras (`codegen` OK);
- [x] Hooks gerados pelo Orval consumidos adequadamente pelo Frontend App;
- [x] Typechecks concluídos sem erro (0 errors in UI);
- [x] `npm run build` aprovado para produção (`BASE_PATH=/` `PORT=3000`).
- [x] Nenhuma criação inventada sem approval subject autorizado; estado de "zero contratos" lida apropriadamente com empty-states no UI.

## Última unidade concluída — M10 Council operacional

### Entregue no código

- [x] Ciclos vinculados à campanha, ao Master Plan aprovado e ao fingerprint/hash exatos; atas, decisões, ações e outcomes são append-only.
- [x] Decisões registram responsável, justificativa, evidências, meta, baseline, limiar, janela e prazo; a interface coleta os valores reais e mostra o histórico.
- [x] Ações apenas referenciam contratos M09 já existentes de `paid_media_pause` e `paid_media_launch`; o Council não aprova, não cria attempts e não chama providers.
- [x] Verificação read-only exige ciclo posterior da mesma vinculação com ata que cite o contrato, contrato monitorado, último attempt confirmado, receipt, readback, QC aprovado e monitor vinculados ao attempt; evidência nova permite reverificação de resultado inconclusivo.
- [x] Constraints, FKs, trigger de binding exato, sanitização e locks transacionais bloqueiam referências fora do escopo, famílias não governadas e duplicações concorrentes.

### Provas e limites

- [x] Migrações rastreadas aplicadas; OpenAPI e hooks gerados; testes adversariais M08–M10, typechecks e builds da API e do app aprovados.
- [x] Teste M10 cobre escopo tenant, plano diferente na mesma campanha, concorrência, ciclo posterior e ata vinculada, mutação direta indevida, append-only, ambas as famílias M09 e reverificação sem execução externa.
- [ ] Homologação de resultado comercial real em provider/produção não foi feita nesta unidade; verificação M10 comprova evidência persistida de M09, não sucesso de negócio fora dela.

### M11 — Content/Social em andamento

- [x] Inbox histórico de comentários/conversas com escopo por workspace, paginação e relatório persistido imutável; agregados contam todas as linhas do período (o preview permanece limitado).
- [x] Preview de publicação com fingerprint de conteúdo, Master Plan e contas-alvo; confirmação rejeita preview desatualizado e retorna o estado de cada destino em vez de prometer sucesso geral.
- [x] Posts duráveis deduplicados por workspace/peça/integração; publicação Facebook simulada localmente comprova tentativa, receipt, readback e evidência `provider_confirmed`. Falhas e permissões não são mascaradas como publicação.
- [ ] A aprovação da peça ainda não guarda o hash/payload e a versão do Master Plan aprovados no instante da decisão. Mudanças posteriores e edições de posts de campanha precisam invalidar ou bloquear o envio.
- [x] O hook legado de aprovação e a finalização de mídia não criam mais novos posts automaticamente; chamadas diretas ao helper falham sem confirmação. A publicação explícita exige fingerprint de preview até no serviço. Novos agendamentos de campanha sem autorização ficam bloqueados desde a criação; os antigos são preservados, mas passam para falha explícita antes de qualquer envio quando vencerem. A rota legada de publicar um post de campanha sem prévia também foi fechada.
- [ ] Política versionada de autopublicação por ausência de resposta e vínculo imutável da aprovação ao payload/plano/contas ainda não existem. Falta uma reconciliação segura para os registros bloqueados: confirmar nova prévia não garante reutilização de uma linha antiga falhada se seu payload divergiu. Não considerar a vertical governada ou reativar o bypass até implementar e provar todos os gates.
- [ ] Validar UI autenticada, recuperação, métricas de provedor atribuíveis e um percurso vertical único. O teste de Graph usa transporte simulado: permissões e publicação/readback reais do Meta **não foram homologados**.
- [ ] Antes de aplicar a migração de chave natural em produção, verificar duplicados históricos e reconciliá-los manualmente se existirem; a migração falha de forma segura e não apaga posts.

**Próximo checkpoint único:** concluir e comprovar M11 Content/Social full-stack, sem promover outras famílias do Council a executáveis antes de contratos governados e prova independente.

### M12 — Lifecycle em andamento, somente fundamentos locais

- [x] Contatos e eventos de compra, expiração e reembolso existentes agora aparecem em um painel read-only com dados de contato mascarados, listas paginadas e estados de ação explícitos. O LTV apresentado é o valor do ledger local, não uma métrica comercial atribuída por provedor.
- [x] O scheduler reconcilia ações de recuperação inválidas com venda e consentimento atuais: suprime com registro idempotente; não envia e não marca ação pendente como concluída. Projeções locais de pagamento/reembolso e evento são atômicas; a recuperação de vendas terminais sem evento é limitada e repetível.
- [x] Testes DB em workspace descartável cobrem deduplicação, concorrência, reparo, reembolso, isolamento e paginação. Nenhuma mutação externa integra estes testes.
- [x] Sem prova de entrega, ativação manual e elegibilidade consequente para upsell ficam bloqueadas; estágio de comprador não pode ser declarado manualmente.
- [ ] Transações históricas com evento antigo possivelmente parcial exigem auditoria antes de reparo manual; receita externa fora de product_sales ainda não compartilha a transação atômica. Não inferir fulfillment de status local.
- [ ] Não há política de consentimento/execução versionada, executor de mensagens autorizado, comprovante independente de onboarding, readback, atribuição de resultados, otimização governada ou homologação real. M11 permanece incompleto; M12 não é `production_proven`.
