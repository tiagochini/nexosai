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

É uma credencial administrativa compartilhada, não autorização por conta.
Ainda faltam migração para sessão autenticada com papel de proprietário,
limitação de tentativas específica, trilha de auditoria das ações e revisão
integral das demais rotas e códigos de acesso. Clientes administrativos
externos não foram exercitados. Não colocar esse segredo em JavaScript público,
URLs, logs ou no repositório.

Sem migração de banco. Um rollback do código anterior reintroduziria acesso
padrão e o scheduler exposto; preferir correção adiante e não restaurar esse
comportamento em produção.
