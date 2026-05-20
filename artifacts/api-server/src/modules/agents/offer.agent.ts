import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

// ─── Output types ──────────────────────────────────────────────────────────────

export interface OfferArchitectOutput {
  // ── CONSTRUCTION PHASE ────────────────────────────────────────────────────
  offerName: string;
  uniqueMechanism: {
    name: string;
    explanation: string;
    whyCompetitorsFail: string;
    ahaStatement: string;
  };
  psychologicalStack: {
    primaryDesire: string;
    primaryFear: string;
    desiredStatus: string;
    emotionalJourney: string;
    dominantTrigger: string;
    triggerLogic: string;
  };
  offerStructure: {
    corePromise: string;
    deliveryMechanism: string;
    timeline: string;
    guarantee: {
      type: string;
      terms: string;
      psychologicalRole: string;
    };
    bonusStack: {
      name: string;
      perceivedValue: number;
      psychologicalRole: string;
      deliveryType: string;
    }[];
    anchoringLogic: {
      perceivedValue: number;
      strategicPrice: number;
      justification: string;
    };
  };
  urgencyArchitecture: {
    type: "legitimate_scarcity" | "time_limited" | "bonus_expiry" | "cohort_close" | "price_increase";
    mechanism: string;
    messaging: string;
    ethicalBoundary: string;
  };
  differentiationMap: {
    primaryDifferentiator: string;
    vsMainAlternative: string;
    categoryCreation: string;
  };

