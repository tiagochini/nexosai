import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface OfferAnalysisOutput {
  overallScore: number;
  verdict: "strong" | "moderate" | "weak" | "unlaunchable";
  summary: string;
  dimensions: {
    valueClarity: { score: number; diagnosis: string; fix: string };
    pricePerception: { score: number; diagnosis: string; fix: string };
    trustElements: { score: number; diagnosis: string; fix: string };
    uniqueness: { score: number; diagnosis: string; fix: string };
    urgency: { score: number; diagnosis: string; fix: string };
    socialProof: { score: number; diagnosis: string; fix: string };
    deliveryClarity: { score: number; diagnosis: string; fix: string };
    bonusStack: { score: number; diagnosis: string; fix: string };
  };
  criticalIssues: {
    issue: string;
    severity: "critical" | "major" | "minor";
    recommendation: string;
  }[];
  offerUpgrades: {
    upgrade: string;
    expectedImpact: string;
    effort: "low" | "medium" | "high";
  }[];
  pricingAnalysis: {
    currentPrice: number;
    perceivedValue: number;
    recommendedRange: { min: number; max: number };
    pricingStrategy: string;
  };
  bonusRecommendations: string[];
  guaranteeRecommendation: string;
  offerStackSuggestion: string;
}

const OFFER_SYSTEM_PROMPT = `Você é o Agente de Análise de Oferta da NexOS AI — o crítico mais honesto e implacável de lançamentos digitais.

Seu trabalho é DISSECAR a oferta do criador com olho clínico. Você encontra os problemas que o criador não quer ver. Você faz o que consultores de R$50k por projeto fazem.

## SUAS DIRETRIZES

**SEJA BRUTALMENTE HONESTO.** Se a oferta é fraca, diga. Se o preço está errado, explique por quê. Se vai fracassar, avise antes que o criador perca dinheiro.

**Pontuação é sagrada.** Use a escala de 0-10 com precisão. 7 não é "bom o suficiente" — é "precisa de trabalho". 5 é "risco real de fracasso". Abaixo de 4 em qualquer dimensão crítica é alerta vermelho.

**Problemas específicos, soluções específicas.** Não diga "melhore a proposta de valor". Diga COMO, com exemplos reais.

**Você analisa:**
- Clareza do valor entregue
- Percepção de preço vs. valor percebido
- Elementos de confiança (prova social, garantia, credenciais)
- Unicidade — o quão diferente é dos concorrentes
- Urgência — o quão forte é o gatilho de tempo/escassez
- Prova social — quantidade e qualidade dos depoimentos
- Clareza de entrega — o cliente sabe exatamente o que vai receber?
- Stack de bônus — relevância e valor percebido dos extras

**Retorne APENAS JSON válido** no formato exato solicitado.

\`\`\`json
{
  "overallScore": 0,
  "verdict": "strong|moderate|weak|unlaunchable",
  "summary": "string — diagnóstico executivo direto e honesto",
  "dimensions": {
    "valueClarity": { "score": 0, "diagnosis": "string", "fix": "string" },
    "pricePerception": { "score": 0, "diagnosis": "string", "fix": "string" },
    "trustElements": { "score": 0, "diagnosis": "string", "fix": "string" },
    "uniqueness": { "score": 0, "diagnosis": "string", "fix": "string" },
    "urgency": { "score": 0, "diagnosis": "string", "fix": "string" },
    "socialProof": { "score": 0, "diagnosis": "string", "fix": "string" },
    "deliveryClarity": { "score": 0, "diagnosis": "string", "fix": "string" },
    "bonusStack": { "score": 0, "diagnosis": "string", "fix": "string" }
  },
  "criticalIssues": [
    { "issue": "string", "severity": "critical|major|minor", "recommendation": "string" }
  ],
  "offerUpgrades": [
    { "upgrade": "string", "expectedImpact": "string", "effort": "low|medium|high" }
  ],
  "pricingAnalysis": {
    "currentPrice": 0,
    "perceivedValue": 0,
    "recommendedRange": { "min": 0, "max": 0 },
    "pricingStrategy": "string"
  },
  "bonusRecommendations": ["string"],
  "guaranteeRecommendation": "string",
  "offerStackSuggestion": "string"
}
\`\`\``;

export async function runOfferAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<OfferAnalysisOutput> {
  const intakeJson = JSON.stringify(intakeData, null, 2);

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "offer",
    systemPrompt: OFFER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analise a oferta com base nos dados abaixo e produza o diagnóstico completo.

**Dados da campanha:**
\`\`\`json
${intakeJson}
\`\`\`

Retorne APENAS o JSON da análise. Seja cirúrgico e honesto.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Analisando proposta de valor e clareza da oferta...",
      "Verificando percepção de preço vs. valor entregue...",
      "Auditando elementos de confiança e prova social...",
      "Comparando unicidade no mercado...",
      "Avaliando stack de bônus e garantia...",
      "Diagnosticando pontos críticos de melhoria...",
    ],
  });

  return parseAgentJSON<OfferAnalysisOutput>(result.content, {
    overallScore: 0,
    verdict: "weak",
    summary: result.content,
    dimensions: {
      valueClarity: { score: 0, diagnosis: "", fix: "" },
      pricePerception: { score: 0, diagnosis: "", fix: "" },
      trustElements: { score: 0, diagnosis: "", fix: "" },
      uniqueness: { score: 0, diagnosis: "", fix: "" },
      urgency: { score: 0, diagnosis: "", fix: "" },
      socialProof: { score: 0, diagnosis: "", fix: "" },
      deliveryClarity: { score: 0, diagnosis: "", fix: "" },
      bonusStack: { score: 0, diagnosis: "", fix: "" },
    },
    criticalIssues: [],
    offerUpgrades: [],
    pricingAnalysis: {
      currentPrice: 0,
      perceivedValue: 0,
      recommendedRange: { min: 0, max: 0 },
      pricingStrategy: "",
    },
    bonusRecommendations: [],
    guaranteeRecommendation: "",
    offerStackSuggestion: "",
  });
}
