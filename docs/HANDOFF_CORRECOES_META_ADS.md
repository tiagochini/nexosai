# Próximo chat: corrigir e homologar o fluxo Meta Ads do NexOS

Use este texto como prompt no novo chat. Execute o trabalho no repositório aberto; não faça push.

---

## Objetivo

Compare o NexOS com o documento do usuário `C:\Users\tiago\.codex\attachments\4766bae5-bbe7-48f5-bbb4-b80db6dad7a6\Texto colado.txt` (módulos de Meta Ads sobre estrutura, tracking/CAPI, públicos, orçamento, placements, criativos, otimização, relatórios e rotina operacional). Implemente as correções necessárias para que o sistema execute de forma confiável as partes que o NexOS promete. Não transforme recomendações de gestor de tráfego em funcionalidades ou garantias sem verificar a API e o código existentes.

Ao terminar, crie um commit local com as correções desta tarefa. **Não faça push.**

## Estado conhecido que precisa ser confirmado antes de editar

Uma auditoria anterior encontrou estes pontos; confira se continuam verdadeiros no código atual:

- `artifacts/api-server/src/modules/paid-media/launch-plans.service.ts` define `optimization_goal: "LINK_CLICKS"` fixo, mesmo quando o objetivo aprovado pede leads ou vendas.
- A criação de lançamento dá suporte principalmente a orçamento no nível do conjunto de anúncios (ABO); a sincronização reconhece configurações CBO da Meta, mas não foi encontrada uma configuração ponta a ponta para criar campanha com orçamento no nível da campanha.
- Há sugestões de público, mas não foi encontrada criação de Custom/Lookalike Audiences nem configuração completa de Advantage+ Audience.
- O envio de eventos CAPI tem consentimento, `eventId`, identificadores com hash e recibos locais. O indicador local de correspondência não é a pontuação Event Match Quality da Meta e não comprova deduplicação browser/server no Events Manager.
- A interface de landing page descreve/salva um plano, mas salvar não publica a página nem ativa pixels. Eventos como PageView e Lead estão descritos como planejados.
- `creativePause` aparece como capacidade não suportada.
- Testes automatizados anteriores passaram em ambiente simulado; evidências Meta anteriores foram consultas somente de leitura, sem criação real de campanha/anúncio.

O repositório pode conter alterações locais de outra tarefa. No início, execute `git status`, leia as instruções `AGENTS.md` e examine diffs existentes. Preserve trabalho preexistente: não descarte, sobrescreva, inclua no commit ou reformate alterações alheias a esta tarefa. Faça staging somente dos arquivos que você alterar para este objetivo e inspecione o diff staged antes do commit.

## Regras de implementação

1. Primeiro mapeie, com evidência de código, o fluxo atual: briefing/aprovação do Master Plan → plano de lançamento → campanha/conjunto/anúncio na Meta → estado pausado → sincronização/insights → eventos de conversão/landing page.
2. Verifique afirmações e capacidades da Marketing API em documentação oficial e atual da Meta. O documento do usuário mistura recomendações, afirmações temporais e detalhes que podem variar por conta, objetivo ou versão da API. Não codifique como regra universal coisas como orçamento mínimo, número de conversões, Event Match Quality mínimo, Advantage+ ou disponibilidade de placements.
3. Corrija o mapeamento do objetivo aprovado para os campos exigidos pela Meta (`objective`, `optimization_goal`, destino/conversão e billing event, quando aplicável). Use uma tabela/mapeamento explícito e validado. Se um objetivo não for suportado, retorne erro claro antes de qualquer chamada que crie ativos; nunca faça fallback silencioso para `LINK_CLICKS`.
4. Implemente ABO/CBO apenas se o modelo de dados, a versão da API e a conta permitirem. O orçamento precisa ficar no nível correto; valide exclusividade, moeda, mínimo e campos obrigatórios. Se alguma configuração Advantage+ não estiver disponível, represente-a como não suportada ou indisponível, sem simular que foi ativada.
5. Para públicos, identifique o que o NexOS realmente cria/configura. Não envie dados de CRM nem crie audiências ao vivo sem consentimento e autorização existentes. Mantenha hashes e minimização de dados onde necessário. Bloqueie configurações que a API não suporta.
6. Para Pixel/CAPI, preserve consentimento, hashing, `event_id` compartilhado para deduplicação e registro seguro. Não apresente telemetria local como Event Match Quality da Meta. Diferencie claramente evento enviado, resposta da Meta, evento de teste e qualidade calculada pela Meta. Não exponha tokens ou dados pessoais nos logs.
7. Para landing pages, deixe claro e implementado o estado real: rascunho, aprovada, publicada e tracking verificado. Se a publicação/ativação não existir, não marque como pronta; implemente somente no escopo e infraestrutura existentes e mantenha uma validação explícita dos pixels e CTAs.
8. Preserve a política de segurança já existente do lançamento (idempotência, validação, modo dry-run, compensação e anúncios pausados, se esse for o comportamento vigente). Não ative campanhas, publique anúncios, altere ativos reais ou gere gasto em conta Meta sem autorização explícita específica do usuário.
9. Acrescente ou ajuste testes significativos para os comportamentos corrigidos: mapeamento de objetivos, rejeição antes de chamadas externas, seleção ABO/CBO, deduplicação/consentimento e estados de publicação conforme aplicável. Use mocks para testes automatizados; não alegue homologação real sem evidência da Meta.
10. Atualize documentação e a interface para distinguir “suportado”, “configurado”, “aguardando autorização da Meta” e “não suportado”. Remova alegações de que a integração concluiu algo que não verifica.

## Verificação e commit

- Rode os testes direcionados do módulo e os checks necessários para os arquivos alterados. A auditoria anterior usou `pnpm --filter @workspace/api-server test:paid-media` e `pnpm --filter @workspace/api-server test:paid-media-launch`; confirme os scripts atuais antes de executá-los.
- Revise `git diff` e `git diff --cached`; confirme que nenhum segredo, arquivo de ambiente, evidência privada ou alteração preexistente entrou no commit.
- Faça um commit local descritivo contendo somente as correções desta tarefa. Não faça push, não abra PR e não altere branch remota.
- Na resposta final, informe o que mudou, testes executados e resultado, hash do commit, limitações que ainda dependem de acesso/aprovação/conta Meta real e confirme que não houve push.

## Entrega esperada

O fluxo deve falhar com mensagem acionável quando briefing, objetivo, orçamento, público, pixel ou permissão não forem compatíveis; deve criar apenas o que foi aprovado e permitido; e deve mostrar com precisão o estado real de publicação e mensuração. Se algum item do documento não se aplicar ao produto NexOS ou não for suportado pela Meta/API disponível, explique isso no produto/documentação em vez de fingir suporte.
