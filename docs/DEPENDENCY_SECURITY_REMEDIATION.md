# Correção de dependências de produção

English: [DEPENDENCY_SECURITY_REMEDIATION.en.md](./DEPENDENCY_SECURITY_REMEDIATION.en.md)

Data: 3 de outubro de 2026.

## Resultado e escopo

A auditoria inicial registrou 75 alertas (39 altos, 31 moderados e 5 baixos).
Após as correções, `pnpm run security:audit-dependencies` não encontrou
vulnerabilidades conhecidas no grafo de produção. Isso não comprova ausência de
falhas no código nem cobre dependências exclusivamente de desenvolvimento.

- Removido `html-pdf-node`, sem referências no código dos scripts. Sua cadeia
  antiga de Puppeteer deixou de ser instalada; o Puppeteer moderno separado foi
  preservado. Nenhum gerador de PDF foi reescrito.
- Multer atualizado para 2.4.0; Nodemailer para a faixa 10 (lock: 10.0.13).
- Lockfile atualizado dentro das faixas compatíveis existentes, incluindo
  Express/body-parser/qs, Socket.IO/Engine.IO/ws, DOMPurify e fflate.
- Overrides limitados a `gaxios>uuid` e `teeny-request>uuid` em 11.1.1,
  preservando CommonJS. Não foi forçado UUID 14 nos clientes legados do Google.
- Uploads de intake e vídeo limitam índices de arrays multipart a 100, evitando
  arrays esparsos de tamanho excessivo. Limites de tamanho de arquivo preservados.
- CI executa auditoria com `--prod --audit-level low`; qualquer severidade
  conhecida falha o job. Falha de acesso ao registro também não é ignorada.
- A política de espera mínima de 24 horas para novos pacotes foi preservada.

## Verificação reproduzível

```powershell
pnpm install --frozen-lockfile
pnpm run security:audit-dependencies
pnpm --filter @workspace/api-server run test:dependency-runtime
pnpm --filter @workspace/db run test:token-encryption
pnpm --filter @workspace/api-server run test:integration-security
pnpm --filter @workspace/api-server run test:auth-cookie-security
pnpm run build
pnpm run security:scan
```

O teste de dependências passou com serialização local de e-mail (sem envio),
UUID v4 via CommonJS nos clientes Google, cliente GCS sem rede, JSON e formulários,
upload no limite e acima dele, rejeição de índice multipart excessivo, handshake
Engine.IO, protocolo inválido e resposta válida após erros.

Os testes de cadastro concorrente e sessões HTTP passaram no PostgreSQL local:
cookie, CSRF, rotação concorrente, replay, mudança de workspace, expiração e logout.
Eles criam fixtures temporárias e as removem; não enviam mensagens ou publicações.
O teste local de comunicação em tempo real usa polling e não certifica WebSocket,
autorização das salas, carga ou recuperação de Redis.

Nodemailer 10 exige Node.js 20 ou superior; o CI usa Node.js 24. Os testes de
e-mail não certificam autenticação ou entrega SMTP real. A auditoria deverá ser
reexecutada a cada atualização, pois novos alertas podem surgir.

## Rollback

Restaurar conjuntamente manifests e lockfile do commit anterior, reinstalar com
`--frozen-lockfile` e refazer o build. Isso reintroduz vulnerabilidades conhecidas;
não é uma alternativa segura para produção aberta. Nenhuma migração de banco
ou alteração de chave é necessária nesta etapa.

## Referências dos mantenedores

- [Multer: mudanças e limites multipart](https://github.com/expressjs/multer/blob/main/CHANGELOG.md).
- [Nodemailer: mudanças da versão 10](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md).

Continuam pendentes os demais itens do plano, especialmente logs sensíveis,
Redis, backup/restauração, jornada sandbox e qualidade da IA.
