# Fechamento técnico do P0

Status: implementação local concluída; fechamento para liberação ainda pendente
de build completo, administrador real e evidência Asaas sandbox.

05/10/2026. [English](P0_SECURITY_CLOSEOUT.en.md).

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

1. Cadastre normalmente a conta real do administrador. Configure `ACADEMY_ADMIN_USER_IDS` com seu UUID (separado por vírgula para mais de um). Não use e-mail como critério de privilégio. Entre novamente para receber token vinculado à sessão. Banco local está sem usuários; nenhum administrador ou senha foi inventado.
2. Mantenha `ACADEMY_ALLOW_LEGACY_ADMIN_SECRET=false`. O modo legado só existe para compatibilidade explícita em desenvolvimento/testes e nunca funciona em produção. As rotas de sessão/conciliação recusam essa alternativa em qualquer ambiente.
3. Aplique `0067_academy_admin_audit.sql` antes da API nova. Preserve as tabelas em eventual rollback; voltar ao código antigo reintroduz o acesso compartilhado e não deve ser uma estratégia de produção.
4. Configure Redis privado/persistente e a lista exata de proxies confiáveis. As cotas são por origem, inclusive para alunos atrás de NAT: avalie esse limite em homologação. Não remova o bloqueio em falhas para contornar indisponibilidade.
5. Configure a credencial do Asaas sandbox e os tokens/eventos dos webhooks; execute a jornada sandbox autorizada antes de ativar produção. A configuração local não contém `ASAAS_API_KEY`, logo essa validação externa não foi executada. Nenhum pagamento, e-mail ou estorno real foi feito.

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

Testes locais: `test:academy-p0-db`, `test:academy-quota-redis`, `test:academy-admin-security`, `test:academy-verification-security`, `test:academy-delivery-lifecycle-db`, `test:auth-sessions-http`, `test:auth-cookie-security`, `test:academy-access-outbox-db`, `test:billing-reversal-db` e `test:log-security`. Passaram guard do cliente, typecheck completo, build da API, scanner de segredos, auditoria do histórico e auditoria de dependências. O build completo/frontend no Windows ficou excessivamente lento, com alto uso de memória; as tentativas próprias foram encerradas. Scanner e compilador CSS passaram isoladamente, mas isso não aprova o bundle. Ajustes experimentais de CSS foram retirados, sem conclusão sobre a causa. CI foi preparado com PostgreSQL e Redis descartáveis, mas não executado remotamente: sem push por determinação do usuário.

Fechamento técnico local não é liberação de produção. Restam configuração do administrador real, credencial/webhooks Asaas, sandbox e execução remota autorizada. Retenção/acesso de logs, consoles de terceiros, scripts diagnósticos e serviços Python não são certificados por esse guard. O curso contém materiais estáticos no frontend: essas correções protegem administração/API/tutor, mas não são DRM; entrega de material pago exclusivamente pelo servidor é uma frente separada de licenciamento.
