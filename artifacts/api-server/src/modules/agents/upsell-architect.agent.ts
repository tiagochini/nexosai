/**
 * Upsell Architect Agent
 * Designs the complete post-purchase monetization architecture:
 * order bumps, OTOs (one-time offers), downsells, cross-sells, and LTV expansion.
 * Provider: Claude (reasoning, economics, psychology)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface UpsellOffer {
  position: "order_bump" | "oto1" | "oto2" | "downsell" | "cross_sell" | "recurrence";
  name: string;
  description: string;
  price: number;
  installments?: { times: number; value: number };
  deliveryFormat: string;    // "módulo extra", "consultoria 1:1", "plugin", etc.
  conversionExpectation: string; // % expected
  timing: string;            // when in the funnel
  copyHook: string;          // the opening line of the upsell offer
  valueProp: string;         // the core value proposition in 1 sentence
  urgencyMechanism: string;  // why act now (this is a one-time offer)
  fullPitch: string;         // complete upsell pitch, ready to use
  isMandatory: boolean;      // is this a strong recommendation?
}

export interface UpsellArchitectOutput {
  product: string;
  mainProductPrice: number;
  upsellStack: UpsellOffer[];
  revenueProjection: {
    baseRevenue: number;    // revenue without upsells
    upsellRevenue: number;  // additional revenue from upsells (per 100 buyers)
    ltvIncrease: string;    // % LTV increase
    priorityUpsell: string; // which one to launch first
  };
  upsellFunnelFlow: string;  // the exact sequence: main product → OTO1 → OTO2 → etc.
  physicalWorldAnalogy: string; // real-world equivalent ("McDonald's é mestre em OTO: 'quer batatas fritas?'")
  mistakesToAvoid: string[];   // upsell patterns that kill trust or hurt conversion
}

const UPSELL_ARCHITECT_PROMPT = `Você é o Agente Upsell Architect do NexOS AI — especialista em arquitetura de monetização pós-compra e maximização de LTV.

Você transforma uma venda única em uma jornada completa de valor crescente — onde cada oferta adicional é genuinamente útil para quem já comprou.

## FRAMEWORK DE MONETIZAÇÃO PÓS-COMPRA

### HIERARQUIA DE OFERTAS

**ORDER BUMP** (no checkout, antes de pagar):
- Taxa de conversão: 20-35%
- Preço ideal: 20-30% do produto principal
- Formato: complemento imediato que acelera o resultado
- Copy: "Adicione [benefício específico] por apenas R$X (check aqui)"
- Exemplo: curso de R$997 → order bump de "planilha de implementação" por R$197

**OTO 1** (imediatamente após compra, antes do agradecimento):
- Taxa de conversão: 15-25%
- Preço ideal: 50-100% do produto principal (pode ser mais caro)
- Formato: aprofundamento ou acelerador do resultado
- Regra de ouro: deve ser algo que o comprador QUASE teria comprado no lugar do principal
- Copy de urgência: "Esta oferta some quando você fechar esta página"

**OTO 2** (após OTO 1, seja aceito ou recusado):
- Taxa de conversão: 10-18%
- Preço ideal: 30-50% do produto principal
- Formato: complemento diferente do OTO 1
- Só mostrar se OTO 1 foi aceito (não mostrar downsell aqui — mostrar alternativa)

**DOWNSELL** (quando OTO 1 ou 2 é recusado):
- Taxa de conversão: 10-15% dos que recusaram o OTO
- Preço: 40-60% do OTO original
- Formato: versão simplificada ou digital do que foi recusado
- Copy: "Espera — entendo que não é o momento. E se eu te oferecesse apenas [parte específica] por R$X?"

**CROSS-SELL** (pós-compra, email D+3 a D+7):
- Produto complementar, não concorrente
- Timing: quando o comprador teve o primeiro "aha moment" do produto principal

**RECORRÊNCIA** (D+30 a D+60):
- Comunidade, mentoria contínua, atualização anual
- O momento mais fácil de vender recorrência é imediatamente após a primeira vitória

### PRINCÍPIOS DO UPSELL QUE CONVERTE

1. **Cada oferta deve ser genuinamente útil** — upsell manipulativo funciona uma vez e destrói o relacionamento
2. **A transição deve ser natural** — o comprador deve sentir que a próxima oferta é a resposta óbvia ao próximo problema
3. **A urgência deve ser real** — "Esta oferta some quando fechar a página" só funciona se for verdade
4. **O preço deve ser justificado em contexto** — R$197 parece barato logo após gastar R$997
5. **Nunca ofereça algo que deveria estar no produto principal** — isso gera arrependimento

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "product": "string",
  "mainProductPrice": 0,
  "upsellStack": [
    {
      "position": "order_bump|oto1|oto2|downsell|cross_sell|recurrence",
      "name": "string",
      "description": "string — o que é oferecido, especificamente",
      "price": 0,
      "installments": { "times": 0, "value": 0 },
      "deliveryFormat": "string",
      "conversionExpectation": "string — ex: 25-30%",
      "timing": "string — quando aparece no funil",
      "copyHook": "string — primeira linha do pitch",
      "valueProp": "string — proposta de valor em 1 frase",
      "urgencyMechanism": "string — por que agir agora",
      "fullPitch": "string — pitch completo, pronto para usar na página",
      "isMandatory": true
    }
  ],
  "revenueProjection": {
    "baseRevenue": 0,
    "upsellRevenue": 0,
    "ltvIncrease": "string — % de aumento em LTV",
    "priorityUpsell": "string — qual implementar primeiro e por quê"
  },
  "upsellFunnelFlow": "string — fluxo exato: produto principal → OTO1 (aceita? → OTO2 | recusa? → downsell) → ...",
  "physicalWorldAnalogy": "string — analogia do mundo real que ilustra o modelo",
  "mistakesToAvoid": ["string — erro de upsell que mata confiança ou conversão"]
}
\`\`\``;

export async function runUpsellArchitectAgent(
  campaignId: string | null,
  workspaceId: string,
  productDescription: string,
  mainProductPrice: number,
  avatarDescription: string,
  existingUpsells: string[],
  log: Logger,
): Promise<UpsellArchitectOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "upsell_architect",
    systemPrompt: UPSELL_ARCHITECT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Projete a arquitetura completa de monetização pós-compra.

**Produto principal:** ${productDescription}
**Preço principal:** R$${mainProductPrice}
**Avatar:** ${avatarDescription}
**Upsells existentes:** ${existingUpsells.join(", ") || "nenhum"}

**PROCESSO:**
1. Identifique o próximo problema do avatar após comprar o produto principal
2. Projete order bump, OTO1, OTO2, downsell e cross-sell com preços calibrados
3. Escreva o pitch completo de cada oferta
4. Calcule o impacto em LTV (por 100 compradores)
5. Identifique qual implementar primeiro para maximizar ROI imediato

Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Mapeando jornada pós-compra do avatar...",
      "Projetando stack de upsells por posição no funil...",
      "Calculando preços e taxas de conversão esperadas...",
      "Escrevendo pitches completos para cada oferta...",
      "Projetando impacto em LTV...",
    ],
  });

  return parseAgentJSON<UpsellArchitectOutput>(result.content, {
    product: productDescription,
    mainProductPrice,
    upsellStack: [],
    revenueProjection: {
      baseRevenue: mainProductPrice * 100,
      upsellRevenue: 0,
      ltvIncrease: "",
      priorityUpsell: "",
    },
    upsellFunnelFlow: "",
    physicalWorldAnalogy: "",
    mistakesToAvoid: [],
  });
}
