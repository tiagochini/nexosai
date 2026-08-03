/**
 * NEXOS Offer Architect (Tópico 4)
 *
 * Você é o NEXOS Offer Architect.
 * Sua função é CONSTRUIR ofertas vendáveis, desejáveis e estrategicamente fortes.
 * Você NÃO apenas analisa — você constrói, depois audita com rigor clínico.
 *
 * Entrega: oferta principal, mecanismo único, promessa central, value stack,
 * bônus, urgência legítima, garantia, objeções + respostas, transformação
 * desejada, redução de risco, motivo para agir agora, pontos fracos,
 * sugestões de melhoria, Launch Readiness Score, Confidence Score.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { buildPsychologicalProfileBlock } from "./profile-injector.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_OFFER } from "./cognitive-identity-system.js";

// ─── Output Types ───────────────────────────────────────────────────────────────

export interface ObjectionEntry {
  objection: string;
  type: "rational" | "emotional" | "social" | "logistical";
  severity: "critical" | "major" | "minor";
  response: string;
  preemptionStrategy: string;  // como rebater ANTES de ser dita
}

export interface ValueStackItem {
  name: string;
  description: string;
  perceivedValue: number;       // valor percebido em R$
  deliveryType: "digital" | "physical" | "service" | "community" | "bonus";
  isBonus: boolean;
  objectionsAddressed: string[];
}

export interface OfferArchitectOutput {
  // ── MARKET ANALYSIS (antes de construir) ────────────────────────────────────
  marketAnalysis: {
    dominantDesire: string;           // desejo dominante do público (profundo, não superficial)
    primaryFear: string;              // medo principal — específico e real
    immediatePain: string;            // dor imediata que o produto resolve HOJE
    rationalObjections: string[];     // objeções racionais (preço, tempo, credibilidade)
    emotionalObjections: string[];    // objeções emocionais (medo de falhar, vergonha, dúvida de si)
    desiredStatus: string;            // em quem o avatar se transforma ao comprar
    marketSophistication: string;     // virgin | low | medium | high | saturated
    valuePerception: string;          // como o mercado percebe o valor de soluções similares
    mainCompetitors: string[];        // principais alternativas no mercado
    competitorWeaknesses: string[];   // o que os concorrentes NÃO entregam
  };

  // ── OFFER CONSTRUCTION ──────────────────────────────────────────────────────
  offerName: string;

  uniqueMechanism: {
    name: string;                     // nome nomeável — cria categoria própria
    explanation: string;              // como funciona mecanicamente
    whyCompetitorsFail: string;       // por que alternativas não têm este mecanismo
    ahaStatement: string;             // a frase que o avatar pensa ao entender
    proof: string;                    // como provar o mecanismo sem exagerar
  };

  desiredTransformation: {
    before: string;                   // estado emocional, financeiro, social ANTES
    after: string;                    // estado emocional, financeiro, social DEPOIS
    transformationTimeline: string;   // quando o avatar vê o primeiro sinal real
    identityShift: string;            // quem ele SE TORNA — identidade, não apenas resultado
    socialProof: string;              // como outros verão essa transformação
  };

  corePromise: string;                // 1 frase, específica, mensurável, sem hipérbole

  psychologicalStack: {
    primaryDesire: string;
    primaryFear: string;
    desiredStatus: string;
    emotionalJourney: string;
    dominantTrigger: string;
    triggerLogic: string;
  };

  valueStack: {
    items: ValueStackItem[];
    totalPerceivedValue: number;      // soma do valor percebido de todos os itens
    strategicPrice: number;           // preço pedido
    valueRatio: string;               // ex: "10:1 — o cliente paga 1 e percebe receber 10"
    anchoringNarrative: string;       // como comunicar a ancoragem de valor
  };

  offerStructure: {
    corePromise: string;
    deliveryMechanism: string;
    timeline: string;
    guarantee: {
      type: string;
      terms: string;
      psychologicalRole: string;
      riskReversalStatement: string;  // frase exata para comunicar a garantia
    };
    bonusStack: {
      name: string;
      perceivedValue: number;
      psychologicalRole: string;
      deliveryType: string;
      objectionsAddressed: string;    // qual objeção específica este bônus elimina
    }[];
    anchoringLogic: {
      perceivedValue: number;
      strategicPrice: number;
      justification: string;
    };
  };

  urgencyArchitecture: {
    type: "legitimate_scarcity" | "time_limited" | "bonus_expiry" | "cohort_close" | "price_increase";
    mechanism: string;                // mecanismo REAL de urgência
    messaging: string;                // como comunicar sem manipular
    ethicalBoundary: string;          // o que NÃO fazer/dizer
    legitimacyProof: string;          // evidência de que a urgência é real
  };

  riskReduction: {
    perceivedRiskLevel: "low" | "medium" | "high" | "critical";
    riskReductionStrategies: string[];  // estratégias específicas para reduzir risco percebido
    guaranteeStructure: string;
    socialProofStrategy: string;
    trialOrEntryOffer: string;        // oferta de entrada que reduz risco
    refundLogic: string;              // lógica de reembolso que aumenta conversão
  };

  reasonToActNow: {
    primaryReason: string;            // razão principal para comprar AGORA (não urgência de prazo — razão real)
    costOfWaiting: string;            // o que o avatar perde ao esperar
    opportunityFraming: string;       // como enquadrar a janela atual como oportunidade única
    actionStatement: string;          // frase de CTA baseada em oportunidade, não pressão
  };

  differentiationMap: {
    primaryDifferentiator: string;
    vsMainAlternative: string;
    categoryCreation: string;
    unfairAdvantage: string;          // vantagem que concorrentes não podem copiar facilmente
  };

  objections: ObjectionEntry[];       // objeções mapeadas com resposta + estratégia de preempção

  // ── SELF-AUDIT ──────────────────────────────────────────────────────────────
  overallScore: number;               // 0-100
  verdict: "irresistible" | "strong" | "moderate" | "weak" | "unlaunchable";
  dimensions: {
    valueClarity:           { score: number; diagnosis: string; fix: string };
    pricePerception:        { score: number; diagnosis: string; fix: string };
    trustElements:          { score: number; diagnosis: string; fix: string };
    uniqueness:             { score: number; diagnosis: string; fix: string };
    urgency:                { score: number; diagnosis: string; fix: string };
    socialProof:            { score: number; diagnosis: string; fix: string };
    deliveryClarity:        { score: number; diagnosis: string; fix: string };
    bonusStack:             { score: number; diagnosis: string; fix: string };
    psychologicalPrecision: { score: number; diagnosis: string; fix: string };
    categoryOwnership:      { score: number; diagnosis: string; fix: string };
    riskReduction:          { score: number; diagnosis: string; fix: string };
    transformationClarity:  { score: number; diagnosis: string; fix: string };
  };
  criticalWeaknesses: {
    weakness: string;
    severity: "critical" | "major" | "minor";
    fix: string;
    urgency: "immediate" | "before_launch" | "post_launch";
  }[];
  improvementSuggestions: {
    suggestion: string;
    impact: "high" | "medium" | "low";
    effort: "easy" | "medium" | "hard";
    priority: number;               // 1 = highest priority
  }[];
  launchReadinessScore: number;       // 0-100 numérico
  launchReadiness: "ready" | "needs_minor_adjustments" | "needs_major_rework" | "not_ready";
  confidenceScore: number;            // 0-1
  architectNotes: string;
}

// ─── System Prompt ──────────────────────────────────────────────────────────────

const OFFER_ARCHITECT_PROMPT = `Você é o NEXOS Offer Architect.

## ETAPA -1 — DIAGNÓSTICO DE FASE PLF (OBRIGATÓRIO)

A oferta de fundador numa abertura de carrinho tem arquitetura diferente da oferta de um upsell pós-compra.
Uma oferta de CPL tem estrutura diferente de uma oferta de fechamento.
Identifique a fase antes de arquitetar qualquer stack de valor.

**OFERTA DE LISTA DE ESPERA / PRÉ-LANÇAMENTO (D0–D13):**
Objetivo: capturar o lead, não vender ainda. "Oferta" aqui é de conteúdo gratuito.
Valor percebido deve superar o custo percebido de cadastro (tempo + e-mail).
Técnica: Reciprocidade (Cialdini) — lead magnet de altíssimo valor gera obrigação emocional.

**OFERTA DE CPL (D14–D20):**
Objetivo: entregar valor gratuito que qualifica o lead para a oferta real.
Nunca revele o produto aqui — apenas o resultado que o produto entrega.
Técnica: Schwartz (Consciousness Stage building) — cada CPL sobe um nível de consciência.

**OFERTA DE ABERTURA DE CARRINHO (D21) — MÁXIMA ATENÇÃO:**
Objetivo: CONVERTER. Esta é a oferta principal de lançamento.
Estrutura obrigatória: Promessa Principal → Mecanismo Único → Stack de Valor → Bônus → Garantia → Preço Ancorado → Preço Final → Urgência Legítima
Técnica: Hormozi (Grand Slam Offer — valor percebido >> preço), Jay Abraham (Risk Reversal total), Kern (State Aiming — vida depois antes do preço), Van Westendorp (preço dentro da zona de indiferença)

**OFERTA DE MID-CART (D22–D23):**
Objetivo: reforçar valor + eliminar objeções de preço + adicionar prova.
Introduzir bônus de urgência real se disponíveis (com prazo verdadeiro).
Técnica: Ariely (Decoy Effect — posicione preço com referência de ancoragem), Thaler (arquitetura de decisão)

**OFERTA DE FECHAMENTO (D24):**
Objetivo: último call. Urgência máxima. Remover o bônus ou aumentar preço — verdadeiramente.
Técnica: Kahneman (Loss Aversion — enquadre em termos do que se perde, não do que se ganha)

**OFERTA DE UPSELL PÓS-COMPRA:**
Objetivo: resolver o PRÓXIMO problema do comprador — não vender qualquer coisa.
Técnica: Jay Abraham (Next Problem Selling), Fogg (Motivation Wave — pico de motivação pós-compra)

---


Sua missão: CONSTRUIR a oferta — não apenas analisar. Você pensa como Alex Hormozi construindo o "\$100M Offer", Cialdini identificando gatilhos de influência e Eugene Schwartz mapeando estágios de consciência que determinam o ângulo de entrada perfeito.

## REGRAS ABSOLUTAS

Você NUNCA pode:
- Criar falsa escassez (urgência fabricada sem base real)
- Exagerar resultados não comprováveis
- Criar claims ilegais ou não verificáveis
- Prometer resultado garantido sem base em dados reais do produto
- Usar manipulação antiética (medo excessivo, vergonha, pressão social forçada)
- Criar bônus genéricos que não resolvem objeção específica
- Usar linguagem de guru ("vai explodir", "vida transformada em 7 dias", "segredo nunca revelado")

---

## PASSO 0 — ANÁLISE DE MERCADO (ANTES DE CONSTRUIR)

Antes de qualquer construção, entenda o campo de batalha:

**Desejo Dominante:** O que o avatar quer AO NÍVEL MAIS PROFUNDO — não "ganhar dinheiro", mas o que ganhar dinheiro representa (liberdade, respeito, segurança, status, prova para si mesmo).

**Medo Principal:** O medo real e específico — não "não funcionar", mas qual é o medo concreto que o paralisa (falhar novamente, que o cônjuge perca a fé, perder a oportunidade única de mudar).

**Dor Imediata:** O que está acontecendo NA VIDA DELE HOJE que torna a dor urgente.

**Objeções Racionais:** Preço alto, falta de tempo, "já tentei antes", "não tenho habilidade técnica".

**Objeções Emocionais:** Medo de falhar, vergonha se não funcionar, "não mereço isso", "e se eu tentar e não der certo?".

**Sofisticação do Mercado:** Virgin → Low → Medium → High → Saturated. Determina o ÂNGULO de entrada da oferta.
- Virgin/Low: promessa direta funciona → venda o resultado
- Medium: adicione o mecanismo → "como este método funciona diferente"
- High: mecanismo + avatar específico → "para [nicho] que [situação específica]"
- Saturated: nova entrada + credibilidade + proof → desconstrua expectativas, entre por baixo do radar

---

## PASSO 1 — MECANISMO ÚNICO NOMEÁVEL

O mecanismo é a espinha dorsal da oferta. Sem ele, você tem um produto. Com ele, você tem uma categoria.

Requisitos:
- NOMEÁVEL (ex: "O Protocolo de Aquecimento Reverso", "A Matriz de 7 Dias", "O Sistema de Ativação Progressiva")
- Explica mecanicamente POR QUE este produto produz resultado diferente de qualquer alternativa
- Elimina comparação de preço — quando o avatar entende o mecanismo, não existe mais "mas o outro custa menos"
- Tem um "aha statement": a frase que o avatar pensa ao entender

**Prova do Mecanismo:** Como demonstrar que o mecanismo funciona sem exagerar ou inventar. Pode ser: resultado parcial demonstrável, analogia com mecanismo conhecido, depoimento de processo (não de resultado), lógica explicada em partes.

---

## PASSO 2 — TRANSFORMAÇÃO DESEJADA

Não venda o produto — venda a TRANSFORMAÇÃO.

Mapeie:
- Estado ANTES: situação emocional, financeira, social e de identidade antes do produto
- Estado DEPOIS: não apenas o resultado — quem ele SE TORNA. A identidade nova.
- Identity Shift: "Antes eu era X. Depois de [produto], eu me tornei Y." — isso é o que realmente se compra.
- Timeline: quando o avatar vê o PRIMEIRO SINAL concreto de progresso (não o resultado final)
- Como outros verão essa transformação: o elemento social da transformação

---

## PASSO 3 — ESTRUTURA COMPLETA DA OFERTA

**Promessa Central:** 1 frase, específica, mensurável, temporalmente definida, sem hipérbole. Deve ser verificável.

**Value Stack:** O total de valor percebido deve ser mínimo 5-10x o preço pedido. Cada item:
- Tem nome claro
- Tem valor percebido justificado (não inventado)
- É digital, físico, serviço ou comunidade
- Resolve uma dor ou objeção específica

**Bônus:** Máximo 4. Cada bônus deve:
- Resolver uma objeção ESPECÍFICA antes de ser verbalizada
- Ter valor percebido justificado
- Não ser um arquivo genérico sem valor real

**Garantia:** O risco não elimina a compra — o risco PERCEBIDO sim. Construa uma garantia que:
- Reverte o risco do avatar (não do vendedor)
- Tem termos claros e honestos
- Inclui uma frase exata de risk reversal para usar no copy

**Ancoragem de Preço:** Valor percebido total vs. preço pedido. A diferença é o "desconto" que o avatar percebe receber.

---

## PASSO 4 — URGÊNCIA LEGÍTIMA E MOTIVO PARA AGIR AGORA

**Urgência Legítima:** Só existe se for REAL. Tipos válidos:
- Vagas limitadas com razão real (turma fechada, capacidade de entrega)
- Prazo real (evento, data de encerramento programada)
- Bônus expira em data real
- Preço aumenta em data previamente comunicada

**Motivo para Agir Agora** (diferente de urgência de prazo):
- Custo de esperar: o que o avatar PERDE a cada mês que não age?
- Oportunidade de janela: por que AGORA é o momento ideal?
- CTA baseado em oportunidade, não em pressão

---

## PASSO 5 — OBJEÇÕES MAPEADAS

Para cada objeção provável:
- Tipo: racional / emocional / social / logística
- Severidade: critical / major / minor
- Resposta direta
- Estratégia de preempção (como rebater ANTES de ser verbalizada — no copy, bônus, garantia)

---

## PASSO 6 — REDUÇÃO DE RISCO PERCEBIDO

O risco percebido é a principal barreira de conversão após o desejo estar presente.

Estratégias:
- Garantia (tipo e termos)
- Prova social (tipo certo no momento certo)
- Oferta de entrada / trial que reduz exposição inicial
- Transparência sobre o processo (não sobre o resultado)
- Framing de investimento vs. custo

---

## PASSO 7 — DIFERENCIAÇÃO E CATEGORIA PRÓPRIA

Uma oferta em categoria própria não compete — domina.

Identifique:
- O diferencial irrefutável (não "melhor qualidade" — o que ninguém mais tem)
- Por que sobre a alternativa mais comum no mercado
- Como esta oferta cria sua própria categoria
- A vantagem que concorrentes não conseguem copiar facilmente

---

## MODO AUTO-AUDITORIA (12 dimensões — 0 a 10 cada)

Avalie com olho clínico DEPOIS de construir:

REGRAS RÍGIDAS:
- Mecanismo único não é genuinamente único → máximo 3 em "uniqueness"
- Promessa genérica ("transforme sua vida") → máximo 2 em "valueClarity"
- Urgência fabricada → máximo 2 em "urgency"
- Bônus sem resolver objeção → máximo 5 em "bonusStack"
- Transformação não é específica → máximo 4 em "transformationClarity"
- Risk reversal fraco → máximo 4 em "riskReduction"

Calcule launchReadinessScore (0-100):
- ≥ 80: ready
- 65-79: needs_minor_adjustments
- 45-64: needs_major_rework
- < 45: not_ready

---

## SAÍDA OBRIGATÓRIA

Retorne APENAS JSON válido. Zero texto fora do bloco.

\`\`\`json
{
  "marketAnalysis": {
    "dominantDesire": "string",
    "primaryFear": "string",
    "immediatePain": "string",
    "rationalObjections": ["string"],
    "emotionalObjections": ["string"],
    "desiredStatus": "string",
    "marketSophistication": "string",
    "valuePerception": "string",
    "mainCompetitors": ["string"],
    "competitorWeaknesses": ["string"]
  },
  "offerName": "string",
  "uniqueMechanism": {
    "name": "string",
    "explanation": "string",
    "whyCompetitorsFail": "string",
    "ahaStatement": "string",
    "proof": "string"
  },
  "desiredTransformation": {
    "before": "string",
    "after": "string",
    "transformationTimeline": "string",
    "identityShift": "string",
    "socialProof": "string"
  },
  "corePromise": "string",
  "psychologicalStack": {
    "primaryDesire": "string",
    "primaryFear": "string",
    "desiredStatus": "string",
    "emotionalJourney": "string",
    "dominantTrigger": "string",
    "triggerLogic": "string"
  },
  "valueStack": {
    "items": [
      {
        "name": "string",
        "description": "string",
        "perceivedValue": 0,
        "deliveryType": "digital|physical|service|community|bonus",
        "isBonus": false,
        "objectionsAddressed": ["string"]
      }
    ],
    "totalPerceivedValue": 0,
    "strategicPrice": 0,
    "valueRatio": "string",
    "anchoringNarrative": "string"
  },
  "offerStructure": {
    "corePromise": "string",
    "deliveryMechanism": "string",
    "timeline": "string",
    "guarantee": {
      "type": "string",
      "terms": "string",
      "psychologicalRole": "string",
      "riskReversalStatement": "string"
    },
    "bonusStack": [
      {
        "name": "string",
        "perceivedValue": 0,
        "psychologicalRole": "string",
        "deliveryType": "string",
        "objectionsAddressed": "string"
      }
    ],
    "anchoringLogic": {
      "perceivedValue": 0,
      "strategicPrice": 0,
      "justification": "string"
    }
  },
  "urgencyArchitecture": {
    "type": "legitimate_scarcity|time_limited|bonus_expiry|cohort_close|price_increase",
    "mechanism": "string",
    "messaging": "string",
    "ethicalBoundary": "string",
    "legitimacyProof": "string"
  },
  "riskReduction": {
    "perceivedRiskLevel": "low|medium|high|critical",
    "riskReductionStrategies": ["string"],
    "guaranteeStructure": "string",
    "socialProofStrategy": "string",
    "trialOrEntryOffer": "string",
    "refundLogic": "string"
  },
  "reasonToActNow": {
    "primaryReason": "string",
    "costOfWaiting": "string",
    "opportunityFraming": "string",
    "actionStatement": "string"
  },
  "differentiationMap": {
    "primaryDifferentiator": "string",
    "vsMainAlternative": "string",
    "categoryCreation": "string",
    "unfairAdvantage": "string"
  },
  "objections": [
    {
      "objection": "string",
      "type": "rational|emotional|social|logistical",
      "severity": "critical|major|minor",
      "response": "string",
      "preemptionStrategy": "string"
    }
  ],
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
    "categoryOwnership":      { "score": 0, "diagnosis": "string", "fix": "string" },
    "riskReduction":          { "score": 0, "diagnosis": "string", "fix": "string" },
    "transformationClarity":  { "score": 0, "diagnosis": "string", "fix": "string" }
  },
  "criticalWeaknesses": [
    {
      "weakness": "string",
      "severity": "critical|major|minor",
      "fix": "string",
      "urgency": "immediate|before_launch|post_launch"
    }
  ],
  "improvementSuggestions": [
    {
      "suggestion": "string",
      "impact": "high|medium|low",
      "effort": "easy|medium|hard",
      "priority": 1
    }
  ],
  "launchReadinessScore": 0,
  "launchReadiness": "ready|needs_minor_adjustments|needs_major_rework|not_ready",
  "confidenceScore": 0.0,
  "architectNotes": "string — o que o criador PRECISA entender antes de lançar. Sem filtro."
}
\`\`\``;

// ─── Defaults ───────────────────────────────────────────────────────────────────

function defaultOutput(intakeData: Record<string, unknown>): OfferArchitectOutput {
  const price = Number(intakeData["product.price"] ?? 0);
  return {
    marketAnalysis: {
      dominantDesire: "", primaryFear: "", immediatePain: "",
      rationalObjections: [], emotionalObjections: [], desiredStatus: "",
      marketSophistication: "medium", valuePerception: "",
      mainCompetitors: [], competitorWeaknesses: [],
    },
    offerName: String(intakeData["product.name"] ?? "Oferta Principal"),
    uniqueMechanism: { name: "", explanation: "", whyCompetitorsFail: "", ahaStatement: "", proof: "" },
    desiredTransformation: { before: "", after: "", transformationTimeline: "", identityShift: "", socialProof: "" },
    corePromise: "",
    psychologicalStack: {
      primaryDesire: "", primaryFear: "", desiredStatus: "",
      emotionalJourney: "", dominantTrigger: "", triggerLogic: "",
    },
    valueStack: {
      items: [], totalPerceivedValue: 0, strategicPrice: price,
      valueRatio: "0:1", anchoringNarrative: "",
    },
    offerStructure: {
      corePromise: "", deliveryMechanism: "", timeline: "",
      guarantee: { type: "", terms: "", psychologicalRole: "", riskReversalStatement: "" },
      bonusStack: [],
      anchoringLogic: { perceivedValue: 0, strategicPrice: price, justification: "" },
    },
    urgencyArchitecture: {
      type: "time_limited", mechanism: "", messaging: "",
      ethicalBoundary: "", legitimacyProof: "",
    },
    riskReduction: {
      perceivedRiskLevel: "medium", riskReductionStrategies: [],
      guaranteeStructure: "", socialProofStrategy: "",
      trialOrEntryOffer: "", refundLogic: "",
    },
    reasonToActNow: {
      primaryReason: "", costOfWaiting: "", opportunityFraming: "", actionStatement: "",
    },
    differentiationMap: {
      primaryDifferentiator: "", vsMainAlternative: "", categoryCreation: "", unfairAdvantage: "",
    },
    objections: [],
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
      riskReduction:          { score: 0, diagnosis: "", fix: "" },
      transformationClarity:  { score: 0, diagnosis: "", fix: "" },
    },
    criticalWeaknesses: [],
    improvementSuggestions: [],
    launchReadinessScore: 0,
    launchReadiness: "not_ready",
    confidenceScore: 0,
    architectNotes: "",
  };
}

// ─── Runner ─────────────────────────────────────────────────────────────────────

export async function runOfferAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
  memoryContext?: string,
  strategyData?: Record<string, unknown>,
): Promise<OfferArchitectOutput> {
  const intakeJson = JSON.stringify(
    {
      "product.name": intakeData["product.name"],
      "product.category": intakeData["product.category"],
      "product.price": intakeData["product.price"],
      "product.description": intakeData["product.description"],
      "product.deliveryMethod": intakeData["product.deliveryMethod"],
      "product.pricingModel": intakeData["product.pricingModel"],
      "audience.sophisticationLevel": intakeData["audience.sophisticationLevel"],
      "audience.awarenessLevel": intakeData["audience.awarenessLevel"],
      "campaign.type": intakeData["campaign.type"],
      "campaign.revenueTarget": intakeData["campaign.revenueTarget"],
      "campaign.salesChannel": intakeData["campaign.salesChannel"],
      "content.tone": intakeData["content.tone"],
    },
    null,
    2,
  );

  // ── Build strategy context block ─────────────────────────────────────────────
  // When strategyData is present, extract the fields that anchor the offer:
  // positioning, unique mechanism name, big domino, sophistication strategy,
  // core narrative and emotional hook. The offer MUST use the same mechanism
  // name the strategy agent already defined — never invent a parallel name.
  let strategyContextBlock = "";
  if (strategyData && Object.keys(strategyData).length > 0) {
    const sd = strategyData as any;
    const primaryDifferentiator: string = sd.offerPositioning?.primaryDifferentiator ?? "";
    const positioning: string            = sd.offerPositioning?.positioning ?? "";
    const uvp: string                    = sd.offerPositioning?.uniqueValueProposition ?? "";
    const bigDomino: string              = sd.bigDomino ?? "";
    const sophisticationStrategy: string = sd.audienceSegmentation?.sophisticationStrategy ?? "";
    const coreNarrative: string          = sd.campaignArchitecture?.coreNarrative ?? "";
    const emotionalHook: string          = sd.campaignArchitecture?.emotionalHook ?? "";
    const competitiveAdvantages: string[] = sd.offerPositioning?.competitiveAdvantages ?? [];

    if (primaryDifferentiator || bigDomino || positioning) {
      strategyContextBlock = `
**⚠ POSICIONAMENTO ESTRATÉGICO — OUTPUT DO AGENTE DE ESTRATÉGIA (OBRIGATÓRIO)**

O Agente de Estratégia já definiu o posicionamento desta campanha. Você DEVE construir a oferta ancorada neste posicionamento — não invente uma estratégia paralela.

| Campo                    | Valor definido pela Estratégia |
|--------------------------|-------------------------------|
| Big Domino               | ${bigDomino} |
| Posicionamento           | ${positioning} |
| UVP                      | ${uvp} |
| Diferenciador Principal  | ${primaryDifferentiator} |
| Sofisticação de Mercado  | ${sophisticationStrategy} |
| Narrativa Central        | ${coreNarrative} |
| Hook Emocional           | ${emotionalHook} |
${competitiveAdvantages.length > 0 ? `| Vantagens Competitivas   | ${competitiveAdvantages.slice(0, 3).join(" · ")} |` : ""}

**REGRA CRÍTICA — MECANISMO ÚNICO:**
O campo \`uniqueMechanism.name\` no seu JSON de saída DEVE ser o diferenciador principal já definido:
"${primaryDifferentiator}"

Não crie um nome diferente. O mecanismo único já foi nomeado e validado pela estratégia. Seu trabalho é detalhar como ele funciona, por que os concorrentes falham sem ele, e como provar sem exagerar — usando exatamente este nome.

---
`;
    }

    log.info({
      campaignId,
      hasPrimaryDifferentiator: !!primaryDifferentiator,
      hasBigDomino: !!bigDomino,
      hasPositioning: !!positioning,
    }, "[OFFER_AGENT] strategyData recebido e injetado no prompt");
  } else {
    log.warn({ campaignId }, "[OFFER_AGENT] strategyData ausente — oferta construída sem contexto estratégico");
  }

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "offer",
    profileContext: buildPsychologicalProfileBlock(intakeData),
    systemPrompt: COGNITIVE_IDENTITY_OFFER + OFFER_ARCHITECT_PROMPT,
    memoryContext,
    thinkingMessages: [
      "Lendo posicionamento estratégico — big domino, mecanismo único, sofisticação...",
      "Analisando mercado — desejo dominante, medo principal, sofisticação...",
      "Ancorando mecanismo único ao posicionamento estratégico...",
      "Definindo transformação desejada e identity shift...",
      "Arquitetando value stack com ancoragem de 10x...",
      "Mapeando objeções racionais e emocionais com respostas...",
      "Estruturando urgência legítima e redução de risco percebido...",
      "Auditando a oferta com 12 dimensões de qualidade...",
      "Gerando Launch Readiness Score e sugestões de melhoria...",
    ],
    messages: [
      {
        role: "user",
        content: `Construa a oferta irresistível para este produto. Execute os 7 passos em sequência, depois audite com 12 dimensões.
${strategyContextBlock}
**Dados do produto e campanha:**
\`\`\`json
${intakeJson}
\`\`\`

Sequência obrigatória:
0. Análise de Mercado (desejo dominante, medo, sofisticação, objeções racionais e emocionais)
1. Mecanismo Único Nomeável — use o nome definido pela estratégia acima, não invente outro
2. Transformação Desejada (before/after/identity shift)
3. Promessa Central + Value Stack (total percebido ≥ 5x o preço)
4. Urgência Legítima + Motivo para Agir Agora
5. Objeções Mapeadas (pelo menos 5, com respostas e estratégias de preempção)
6. Redução de Risco Percebido
7. Auto-Auditoria em 12 dimensões → Launch Readiness Score (0-100)

RESTRIÇÕES ABSOLUTAS:
- Zero falsa escassez
- Zero claims não verificáveis
- Zero linguagem de guru
- Zero resultado garantido sem base em dados do produto

Retorne APENAS o JSON válido.`,
      },
    ],
    log,
    requiresApproval: false,
  });

  const parsed = parseAgentJSON<OfferArchitectOutput>(result.content, defaultOutput(intakeData));
  const output: OfferArchitectOutput = { ...defaultOutput(intakeData), ...parsed };

  // Ensure nested objects are not completely missing
  if (!output.marketAnalysis?.dominantDesire) {
    output.marketAnalysis = defaultOutput(intakeData).marketAnalysis;
  }
  if (!output.desiredTransformation?.before) {
    output.desiredTransformation = defaultOutput(intakeData).desiredTransformation;
  }
  if (!output.valueStack?.items) {
    output.valueStack = defaultOutput(intakeData).valueStack;
  }
  if (!output.riskReduction?.riskReductionStrategies) {
    output.riskReduction = defaultOutput(intakeData).riskReduction;
  }
  if (!output.reasonToActNow?.primaryReason) {
    output.reasonToActNow = defaultOutput(intakeData).reasonToActNow;
  }
  if (!Array.isArray(output.objections)) {
    output.objections = [];
  }
  if (!Array.isArray(output.improvementSuggestions)) {
    output.improvementSuggestions = [];
  }

  // Ensure launchReadiness is consistent with launchReadinessScore
  const score = output.launchReadinessScore ?? 0;
  if (score >= 80) output.launchReadiness = "ready";
  else if (score >= 65) output.launchReadiness = "needs_minor_adjustments";
  else if (score >= 45) output.launchReadiness = "needs_major_rework";
  else output.launchReadiness = "not_ready";

  // Clamp scores
  output.confidenceScore = Math.min(1, Math.max(0, output.confidenceScore ?? 0));
  output.launchReadinessScore = Math.min(100, Math.max(0, output.launchReadinessScore ?? 0));
  output.overallScore = Math.min(100, Math.max(0, output.overallScore ?? 0));

  log.info(
    {
      campaignId,
      verdict: output.verdict,
      overallScore: output.overallScore,
      launchReadinessScore: output.launchReadinessScore,
      launchReadiness: output.launchReadiness,
      objectionsCount: output.objections.length,
      valueStackTotal: output.valueStack?.totalPerceivedValue,
      confidenceScore: output.confidenceScore,
    },
    "Offer Architect completed",
  );

  return output;
}
