# Academy — proteção administrativa

Revisão local: 5 de outubro de 2026. [English](./ACADEMY_ADMIN_SECURITY.en.md).

## Correção

Foi removida a senha padrão embutida nas rotas administrativas/CRM. Todas as
11 rotas revisadas usam a mesma verificação, incluindo `/funnel-tick`, que não
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

O teste sobe somente um servidor HTTP local temporário, testa as 11 rotas com
configurações ausentes/fracas e credenciais ausentes/padrão/URL, e verifica que
um cabeçalho válido chega à validação de entrada. Não confirma compras, gera
códigos, executa o scheduler, envia e-mails ou altera o banco. A configuração
temporária do processo de teste é restaurada no `finally`.

Typecheck, build e guard/testes de logs passaram localmente. O workflow foi
atualizado, mas não foi executado remotamente nesta etapa: não houve push.
A API em execução não foi reiniciada automaticamente.

## Limites

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

Permanecem pendentes: limitação de tentativas nos endpoints públicos de validação,
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
