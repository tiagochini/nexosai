# NEXOS AI — Agentes Experimentais

Estes agentes estão **implementados e registrados** no `AGENT_PROVIDER_MAP` mas ainda **não integrados** na pipeline automatizada de campanhas.

Estão disponíveis exclusivamente via chat direto (`POST /agents/chat`).

---

## Status de Cada Agente

| Agente (Role) | Arquivo | Responsabilidade | Integrar Em |
|---------------|---------|-----------------|-------------|
| `ab_test_designer` | `ab-test-designer.agent.ts` | Design de testes A/B de copy e criativos | Fase de otimização de campanha |
| `ad_critic` | `ad-critic.agent.ts` | Análise crítica de anúncios ativos | Métricas → quando CTR cai |
| `affiliate_campaign` | `affiliate-campaign.agent.ts` | Estratégia de campanha para afiliados | Track de afiliado |
| `content_calendar` | `content-calendar.agent.ts` | Planejamento de calendário de conteúdo | Fase de conteúdo orgânico |
| `creative_concept` | `creative-concept.agent.ts` | Geração de conceitos visuais | ⚠️ Possível conflito com `creative-intent` — avaliar |
| `crisis_response` | `crisis-response.agent.ts` | Resposta a crises de lançamento | Alerta automático → health score crítico |
| `email_architect` | `email-architect.agent.ts` | Arquitetura de sequências de email | Fase de sequência de lançamento |
| `hook_factory` | `hook-factory.agent.ts` | Geração de hooks e aberturas de copy | Fase de conteúdo |
| `launch_debriefing` | `launch-debriefing.agent.ts` | Análise pós-lançamento | Status `completed` |
| `market_intel` | `market-intel.agent.ts` | Inteligência de mercado e competidores | Fase de intake/estratégia |
| `objection_killer` | `objection-killer.agent.ts` | Tratamento de objeções de venda | Time de vendas / sequência |
| `organic_traffic` | `organic-traffic.agent.ts` | Estratégia de tráfego orgânico | Dashboard de social |
| `pricing_psychologist` | `pricing-psychologist.agent.ts` | Psicologia de precificação | Fase de oferta |
| `reengagement` | `reengagement.agent.ts` | Reengajamento de leads frios | Segmento `cold` em sequências |
| `scarcity_engineer` | `scarcity-engineer.agent.ts` | Engenharia de escassez e urgência | Fase de lançamento |
| `testimonial_curator` | `testimonial-curator.agent.ts` | Curadoria e formatação de depoimentos | Fase de conteúdo / prova social |
| `upsell_architect` | `upsell-architect.agent.ts` | Arquitetura de upsell pós-venda | Pós-compra / revenue |
| `video_hook` | `video-hook.agent.ts` | Hooks de abertura de vídeo | Fase de conteúdo de vídeo |

---

## Como Integrar um Agente Experimental na Pipeline

1. Definir o contrato de entrada/saída em `NEXOS_AGENT_CONTRACTS.md`
2. Identificar o evento de acionamento (qual fase, qual condição)
3. Criar o service/worker que chama o agente via `runIsolatedAgent()`
4. Adicionar gate de aprovação humana se necessário (ver `NEXOS_GUARDRAILS.md`)
5. Atualizar `NEXOS_WORKFLOW_MAP.md`
6. Mover este agente para a seção correspondente de `NEXOS_AGENT_CONTRACTS.md`

---

## Conflito Potencial: creative_concept vs creative-intent

`creative-concept.agent.ts` e o módulo `creative-intent/` têm responsabilidades sobrepostas.
Antes de integrar `creative_concept` na pipeline, definir qual fluxo é canônico:
- `creative-intent` → ConceptDraft com aprovação por índice (módulo completo)
- `creative-concept` → conceito livre via chat direto

**Decisão pendente de aprovação.**
