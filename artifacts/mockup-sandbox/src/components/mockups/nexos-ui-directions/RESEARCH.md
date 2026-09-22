# NexOS — pesquisa visual e hipóteses de interface

Data da pesquisa: setembro de 2026.

## O que foi auditado no produto real

- O shell atual funciona como um centro de comando escuro: navegação agrupada, superfícies quase pretas, acentos violeta/verde, tipografia mono em dados e estados, cantos retos e alta densidade.
- O modo **Fundador** reduz a operação a missão, progresso, resultado e próxima ação.
- O modo **Arquiteto** expõe agentes, traces, pesos, automações e ferramentas avançadas.
- Os estados importantes já existem no produto: campanha ativa, Master Plan, execução de agentes, aprovação, alertas, pausas, créditos, KPIs e escalada humana.
- A principal oportunidade não é adicionar mais módulos. É tornar explícito, em qualquer tela: **o que está acontecendo, por quê, o que exige atenção e o que o sistema fará depois**.

## Padrões de mercado considerados

### IA e agentes

- Interfaces de IA continuam usando conversa por familiaridade, mas produtos operacionais adicionam projeto, contexto persistente, artefatos, atividade e explicabilidade ao redor da conversa.
- Sistemas agentivos mais confiáveis tornam visível o plano, a etapa atual, a ferramenta em uso, a conclusão e o ponto em que o humano precisa decidir.
- Projetos e workspaces reduzem a sensação de “chat descartável” e preservam contexto por objetivo.

Referências:

- [OpenAI — Using projects in ChatGPT](https://openai.com/academy/projects)
- [OpenAI — Introducing AgentKit](https://openai.com/index/introducing-agentkit)
- [Anthropic — Claude-powered artifacts](https://www.anthropic.com/news/claude-powered-artifacts)
- [Microsoft — Copilot Studio for complex, multi-step work](https://techcommunity.microsoft.com/blog/copilot-studio-blog/meet-the-new-copilot-studio-rebuilt-for-more-complex-multi-step-work/4526488)
- [LogRocket — AI assistant UX patterns](https://blog.logrocket.com/ux-design/ive-designed-ai-assistants-heres-what-actually-works)

### CRM, marketing e automação

- Campanhas fortes combinam objetivo, etapa, responsáveis/agentes, métricas, aprovações e próximos passos no mesmo contexto.
- Workflows visuais ajudam a entender sequência e dependências, mas dashboards perdem valor quando exigem exportar dados para cruzar campanha, canal e receita.
- O usuário valoriza uma visão executiva simples e a capacidade de aprofundar sem trocar de sistema.

Referências:

- [HubSpot — Campaign management](https://www.hubspot.com/products/marketing/campaigns)
- [HubSpot — Marketing workflows](https://www.hubspot.com/products/marketing/workflows)
- [HubSpot — Smart CRM](https://www.hubspot.com/products/crm/ai-crm)
- [HighLevel — Getting started with workflows](https://help.gohighlevel.com/support/solutions/articles/155000002288-getting-started-with-workflows)
- [HighLevel — Dashboard feedback](https://ideas.gohighlevel.com/dashboard)

## Hipóteses comparadas

### A. Operações conversacionais

**Modelo mental:** acompanhar e comandar a operação como uma conversa com um time.

- Departamentos e frentes aparecem como threads.
- Eventos de agentes, aprovações, alertas e handoffs aparecem no fluxo central.
- Master Plan e métricas ficam em contexto, sem competir com a conversa.
- No mobile, a conversa vira a superfície principal.

**Melhor quando:** familiaridade, colaboração e velocidade de adoção têm prioridade.

**Risco:** decisões e métricas podem se perder no histórico; exige resumos e contexto fixo.

### B. Cockpit executivo

**Modelo mental:** supervisionar uma missão autônoma por instrumentos e exceções.

- KPIs, pipeline, fila de agentes, governança e alertas formam uma sala de controle.
- Fundador vê quatro decisões; Arquiteto abre sinais e traces.
- No mobile, a grade vira briefing vertical, não dashboard comprimido.

**Melhor quando:** controle, comparação e gestão multicanal têm prioridade.

**Risco:** densidade excessiva pode recriar a complexidade atual se a hierarquia não for rigorosa.

### C. Jornada premium guiada

**Modelo mental:** avançar por uma missão com uma recomendação importante de cada vez.

- A etapa e a decisão atual dominam a página.
- Evidências, equipe e métricas sustentam a recomendação sem interromper a narrativa.
- Movimento e som são opcionais, reduzidos e vinculados a mudanças reais de fase.

**Melhor quando:** clareza, confiança e percepção premium para o Fundador têm prioridade.

**Risco:** pode esconder informação demais de operadores; o modo Arquiteto precisa permanecer completo.

## Critérios para escolher

1. O usuário entende o estado da campanha em menos de cinco segundos?
2. A próxima ação humana é rara, inequívoca e justificada?
3. O sistema diferencia ação autônoma, recomendação, pausa e bloqueio?
4. O Master Plan continua sendo a autoridade visível?
5. Fundador e Arquiteto parecem duas profundidades do mesmo produto?
6. Desktop e mobile preservam prioridade, em vez de apenas redimensionar componentes?
7. Som, animação e cor comunicam estado sem serem necessários para compreendê-lo?