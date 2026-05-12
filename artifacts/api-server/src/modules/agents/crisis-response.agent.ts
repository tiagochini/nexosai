/**
 * Crisis Response Agent
 * Handles PR crises, hostile comment waves, negative reviews, and reputation attacks.
 * Produces rapid-response protocols with specific messaging for each scenario.
 * Provider: Claude (empathy, judgment, strategic reasoning)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { type AgentAction } from "./agent-brain.js";
import type { Logger } from "pino";

export type CrisisType =
  | "negative_reviews_wave"
  | "hostile_comments"
  | "refund_wave"
  | "false_claims_competitor"
  | "delivery_failure"
  | "technical_failure"
  | "influencer_attack"
  | "media_coverage_negative"
  | "data_breach"
  | "promise_vs_delivery_gap";

export interface CrisisResponseOutput {
  crisisType: CrisisType;
  severityLevel: 1 | 2 | 3 | 4 | 5; // 1=minor, 5=existential
  diagnosisInsight: string;   // root cause, not just symptoms
  immediateActions: string[]; // what to do in the next 2 hours
  doNotList: string[];        // what NOT to do (often more important)
  publicStatement: {
    platform: "instagram_story" | "email" | "whatsapp_broadcast" | "press_release";
    tone: string;
    content: string;
  }[];
  internalProtocol: string;   // what to tell the team privately
  affectedAudienceResponse: {
    segment: string;          // who they are
    protocol: string;         // how to respond to this specific group
    templateMessage: string;  // ready-to-use message
  }[];
  timeline: {
    hour: number;
    action: string;
    responsible: string;      // "criador", "time de suporte", "agente jurídico"
  }[];
  reputationRecoveryPlan: string;  // how to rebuild after the crisis
  lessonsLearned: string[];        // systemic fixes to prevent recurrence
  actions: AgentAction[];
}

const CRISIS_RESPONSE_PROMPT = `Você é o Agente Crisis Response do NexOS AI — especialista em gestão de crises de reputação para criadores e infoprodutores brasileiros.

Sua filosofia: crises não são o fim — são momentos que definem permanentemente como a audiência percebe o criador. Uma crise bem gerida pode fortalecer a confiança mais do que nunca tê-la enfrentado.

## PRINCÍPIOS DE GESTÃO DE CRISE

### PRINCÍPIO 1 — VELOCIDADE DE RESPOSTA
A janela de controle é de 2-4 horas. Depois disso, a narrativa já tem vida própria. Cada hora de silêncio é interpretada como culpa.

### PRINCÍPIO 2 — HIERARQUIA DE RESPOSTA
1. Reconhecer (nunca negar o que é verificável)
2. Empatizar (com quem foi afetado, sem self-pity)
3. Assumir responsabilidade (pelo que é de fato responsabilidade sua)
4. Ação concreta (o que você vai fazer — com prazo)
5. Prevenir recorrência (mudança sistêmica)

### PRINCÍPIO 3 — O QUE NUNCA FAZER
- Nunca atacar críticos publicamente (mesmo tendo razão)
- Nunca minimizar ("foi apenas um erro pequeno")
- Nunca mentir sobre o que aconteceu
- Nunca deixar o silêncio durar mais de 4 horas em crise pública
- Nunca deletar comentários negativos legítimos (amplifica a crise)
- Nunca responder com advogado no tom (reforça percepção de culpa corporativa)
- Nunca oferecer compensação genérica que não resolve o problema real

### PRINCÍPIO 4 — SEGMENTAÇÃO DE RESPOSTA
Diferentes audiências precisam de mensagens diferentes:
- Afetados diretos: prioridade máxima, resposta individual quando possível
- Audiência geral (observadores): mensagem pública de transparência
- Afiliados/parceiros: comunicação privada e antecipada (antes da pública)
- Imprensa/influencers: fatos verificáveis, acesso a porta-voz

### PRINCÍPIO 5 — RECUPERAÇÃO DE REPUTAÇÃO
A crise passa. O que fica é como o criador a gerenciou. Crises bem geridas frequentemente resultam em:
- Aumento de confiança com a audiência existente
- Prova de integridade para novos leads
- Diferenciação de concorrentes que nunca passaram por isso

## AÇÕES DO SISTEMA
Se severityLevel >= 4: emita ALERT_HUMAN e ESCALATE_DECISION (decisões existenciais precisam de humano)
Se houver falha técnica: emita PAUSE_SEQUENCE (pausar automações até resolver)
Se há wave de reembolsos: emita ALERT_HUMAN + GENERATE_REPORT

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "crisisType": "string",
  "severityLevel": 1,
  "diagnosisInsight": "string — causa raiz real, não apenas descrição dos sintomas",
  "immediateActions": ["string — o que fazer nas próximas 2 horas, em ordem"],
  "doNotList": ["string — o que absolutamente NÃO fazer"],
  "publicStatement": [
    {
      "platform": "instagram_story|email|whatsapp_broadcast|press_release",
      "tone": "string — tom da comunicação",
      "content": "string — declaração completa, pronta para publicar"
    }
  ],
  "internalProtocol": "string — o que comunicar ao time internamente",
  "affectedAudienceResponse": [
    {
      "segment": "string — quem são (compradores afetados, críticos públicos, etc.)",
      "protocol": "string — abordagem para este grupo",
      "templateMessage": "string — mensagem pronta para usar"
    }
  ],
  "timeline": [
    {
      "hour": 0,
      "action": "string — ação específica",
      "responsible": "string — quem executa"
    }
  ],
  "reputationRecoveryPlan": "string — plano de 30 dias para reconstruir após a crise",
  "lessonsLearned": ["string — mudança sistêmica para prevenir recorrência"],
  "actions": [
    {
      "type": "ALERT_HUMAN|ESCALATE_DECISION|PAUSE_SEQUENCE|GENERATE_REPORT",
      "confidence": 0.0,
      "urgency": "immediate|next_12h|next_24h|next_week",
      "rationale": "string",
      "params": {},
      "requiresApproval": true,
      "estimatedImpact": "string"
    }
  ]
}
\`\`\``;

export async function runCrisisResponseAgent(
  campaignId: string | null,
  workspaceId: string,
  crisisDescription: string,
  crisisType: string,
  audienceSize: number,
  affectedCount: number,
  log: Logger,
): Promise<CrisisResponseOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "crisis_response",
    systemPrompt: CRISIS_RESPONSE_PROMPT,
    messages: [
      {
        role: "user",
        content: `Desenvolva o protocolo completo de resposta à crise.

**Descrição da crise:** ${crisisDescription}
**Tipo:** ${crisisType}
**Tamanho da audiência:** ${audienceSize}
**Estimativa de afetados:** ${affectedCount}

**PROCESSO IMEDIATO (percorra nesta ordem):**
1. Classifique a severidade (1-5) e identifique a causa raiz real
2. Defina as ações imediatas das próximas 2 horas
3. Escreva as declarações públicas por canal (uma para cada)
4. Segmente a resposta por grupo de audiência afetada
5. Monte o protocolo interno para o time
6. Crie o plano de 30 dias de recuperação de reputação
7. Emita ações de sistema conforme necessidade

A velocidade é crítica. Priorize clareza e ação.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Avaliando severidade e causa raiz da crise...",
      "Definindo ações imediatas das próximas 2 horas...",
      "Redigindo declarações públicas por canal...",
      "Segmentando respostas por grupo afetado...",
      "Montando plano de recuperação de reputação...",
    ],
  });

  return parseAgentJSON<CrisisResponseOutput>(result.content, {
    crisisType: crisisType as CrisisType,
    severityLevel: 3,
    diagnosisInsight: "",
    immediateActions: [],
    doNotList: [],
    publicStatement: [],
    internalProtocol: "",
    affectedAudienceResponse: [],
    timeline: [],
    reputationRecoveryPlan: "",
    lessonsLearned: [],
    actions: [],
  });
}
