/**
 * Pricing Psychologist Agent
 * Analyzes and optimizes product pricing using advanced psychological frameworks:
 * anchoring, decoy effect, payment plan psychology, value stack, price perception.
 * Provider: Claude (reasoning, economics, consumer psychology)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface PriceVariant {
  label: string;            // "Entrada", "Principal", "Premium VIP"
  price: number;
  installments?: { times: number; value: number; totalValue: number };
  positioning: string;      // how to present this option
  psychologicalAnchor: string; // what value anchor makes this feel reasonable
  targetBuyer: string;      // which segment buys this
  conversionExpectation: string;
}

export interface PricingPsychologyOutput {
  product: string;
  currentPrice: number;
  marketBenchmark: string;
  pricePerceptionGap: string;  // gap between actual value and perceived value
  recommendedPrice: number;
  recommendedInstallments: { times: number; value: number };
  priceJustification: string;  // why this price is FAIR (not just profitable)
  variants: PriceVariant[];    // price architecture (anchor + main + premium)
  anchoring: {
    valueStack: string[];      // all the value to anchor against the price
    totalPerceivedValue: number;
    anchors: string[];         // external price references (alternatives, DIY cost)
    anchorScript: string;      // ready-to-use anchoring script for the sales page
  };
  paymentPlanPsychology: {
    recommendedStructure: string;
    whyThisStructure: string;
    copyForInstallments: string; // how to present installments
    antiPatterns: string[];      // installment framing that kills conversion
  };
  guaranteeStrategy: {
    type: string;              // "30 dias", "resultado ou dinheiro de volta", etc.
    guaranteeCopy: string;
    guaranteeLogic: string;    // why this guarantee de-risks the purchase
  };
  priceObjectionKills: string[]; // specific copy for price objections
  upsellOpportunity: string;   // natural upsell beyond this price point
}

const PRICING_PSYCHOLOGY_PROMPT = `Você é o Agente Pricing Psychologist do NexOS AI — o maior especialista em psicologia de preço do mercado digital brasileiro.

Você transforma preços em propostas de valor irresistíveis. Não é sobre cobrar mais — é sobre fazer o preço parecer óbvio dado o valor entregue.

## FRAMEWORKS DE PSICOLOGIA DE PREÇO

### ANCHORING (Ancoragem)
O preço não existe no vácuo — existe em relação a outros preços. Seu trabalho é controlar qual âncora o avatar usa.
- **Âncora de custo alternativo**: "Uma mentoria individual custa R$5.000/mês. Aqui você tem acesso ao equivalente por R$997."
- **Âncora de custo de NÃO agir**: "Cada mês sem resolver isso custa R$X em oportunidade perdida."
- **Âncora interna** (decoy): O pacote do meio é sempre o mais vendido quando há três opções.
- **Value stack**: Antes de revelar o preço, some o valor de cada componente. "R$5.000 em conteúdo + R$2.000 em suporte + R$1.500 em ferramentas = R$8.500 em valor. Por R$997."

### DECOY EFFECT (Efeito Chamariz)
Três opções: entrada baixa (torna o médio razoável), médio (o que você quer vender), premium (torna o médio acessível comparado).
- A opção médio deve ter pelo menos 3x mais valor percebido do que a entrada com preço 2x maior.
- A opção premium deve ser 2.5-3x o médio, justificada por acesso personalizado.

### PSICOLOGIA DO PARCELAMENTO
O preço por parcela deve ser "menor do que [referência diária]":
- "Menos do que um café por dia" (parcela de R$30)
- "Menos do que uma pizza por semana" (parcela de R$50)
- "Menos do que uma assinatura de streaming" (parcela de R$15-25)
O cérebro faz a comparação com o custo diário, não com o total.

### PREÇO CORRETO — DIAGNÓSTICO
Preço muito baixo tem os mesmos problemas que preço muito alto:
- Baixo demais → sem credibilidade, sem compromisso do comprador, margem insuficiente para suporte
- Alto demais → objeção de preço domina, conversão cai abaixo de 1%
O preço ideal é o mais alto que o avatar aceita SEM precisar criar objeção de preço na cabeça.

### GARANTIA COMO FERRAMENTA DE CONVERSÃO
Garantia não é risco — é acelerador de decisão. Uma boa garantia:
1. Remove o risco percebido da decisão
2. Demonstra confiança total no produto
3. Filtra compradores não-sérios (paradoxo: garantia forte reduz pedidos de reembolso)
A garantia deve ser mais ousada do que o avatar espera. "30 dias de garantia" é mínimo. "Resultado garantido ou dinheiro de volta + R$200 pelo seu tempo" é inesquecível.

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "product": "string",
  "currentPrice": 0,
  "marketBenchmark": "string — o que produtos similares cobram e por quê",
  "pricePerceptionGap": "string — diferença entre valor real entregue e valor percebido",
  "recommendedPrice": 0,
  "recommendedInstallments": { "times": 12, "value": 0 },
  "priceJustification": "string — por que este preço é JUSTO (argumento de valor, não de custo)",
  "variants": [
    {
      "label": "string",
      "price": 0,
      "installments": { "times": 12, "value": 0, "totalValue": 0 },
      "positioning": "string",
      "psychologicalAnchor": "string",
      "targetBuyer": "string",
      "conversionExpectation": "string — % esperada desta opção"
    }
  ],
  "anchoring": {
    "valueStack": ["string — componente de valor + R$X"],
    "totalPerceivedValue": 0,
    "anchors": ["string — referência de preço externa"],
    "anchorScript": "string — script completo de ancoragem para a página de vendas"
  },
  "paymentPlanPsychology": {
    "recommendedStructure": "string",
    "whyThisStructure": "string",
    "copyForInstallments": "string — copy exato para apresentar as parcelas",
    "antiPatterns": ["string — erros de apresentação de preço parcelado que matam conversão"]
  },
  "guaranteeStrategy": {
    "type": "string",
    "guaranteeCopy": "string — copy completo da garantia",
    "guaranteeLogic": "string — por que esta garantia aumenta conversão e reduz reembolsos"
  },
  "priceObjectionKills": ["string — copy específico para cada variação de objeção de preço"],
  "upsellOpportunity": "string — o que vender depois desta compra e por quê faz sentido"
}
\`\`\``;

export async function runPricingPsychologistAgent(
  campaignId: string | null,
  workspaceId: string,
  productDescription: string,
  currentPrice: number,
  avatarDescription: string,
  competitorPrices: string[],
  log: Logger,
): Promise<PricingPsychologyOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "pricing_psychologist",
    systemPrompt: PRICING_PSYCHOLOGY_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analise a psicologia de preço e otimize a estratégia de precificação.

**Produto:** ${productDescription}
**Preço atual:** R$${currentPrice}
**Avatar:** ${avatarDescription}
**Preços de concorrentes:** ${competitorPrices.join(", ") || "não informado"}

**PROCESSO:**
1. Diagnostique se o preço atual está correto (muito baixo, certo, muito alto)
2. Recomende o preço ideal com justificativa baseada em psicologia de valor
3. Construa a arquitetura de 3 opções com decoy effect
4. Escreva o script completo de ancoragem e value stack
5. Projete a estrutura de parcelamento otimizada psicologicamente
6. Crie a garantia mais ousada que seja sustentável para este produto

Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Diagnosticando posicionamento de preço atual...",
      "Analisando benchmark do mercado...",
      "Calculando value stack e âncoras...",
      "Projetando arquitetura de 3 opções...",
      "Desenhando estratégia de garantia...",
    ],
  });

  return parseAgentJSON<PricingPsychologyOutput>(result.content, {
    product: productDescription,
    currentPrice,
    marketBenchmark: "",
    pricePerceptionGap: "",
    recommendedPrice: currentPrice,
    recommendedInstallments: { times: 12, value: Math.round(currentPrice / 12) },
    priceJustification: "",
    variants: [],
    anchoring: { valueStack: [], totalPerceivedValue: 0, anchors: [], anchorScript: "" },
    paymentPlanPsychology: { recommendedStructure: "", whyThisStructure: "", copyForInstallments: "", antiPatterns: [] },
    guaranteeStrategy: { type: "30 dias", guaranteeCopy: "", guaranteeLogic: "" },
    priceObjectionKills: [],
    upsellOpportunity: "",
  });
}
