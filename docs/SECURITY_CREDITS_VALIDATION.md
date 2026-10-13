# Validação de segurança e créditos — 13/10/2026

**Registro inicial: aprovação parcial. Os bloqueadores dos runners foram resolvidos e retestados em [AGENT_CREDIT_DELIVERY.md](AGENT_CREDIT_DELIVERY.md).** Isolamento e regressões do livro de créditos passaram; a contabilização completa das gerações de IA ainda tem bloqueadores. Não equivale a auditoria de segurança completa nem aprovação para produção.

## Evidência executada

Dez scripts passaram em PostgreSQL 17 + Redis descartáveis, com o código atual montado e sem credenciais reais de provedores. Dois usuários, três campanhas (duas da mesma conta e uma de outra conta), requisições HTTP reais contra as rotas e verificações no banco. Ambiente de homologação usado apenas em transações READ ONLY.

| Área | Resultado |
| --- | --- |
| Memória, contexto e escrita entre usuários/projetos | PASS: acesso cruzado rejeitado; FK e escopo imutável verificados |
| Execuções concorrentes e eventos em tempo real | PASS: contextos e assinaturas isolados, incluindo falha de dependência |
| Saldo/histórico/uso de créditos via HTTP | PASS: sessão ausente ou com proprietário diferente rejeitada; seletor de workspace alheio ignorado |
| Recarga gratuita para cliente comum | PASS: 403 e saldo preservado |
| Dezesseis cobranças com a mesma chave | PASS: um débito, um registro, saldo correto |
| Cobranças e concessões concorrentes | PASS: cadeia de saldos serializada, sem saldo perdido |
| Confirmações repetidas de pagamento | PASS: concessão única; indisponibilidade e notificação adulterada não concedem créditos |
| Reversões/estornos de pagamento e renovação mensal | PASS: repetição não duplica reversão; dívida preservada; saldo bloqueado durante estorno pendente |
| Geração com nenhum provedor configurado | PASS: execução real do runner termina failed, sem débito ou alteração do saldo |
| Débito de custo fixo sem saldo | PASS: rejeição sem alteração do livro ou saldo |
| Cookies, logs e autenticação de webhooks | PASS nas regressões existentes |
| Permissões reais do SQL de homologação | PASS: runtime restrito, APIs Supabase sem acesso ao esquema, marcador/migrações protegidos |

O teste novo inicialmente falhou em test-security-credits-db.ts:34, pois uma chave de outra conta era aceita como repetição. Corrigido em credits.service.ts: o débito confere conta, campanha, tipo, ação e valor. Campanha alheia também é rejeitada antes de qualquer débito; a atualização de custo usa workspace e campanha.

Comando reproduzível: node scripts/validate-security-credits.mjs. Requer Docker e imagem nexos-api:p3-test previamente construída. O script prepara e remove apenas seu projeto nexos-security-credit-tests, usa rede interna e grava logs em .local/security-credit-evidence. A verificação SQL real é separada: node scripts/verify-homologation-security.mjs (somente leitura). Typecheck da API passou.

## Consulta real da conta founder

Saldo 0; unlimitedCredits ativo; 35 registros; zero chaves duplicadas. Vinte registros de débito têm diferença de saldo distinta do valor registrado e dezenove partem e terminam em zero. Esses números NÃO demonstram cobrança indevida: contas ilimitadas podem registrar consumo sem alterar o saldo. Não modificamos saldo, plano, campanha ou materiais. A conciliação deve distinguir consumo estimado, débito efetivo e isenção.

## Bloqueadores ainda abertos

1. **Política divergente entre geradores e livro de créditos.** agent.runner.ts mantém saldo baixo como aviso, usa Math.max(0, saldo - custo) e registra o custo total. Também trata erro de cobrança como não fatal. Já deductCredits rejeita saldo insuficiente e respeita isenção. O sucesso de uma geração não comprova débito ou isenção corretamente conciliados.
2. **Bloqueio de estorno e conta ilimitada no runner.** A inspeção do código mostra que o caminho de débito independente do runner não reutiliza as verificações de refundHold/unlimited de credits.service.ts. Os testes de estorno passaram para esse serviço, não certificam todas as gerações.
3. **Falha depois da geração.** Ainda falta injetar falha de persistência após débito e comprovar resultado recuperável ou compensação idempotente; testar sucesso/repetição de geração com resposta de provedor controlada. O teste de ausência de provedor não cobre essa fase posterior.

Imagens/vídeos fora do escopo; Asaas real, inferência paga, publicação e mensagens externas não foram acionados. Próximo checkpoint: unificar reserva/débito/isenção e compensação das gerações e executar testes de falha após geração antes de encerrar esta homologação.
