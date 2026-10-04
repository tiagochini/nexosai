# Proteção dos logs — etapa local

English: [LOG_SECURITY.en.md](./LOG_SECURITY.en.md)

## Mudanças

O logger central agora sanitiza objetos, mensagens e bindings antes da saída,
incluindo loggers filhos e `setBindings`. Não altera os objetos originais.

- Campos de credenciais, tokens, e-mails, telefones, nomes, documentos,
  fingerprints, IPs identificados por nome de campo, cookies e headers são ocultados.
- Corpos, payloads, prompts, transcrições, screenshots, SQL e parâmetros não
  entram em logs estruturados. Buffers também são omitidos.
- Erros conservam apenas tipo genérico, códigos operacionais reconhecidos e
  status HTTP válido. Mensagem, stack, cause e respostas de SDKs são removidos.
- Texto livre passa por filtros para URLs absolutas, Bearer/JWT, padrões de
  chaves conhecidas, atribuições de credenciais e e-mails. Isso não identifica
  automaticamente todo segredo opaco ou informação pessoal em texto livre.
- O logger HTTP usa somente ID/método/status; URLs, segmentos dinâmicos,
  query strings e headers não são registrados. A identificação do endpoint
  precisa ser correlacionada com mensagens estáticas do módulo.
- IDs internos, status, contadores de tokens da IA e mensagens estáticas úteis
  continuam disponíveis. IDs internos são pseudônimos, não anonimização.
- Sanitização tem limites de profundidade, quantidade de campos/itens e texto,
  evita getters/toJSON e lida com ciclos sem derrubar o logger.

Foram removidos diretamente dos logs revisados códigos de convite, e-mails
da Academy/admin, telefones de destinatários WhatsApp, fingerprints e respostas
brutas de Asaas/Resend. Falhas Redis registram classificação fixa, sem texto
retornado pelo servidor. O aviso direto via console no contexto de campanha
foi direcionado ao logger protegido.

## Verificação

```powershell
pnpm --filter @workspace/api-server run test:log-security
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run test:dependency-runtime
pnpm --filter @workspace/api-server run test:integration-security
pnpm --filter @workspace/api-server run test:auth-cookie-security
pnpm run security:scan
```

O teste verifica a saída JSON real do logger e de uma requisição Express local,
com fixtures aleatórias de senha/token/e-mail e telefone. Cobre campos aninhados,
arrays, erros/string errors, interpolação, child/child encadeado/setBindings,
URL com token no caminho/query, headers, ciclos, getters, toJSON e não mutação.
Verifica também preservação de IDs, status e contadores operacionais.

O teste foi adicionado ao workflow local de qualidade. Esta etapa não deve
ser enviada ao remoto: por orientação do usuário, somente commit local está
autorizado. CI remoto não valida estas mudanças enquanto não houver push.

## Pendências e limitações

A auditoria completa por módulo continua aberta: texto livre com dados opacos,
loggers independentes, bibliotecas externas e scripts de diagnóstico precisam
de revisão. Esta proteção cobre o logger central e seus filhos, não qualquer
processo, console, serviço Python ou armazenamento de auditoria no banco.
Logs já existentes não foram removidos ou reescritos. Retenção e acesso aos logs
precisam ser definidos. Não habilitar dumps de corpos nem stacks brutas para
recuperar diagnósticos; usar IDs/status/códigos e tracing controlado.

Sem migração de banco, alteração de segredo ou publicação. Rollback consiste
em restaurar os arquivos do commit anterior e refazer o build, mas reintroduz
a exposição de dados nos logs. Reiniciar a API com o build novo para ativar
esta proteção no processo em execução.
