# Academy — proteção administrativa

Atualização P0: [sessões individuais, frontend e auditoria](P0_SECURITY_CLOSEOUT.md).
O contrato por segredo descrito abaixo é histórico; agora exige opt-in explícito
somente em desenvolvimento/testes e é recusado em produção.

Revisão local: 5 de outubro de 2026. [English](./ACADEMY_ADMIN_SECURITY.en.md).

## Correção

Foi removida a senha padrão embutida nas rotas administrativas/CRM. Todas as
12 rotas revisadas usam a mesma verificação, incluindo `/funnel-tick` e
`/simulate-confirm`, que não
verificava autorização. Listagens de leads/compras, estatísticas, confirmação
de compras, geração de códigos e alterações de CRM exigem credencial válida
antes de consultar dados ou executar ações.

Configurar `ACADEMY_ADMIN_SECRET` no ambiente privado do servidor com um valor
aleatório criptograficamente seguro, de 32 a 256 caracteres, sem espaços nas
extremidades. Enviar exclusivamente pelo cabeçalho `x-admin-secret`, por HTTPS
fora do desenvolvimento local. A comparação usa `timingSafeEqual` após validar
os comprimentos. Ausência, vazio ou valor curto bloqueiam as rotas com `401`.

Não existe segredo padrão em `.env.example`. Nenhum segredo novo foi gerado,
exibido, gravado ou alterado em `.env.local` nesta etapa. Se a configuração
atual estiver ausente ou for curta, os acessos administrativos ficarão
desabilitados após reiniciar a API. Clientes antigos com `?secret=...` devem
ser adaptados para o cabeçalho; parâmetros de URL não autenticam mais.

## Evidência e operação

```powershell
pnpm --filter @workspace/api-server run test:academy-admin-security
```

O teste sobe somente um servidor HTTP local temporário, testa as 12 rotas com
configurações ausentes/fracas e credenciais ausentes/padrão/URL, e verifica que
um cabeçalho válido chega à validação de entrada. Não confirma compras, gera
códigos, executa o scheduler, envia e-mails ou altera o banco. A configuração
temporária do processo de teste é restaurada no `finally`.

Typecheck, build e guard/testes de logs passaram localmente. O workflow foi
atualizado, mas não foi executado remotamente nesta etapa: não houve push.
A API em execução não foi reiniciada automaticamente.

## Limites

### Validação pública e origem de pagamentos

`GET /verify/:token` aceita até 10 tentativas em 15 minutos por endereço IPv4
ou bloco IPv6 `/56`, incluindo tentativas inválidas e válidas. Depois disso,
retorna `429`, código `ACADEMY_VERIFICATION_RATE_LIMITED` e `Retry-After`.
O limite também vale em desenvolvimento e independe do código consultado.

Por padrão, usa o IP da conexão, não cabeçalhos encaminhados pelo cliente.
Atrás de proxy reverso, configurar `ACADEMY_TRUSTED_PROXY_IPS` com os IPs exatos
dos proxies controlados. Esses proxies devem sobrescrever/anexar corretamente
o endereço real do cliente; o app atualmente confia em um salto de proxy.
Entradas inválidas e redes amplas não são aceitas pela verificação. Sem essa
configuração, usuários atrás do mesmo proxy compartilham a cota. Configuração
incorreta pode bloquear usuários ou permitir falsificação de origem.

O armazenamento da cota é em memória por processo; reinício a zera e múltiplas
instâncias têm cotas separadas. Redis/store compartilhado e revisão da confiança
global em proxy continuam pendentes. A quota não é garantia contra ataques
distribuídos. Outros endpoints não recebem essa quota específica.

O webhook `/webhook` agora exige `ASAAS_WEBHOOK_TOKEN` configurado e o cabeçalho
`asaas-access-token` correspondente, antes de processar o evento. Sem token,
ou com token incorreto/na URL, retorna `401`. Configurar o mesmo token privado
no servidor e no provedor; nenhum valor foi alterado nesta etapa. Confirmação
simulada exige a credencial administrativa e continua proibida em produção.

Testes locais cobrem excesso de tentativas com alteração de código e de
`X-Forwarded-For`, agrupamento IPv6, isolamento de outras rotas e rejeição de
eventos de pagamento não autenticados. Um evento autenticado não reconhecido
é aceito sem modificar compras. Não houve teste de confirmação de pagamento
real. Ainda faltam conciliação do pagamento no provedor e proteção contra replay.

```powershell
pnpm --filter @workspace/api-server run test:academy-verification-security
pnpm --filter @workspace/api-server run test:academy-admin-security
```

### Geração dos códigos de acesso

Checkout e brindes usam o mesmo gerador baseado em `node:crypto.randomInt`,
sem `Math.random` nem fallback não criptográfico. O formato existente de três
grupos de quatro caracteres foi preservado, assim como o alfabeto de 32 símbolos
sem letras ambíguas. São 60 bits de aleatoriedade por código novo; a mudança
melhora a fonte de aleatoriedade, não aumenta o comprimento/entropia do formato.
Códigos anteriores não foram rotacionados, modificados ou excluídos.

Solicitações de brindes exigem corpo JSON válido e `count` inteiro entre 1 e 50;
se omitido no objeto, o padrão é 5. Valores negativos, zero, fracionários, strings
e lotes maiores não geram códigos. A restrição única do banco continua sendo a
garantia final contra colisão; ainda falta retentativa específica para colisões.

```powershell
pnpm --filter @workspace/api-server run test:academy-access-code
pnpm --filter @workspace/api-server run test:academy-admin-security
```

O teste gera 1.000 amostras somente em memória, com `Math.random` bloqueado,
verifica formato e ausência de duplicação nessa amostra, sem imprimir códigos.
Não é uma prova estatística de entropia ou garantia de ausência de colisões.
O teste HTTP rejeita entradas inválidas e verifica os limites 1/50 e o padrão
antes da validação de produto, sem inserir brindes ou consultar compras reais.
Nenhum código existente ou compra real foi alterado pelos testes.

Permanecem pendentes: cotas compartilhadas entre instâncias,
armazenamento protegido dos códigos, validade/revogação e revisão de respostas
com dados pessoais. Geração criptográfica não resolve sozinha esses riscos.

É uma credencial administrativa compartilhada, não autorização por conta.
Ainda faltam migração para sessão autenticada com papel de proprietário,
limitação de tentativas específica, trilha de auditoria das ações e revisão
integral das demais rotas e códigos de acesso. Clientes administrativos
externos não foram exercitados. Não colocar esse segredo em JavaScript público,
URLs, logs ou no repositório.

Sem migração de banco. Um rollback do código anterior reintroduziria acesso
padrão e o scheduler exposto; preferir correção adiante e não restaurar esse
comportamento em produção.