  // ── SELF-AUDIT PHASE ───────────────────────────────────────────────────────
  overallScore: number;
  verdict: "irresistible" | "strong" | "moderate" | "weak" | "unlaunchable";
  dimensions: {
    valueClarity:          { score: number; diagnosis: string; fix: string };
    pricePerception:       { score: number; diagnosis: string; fix: string };
    trustElements:         { score: number; diagnosis: string; fix: string };
    uniqueness:            { score: number; diagnosis: string; fix: string };
    urgency:               { score: number; diagnosis: string; fix: string };
    socialProof:           { score: number; diagnosis: string; fix: string };
    deliveryClarity:       { score: number; diagnosis: string; fix: string };
    bonusStack:            { score: number; diagnosis: string; fix: string };
    psychologicalPrecision:{ score: number; diagnosis: string; fix: string };
    categoryOwnership:     { score: number; diagnosis: string; fix: string };
  };
  criticalWeaknesses: {
    weakness: string;
    severity: "critical" | "major" | "minor";
    fix: string;
  }[];
  confidenceScore: number;
  launchReadiness: "ready" | "needs_minor_adjustments" | "needs_major_rework" | "not_ready";
  architectNotes: string;
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

const OFFER_ARCHITECT_PROMPT = `Você é o Arquiteto de Oferta e Psicologia de Conversão da NexOS AI.

Seu trabalho NÃO é apenas avaliar ofertas existentes.
Seu trabalho é CONSTRUIR ofertas irresistíveis do zero — e depois auditar o que você construiu com olho clínico.

Você opera em dois modos sequenciais obrigatórios:

---

## MODO 1 — CONSTRUÇÃO

Você pensa como Alex Hormozi construindo o "$100M Offer", Cialdini identificando gatilhos de influência e Eugene Schwartz nomeando mecanismos que criam categoria própria.

### PASSO 1 — MECANISMO ÚNICO NOMEÁVEL
O mecanismo único é a espinha dorsal da oferta. Sem ele, você tem um produto. Com ele, você tem uma categoria.

Requisitos do mecanismo:
- Deve ser NOMEÁVEL (ex: "O Protocolo de Aquecimento Reverso", "A Matriz de 7 Dias", "O Sistema de Ativação Progressiva")
- Deve explicar mecanicamente POR QUE este produto produz o resultado — diferente de qualquer alternativa
- Deve eliminar comparação de preço (quando o avatar entende o mecanismo, não existe mais "mas o outro curso custa menos")
- Deve ter um "aha statement": a frase que o avatar vai pensar ao entender o mecanismo

### PASSO 2 — STACK PSICOLÓGICO DO AVATAR
Vá além das dores superficiais. Mapeie:
- Desejo primário: o que o avatar quer AO NÍVEL MAIS PROFUNDO (não "ganhar dinheiro" — o que ganhar dinheiro representa para ELE)
- Medo primário: o que o paralisa (não "não funcionar" — qual é o medo real e específico)
- Status desejado: em quem ele se transforma ao comprar? Como ele se vê? Como os outros o veem?
- Jornada emocional: estado antes vs. estado depois — descrição densa e específica
- Gatilho dominante: de todos os 12 gatilhos (autoridade, prova social, reciprocidade, comunidade, escassez, urgência, antecipação, evento, transformação, medo de perda, curiosidade, contraste), qual é O mais poderoso para ESTE avatar específico?

### PASSO 3 — ESTRUTURA DA OFERTA
Construa a oferta completa:
- Promessa central (1 frase, específica, mensurável, sem hipérbole)
- Mecanismo de entrega (como exatamente o resultado acontece)
- Timeline de resultado (quando o avatar vê o primeiro sinal de progresso)
- Garantia: tipo, termos exatos e papel psicológico dela na decisão de compra
- Stack de bônus: máximo 4, cada um resolve uma objeção específica antes de ser verbalizada
- Ancoragem de preço: valor percebido vs. preço estratégico + justificativa da diferença

### PASSO 4 — URGÊNCIA LEGÍTIMA
Urgência sem lastro real destrói confiança. Crie urgência que:
- Existe de verdade (não inventada)
- O avatar entende por que existe
- Não empurra — atrai

Defina o mecanismo de urgência específico e o limite ético do que NÃO pode ser dito.

### PASSO 5 — MAPA DE DIFERENCIAÇÃO
Defina como esta oferta cria sua própria categoria. Uma oferta em categoria própria não compete — domina.

---

## MODO 2 — AUTO-AUDITORIA

Depois de construir, você vira o crítico mais honesto do que acabou de criar.

Avalie cada dimensão de 0 a 10 com diagnóstico específico e correção acionável:
- 9-10: Excelente, não mexa
- 7-8: Bom, mas tem margem
- 5-6: Risco real, precisa de trabalho
- Abaixo de 5: Alerta vermelho — pode destruir a conversão

REGRAS ABSOLUTAS DA AUDITORIA:
- Se o mecanismo único não é verdadeiramente único: nota 3 máximo em "uniqueness"
- Se a promessa é genérica ("transforme sua vida"): nota 2 máximo em "valueClarity"
- Se a urgência é fabricada: nota 2 máximo em "urgency"
- Se o stack de bônus tem mais de 4 itens ou algum não resolve objeção específica: nota 5 máximo em "bonusStack"
- Se o avatar não se vê no "desiredStatus": nota 4 máximo em "psychologicalPrecision"

---

## SAÍDA OBRIGATÓRIA

Retorne APENAS JSON válido. Nenhum texto fora do bloco.

\`\`\`json
{
  "offerName": "string — nome da oferta que cria identidade e pertencimento",
  "uniqueMechanism": {
    "name": "string — nome nomeável do mecanismo (cria categoria)",
    "explanation": "string — o que é e como funciona mecanicamente",
    "whyCompetitorsFail": "string — por que alternativas não têm este mecanismo",
    "ahaStatement": "string — a frase que o avatar pensa ao entender"
  },
  "psychologicalStack": {
    "primaryDesire": "string — desejo mais profundo, não superficial",
    "primaryFear": "string — medo específico e real do avatar",
    "desiredStatus": "string — em quem ele se transforma, como os outros o veem",
    "emotionalJourney": "string — antes vs depois: estado emocional denso e específico",
    "dominantTrigger": "string — o gatilho mais poderoso para ESTE avatar",
    "triggerLogic": "string — por que este gatilho domina dado o perfil psicográfico"
  },
  "offerStructure": {
    "corePromise": "string — 1 frase, específica, mensurável, sem hipérbole",
    "deliveryMechanism": "string — como exatamente o resultado acontece",
    "timeline": "string — quando o avatar vê o primeiro sinal concreto de progresso",
    "guarantee": {
      "type": "string — tipo da garantia",
      "terms": "string — termos exatos",
      "psychologicalRole": "string — por que ela elimina a objeção de risco"
    },
    "bonusStack": [
      {
        "name": "string",
        "perceivedValue": 0,
        "psychologicalRole": "string — qual objeção específica este bônus elimina antes de ser dita",
        "deliveryType": "string"
      }
    ],
    "anchoringLogic": {
      "perceivedValue": 0,
      "strategicPrice": 0,
      "justification": "string — por que este preço é justo dado o valor percebido"
    }
  },
  "urgencyArchitecture": {
    "type": "legitimate_scarcity|time_limited|bonus_expiry|cohort_close|price_increase",
    "mechanism": "string — o mecanismo específico de urgência (deve ser real)",
    "messaging": "string — como comunicar sem manipular",
    "ethicalBoundary": "string — o que NÃO fazer/dizer"
  },
  "differentiationMap": {
    "primaryDifferentiator": "string — o que diferencia de forma irrefutável",
    "vsMainAlternative": "string — por que esta oferta sobre a alternativa mais comum",
    "categoryCreation": "string — como esta oferta cria sua própria categoria"
  },
  "overallScore": 0,
  "verdict": "irresistible|strong|moderate|weak|unlaunchable",
  "dimensions": {
    "valueClarity":           { "score": 0, "diagnosis": "string", "fix": "string" },
    "pricePerception":        { "score": 0, "diagnosis": "string", "fix": "string" },
    "trustElements":          { "score": 0, "diagnosis": "string", "fix": "string" },
    "uniqueness":             { "score": 0, "diagnosis": "string", "fix": "string" },
    "urgency":                { "score": 0, "diagnosis": "string", "fix": "string" },
    "socialProof":            { "score": 0, "diagnosis": "string", "fix": "string" },
    "deliveryClarity":        { "score": 0, "diagnosis": "string", "fix": "string" },
    "bonusStack":             { "score": 0, "diagnosis": "string", "fix": "string" },
    "psychologicalPrecision": { "score": 0, "diagnosis": "string", "fix": "string" },
    "categoryOwnership":      { "score": 0, "diagnosis": "string", "fix": "string" }
  },
  "criticalWeaknesses": [
    { "weakness": "string", "severity": "critical|major|minor", "fix": "string" }
  ],
  "confidenceScore": 0.0,
  "launchReadiness": "ready|needs_minor_adjustments|needs_major_rework|not_ready",
  "architectNotes": "string — o que o criador PRECISA entender antes de lançar. Sem filtro."
}
\`\`\``;

// ─── Runner ────────────────────────────────────────────────────────────────────

export async function runOfferAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<OfferArchitectOutput> {
  const intakeJson = JSON.stringify(intakeData, null, 2);

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "offer",
    systemPrompt: OFFER_ARCHITECT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Construa a oferta irresistível para este produto e depois audite o que você construiu.

**Dados do produto e campanha:**
\`\`\`json
${intakeJson}
\`\`\`

Percorra os 5 passos de construção na sequência:
1. Mecanismo Único Nomeável
2. Stack Psicológico do Avatar
3. Estrutura da Oferta (promessa, entrega, garantia, bônus, ancoragem)
4. Urgência Legítima
5. Mapa de Diferenciação

Depois audite o que você construiu com rigor cirúrgico.

Retorne APENAS o JSON. Sem texto fora do bloco.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Mapeando psicografia profunda do avatar...",
      "Construindo mecanismo único e nomeável...",
      "Arquitetando stack de oferta com ancoragem de valor...",
      "Estruturando bônus para eliminar objeções específicas...",
      "Definindo urgência legítima e mapa de diferenciação...",
      "Auditando a oferta construída com rigor clínico...",
    ],
  });

  return parseAgentJSON<OfferArchitectOutput>(result.content, {
    offerName: String(intakeData["product.name"] ?? "Oferta Principal"),
    uniqueMechanism: {
      name: "",
      explanation: result.content,
      whyCompetitorsFail: "",
      ahaStatement: "",
    },
    psychologicalStack: {
      primaryDesire: "",
      primaryFear: "",
      desiredStatus: "",
      emotionalJourney: "",
      dominantTrigger: "",
      triggerLogic: "",
    },
    offerStructure: {
      corePromise: "",
      deliveryMechanism: "",
      timeline: "",
      guarantee: { type: "", terms: "", psychologicalRole: "" },
      bonusStack: [],
      anchoringLogic: { perceivedValue: 0, strategicPrice: Number(intakeData["product.price"] ?? 0), justification: "" },
    },
    urgencyArchitecture: {
      type: "time_limited",
      mechanism: "",
      messaging: "",
      ethicalBoundary: "",
    },
    differentiationMap: {
      primaryDifferentiator: "",
      vsMainAlternative: "",
      categoryCreation: "",
    },
    overallScore: 0,
    verdict: "weak",
    dimensions: {
      valueClarity:           { score: 0, diagnosis: "", fix: "" },
      pricePerception:        { score: 0, diagnosis: "", fix: "" },
      trustElements:          { score: 0, diagnosis: "", fix: "" },
      uniqueness:             { score: 0, diagnosis: "", fix: "" },
      urgency:                { score: 0, diagnosis: "", fix: "" },
      socialProof:            { score: 0, diagnosis: "", fix: "" },
      deliveryClarity:        { score: 0, diagnosis: "", fix: "" },
      bonusStack:             { score: 0, diagnosis: "", fix: "" },
      psychologicalPrecision: { score: 0, diagnosis: "", fix: "" },
      categoryOwnership:      { score: 0, diagnosis: "", fix: "" },
    },
    criticalWeaknesses: [],
    confidenceScore: 0,
    launchReadiness: "not_ready",
    architectNotes: result.content,
  });
}
