/**
 * PRODUCT VALIDATOR AGENT — Validação de Produto e Product-Market Fit
 * Analisa profundamente a viabilidade de um produto digital antes do lançamento:
 * mercado, proposta de valor, diferenciação, timing e risco de execução.
 * Provider: Claude (análise estratégica, pensamento sistêmico)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface MarketAnalysis {
  size: string;
  maturity: "nascente" | "crescimento" | "maduro" | "saturado" | "em_declinio";
  sophisticationLevel: 1 | 2 | 3 | 4 | 5;
  sophisticationExplanation: string;
  topCompetitors: {
    name: string;
    positioning: string;
    weakness: string;
    priceRange: string;
  }[];
  opportunityGap: string;
  marketTiming: "muito_cedo" | "ideal" | "ligeiramente_tardio" | "saturado";
  marketTimingRationale: string;
}

export interface ProductFitScore {
  overall: number;
  breakdown: {
    marketDemand: number;
    creatorAuthority: number;
    differentiation: number;
    pricingViability: number;
    deliveryFeasibility: number;
    scalabilityPotential: number;
  };
  verdict: "nao_lance" | "valide_primeiro" | "pode_lancar" | "lance_agora" | "lance_grande";
  verdictRationale: string;
}

export interface ProductValidatorOutput {
  productName: string;
  productCategory: string;
  corePromise: string;
  promiseAnalysis: {
    isSpecific: boolean;
    isCredible: boolean;
    isMeasurable: boolean;
    isMassDesirable: boolean;
    feedback: string;
  };
  marketAnalysis: MarketAnalysis;
  avatarValidation: {
    isPainReal: boolean;
    isPainUrgent: boolean;
    hasMoneyToSpend: boolean;
    canFindAvatar: boolean;
    avatarNotes: string;
  };
  differentiationAnalysis: {
    currentDifferentiators: string[];
    isTrulyDifferentiated: boolean;
    commoditizationRisk: "baixo" | "medio" | "alto";
    recommendedPositioning: string;
    mechanismOfDifference: string;
  };
  pricingAnalysis: {
    recommendedPrice: number;
    priceFloor: number;
    priceCeiling: number;
    pricingStrategy: string;
    anchoringRecommendation: string;
    paymentStructure: string;
  };
  fitScore: ProductFitScore;
  criticalIssues: {
    issue: string;
    severity: "blocker" | "warning" | "minor";
    recommendation: string;
  }[];
  validationTests: {
    test: string;
    how: string;
    timeframe: string;
    successCriteria: string;
  }[];
  productRoadmap: {
    mvp: string;
    v1: string;
    v2: string;
    ecosystem: string;
  };
  goNoGoDecision: {
    decision: "GO" | "NO_GO" | "CONDITIONAL_GO";
    conditions?: string[];
    rationale: string;
    nextStep: string;
  };
}

const PRODUCT_VALIDATOR_PROMPT = `Você é o Agente Validador de Produto do NexOS AI — o analista mais honesto do ecossistema. Seu papel é dar uma análise imparcial e cirúrgica de viabilidade antes do criador investir tempo e dinheiro num produto que pode não ter mercado, ou num lançamento para o qual ainda não está pronto.

## SUA FILOSOFIA: O MELHOR CONSELHO É O HONESTO

Não é seu papel validar o ego do criador — é seu papel salvar meses de trabalho e recursos de uma execução equivocada. Um "não lance ainda" ou "valide primeiro" honesto vale mais do que um "vai lá, acredita!" que leva ao fracasso.

Ao mesmo tempo: produto perfeito que nunca é lançado = zero receita. Seu papel é identificar o caminho entre "valide primeiro" e "pode escalar agora".

## FRAMEWORK DE ANÁLISE DE PRODUTO DIGITAL

### 1. ANÁLISE DA PROMESSA

A promessa do produto é o átomo de tudo. Uma promessa fraca não é salva por bom conteúdo, bom design ou bom tráfego.

**Critérios de uma promessa vencedora (Gene Schwartz + Russell Brunson):**
- **Específica**: "Aprenda inglês" ✗ | "Inglês conversacional para reuniões de negócios em 90 dias" ✓
- **Crível**: A promessa precisa ser grande o suficiente para excitar, pequena o suficiente para ser acreditada
- **Mensurável**: O cliente sabe quando chegou lá?
- **Mass desirable**: Muitas pessoas querem isso, ou é nicho demais?

### 2. ANÁLISE DE MERCADO (5 níveis de sofisticação de Schwartz)

**Nível 1** — Mercado virgem. Qualquer promessa direta funciona.
**Nível 2** — Primeiros concorrentes. A promessa mais forte vence.
**Nível 3** — Saturação de promessas. Precisa de mecanismo único.
**Nível 4** — Saturação de mecanismos. Precisa de identificação com o avatar.
**Nível 5** — Hipersaturação. Precisa de sensacionalismo + novidade extrema.

A maioria dos criadores brasileiros em 2025 está entrando em mercados de nível 3-4 sem saber.

### 3. VALIDAÇÃO DO AVATAR

Três perguntas que eliminam 90% dos produtos ruins:
1. **A dor é real e urgente?** (não é interessante, é urgente — eles vão pagar hoje?)
2. **O avatar tem dinheiro para gastar nisto?** (ou já gastou tudo com guru anterior?)
3. **Você consegue encontrá-los?** (onde estão? quais grupos, perfis, buscas?)

### 4. DIFERENCIAÇÃO REAL

A armadilha do "igual mas melhor": entrar num mercado saturado com o mesmo produto "com mais qualidade" é receita para invisibilidade. Precisa de um mecanismo único — algo que torna a solução categoricamente diferente, não apenas incrementalmente melhor.

**Mecanismo único real:**
- Um método exclusivo com nome proprietário
- Um ângulo completamente diferente (ex: "emagrecimento sem academia" em 2010)
- Um formato diferente (comunidade vs. curso)
- Um avatar específico que os outros ignoram

### 5. PRECIFICAÇÃO POR VALOR

Preço não é custo + margem. Preço é:
- Resultado percebido × probabilidade percebida de chegar lá
- Limitado pelo custo da alternativa (o que gastam hoje sem solução?)
- Limitado pelo nível de consciência e sofisticação do avatar

Precificação Van Westendorp: pergunte ao avatar "muito barato", "barato", "caro", "absurdo". O intervalo aceitável fica entre "barato" e "caro".

### 6. PRODUCT-MARKET FIT REAL

PMF não é você achar que o produto é bom. PMF é:
- Pessoas pagando antecipadamente (lançamento semente)
- NPS ≥ 50 na turma beta
- Taxa de conclusão ≥ 40% (para cursos)
- LTV/CAC ≥ 3:1

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "productName": "string",
  "productCategory": "string",
  "corePromise": "string — a promessa central do produto (reformulada se necessário)",
  "promiseAnalysis": {
    "isSpecific": true,
    "isCredible": true,
    "isMeasurable": true,
    "isMassDesirable": true,
    "feedback": "string — análise honesta da promessa e como melhorá-la"
  },
  "marketAnalysis": {
    "size": "string — tamanho estimado do mercado (TAM/SAM/SOM)",
    "maturity": "nascente|crescimento|maduro|saturado|em_declinio",
    "sophisticationLevel": 3,
    "sophisticationExplanation": "string — por que está neste nível e o que isso implica",
    "topCompetitors": [
      {
        "name": "string",
        "positioning": "string — como se posicionam",
        "weakness": "string — vulnerabilidade exploitável",
        "priceRange": "string"
      }
    ],
    "opportunityGap": "string — o espaço não ocupado que este produto pode tomar",
    "marketTiming": "muito_cedo|ideal|ligeiramente_tardio|saturado",
    "marketTimingRationale": "string"
  },
  "avatarValidation": {
    "isPainReal": true,
    "isPainUrgent": true,
    "hasMoneyToSpend": true,
    "canFindAvatar": true,
    "avatarNotes": "string — análise detalhada do avatar e flags de alerta"
  },
  "differentiationAnalysis": {
    "currentDifferentiators": ["string"],
    "isTrulyDifferentiated": true,
    "commoditizationRisk": "baixo|medio|alto",
    "recommendedPositioning": "string — como se posicionar para máxima diferenciação",
    "mechanismOfDifference": "string — o mecanismo único que torna este produto categoricamente diferente"
  },
  "pricingAnalysis": {
    "recommendedPrice": 0,
    "priceFloor": 0,
    "priceCeiling": 0,
    "pricingStrategy": "string — lógica de precificação por valor",
    "anchoringRecommendation": "string — como ancorar o preço",
    "paymentStructure": "string — à vista vs. parcelado, bônus de pagamento único, etc."
  },
  "fitScore": {
    "overall": 75,
    "breakdown": {
      "marketDemand": 80,
      "creatorAuthority": 70,
      "differentiation": 60,
      "pricingViability": 80,
      "deliveryFeasibility": 90,
      "scalabilityPotential": 70
    },
    "verdict": "nao_lance|valide_primeiro|pode_lancar|lance_agora|lance_grande",
    "verdictRationale": "string — justificativa honesta do veredito"
  },
  "criticalIssues": [
    {
      "issue": "string — problema específico identificado",
      "severity": "blocker|warning|minor",
      "recommendation": "string — o que fazer a respeito"
    }
  ],
  "validationTests": [
    {
      "test": "string — nome do teste de validação",
      "how": "string — como executar o teste",
      "timeframe": "string — quanto tempo leva",
      "successCriteria": "string — o que constitui validação positiva"
    }
  ],
  "productRoadmap": {
    "mvp": "string — o mínimo viável para o primeiro lançamento semente",
    "v1": "string — versão completa após validação",
    "v2": "string — expansão após PMF confirmado",
    "ecosystem": "string — visão de produto completo (upsells, continuidade, comunidade)"
  },
  "goNoGoDecision": {
    "decision": "GO|NO_GO|CONDITIONAL_GO",
    "conditions": ["string — apenas se CONDITIONAL_GO: condições a cumprir antes de lançar"],
    "rationale": "string — argumento principal pela decisão",
    "nextStep": "string — a próxima ação concreta e imediata"
  }
}
\`\`\``;

export async function runProductValidatorAgent(
  campaignId: string | null,
  workspaceId: string,
  productName: string,
  productDescription: string,
  targetAudience: string,
  mainPromise: string,
  creatorAuthority: string,
  existingCompetitors: string,
  desiredPrice: number,
  log: Logger,
): Promise<ProductValidatorOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "product_validator",
    systemPrompt: PRODUCT_VALIDATOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Faça a análise completa de viabilidade e product-market fit para este produto digital.

**Produto:** ${productName}
**Descrição:** ${productDescription}
**Público-alvo:** ${targetAudience}
**Promessa principal:** ${mainPromise}
**Autoridade do criador:** ${creatorAuthority}
**Concorrentes conhecidos:** ${existingCompetitors || "Não informado"}
**Preço desejado:** R$${desiredPrice}

**PROCESSO:**
1. Analise a promessa com o framework Schwartz (específica, crível, mensurável, desejada em massa)
2. Avalie o mercado: tamanho, maturidade, nível de sofisticação, timing
3. Valide o avatar: a dor é urgente? têm dinheiro? dá para encontrá-los?
4. Identifique o gap de diferenciação e o mecanismo único possível
5. Valide o preço com base no valor entregue, não no custo
6. Calcule o fit score com breakdown honesto por dimensão
7. Identifique issues críticos (blockers, warnings, minor)
8. Defina testes de validação antes de investir em lançamento grande
9. Emita a decisão GO/NO_GO/CONDITIONAL_GO com próximo passo concreto

Seja honesto e direto — se o produto não está pronto para lançar, diga claramente o que precisa mudar.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando a promessa central do produto...",
      "Avaliando mercado, concorrência e timing...",
      "Validando avatar e urgência da dor...",
      "Calculando fit score por dimensão...",
      "Gerando decisão GO/NO-GO e próximos passos...",
    ],
  });

  return parseAgentJSON<ProductValidatorOutput>(result.content, {
    productName,
    productCategory: "",
    corePromise: mainPromise,
    promiseAnalysis: { isSpecific: false, isCredible: false, isMeasurable: false, isMassDesirable: false, feedback: "" },
    marketAnalysis: {
      size: "",
      maturity: "crescimento",
      sophisticationLevel: 3,
      sophisticationExplanation: "",
      topCompetitors: [],
      opportunityGap: "",
      marketTiming: "ideal",
      marketTimingRationale: "",
    },
    avatarValidation: { isPainReal: false, isPainUrgent: false, hasMoneyToSpend: false, canFindAvatar: false, avatarNotes: "" },
    differentiationAnalysis: {
      currentDifferentiators: [],
      isTrulyDifferentiated: false,
      commoditizationRisk: "medio",
      recommendedPositioning: "",
      mechanismOfDifference: "",
    },
    pricingAnalysis: {
      recommendedPrice: desiredPrice,
      priceFloor: 0,
      priceCeiling: 0,
      pricingStrategy: "",
      anchoringRecommendation: "",
      paymentStructure: "",
    },
    fitScore: {
      overall: 0,
      breakdown: { marketDemand: 0, creatorAuthority: 0, differentiation: 0, pricingViability: 0, deliveryFeasibility: 0, scalabilityPotential: 0 },
      verdict: "valide_primeiro",
      verdictRationale: "",
    },
    criticalIssues: [],
    validationTests: [],
    productRoadmap: { mvp: "", v1: "", v2: "", ecosystem: "" },
    goNoGoDecision: { decision: "CONDITIONAL_GO", conditions: [], rationale: "", nextStep: "" },
  });
}
