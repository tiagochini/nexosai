/**
 * Re-engagement Agent
 * Brings back cold, ghosted, or inactive leads with fresh angles and sequences.
 * Segments leads by inactivity reason and applies targeted win-back strategies.
 * Provider: Claude (empathy, pattern recognition, strategy)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { type AgentAction } from "./agent-brain.js";
import type { Logger } from "pino";

export interface ReengagementSegment {
  segment: "price_hesitation" | "busy_forgotten" | "not_convinced" | "competitor_went" | "timing_wrong" | "passive_looker";
  size: string;              // estimated % of cold base in this segment
  diagnosis: string;         // why they went cold
  reengagementAngle: string; // the specific angle to use
  sequence: {
    day: number;
    channel: "email" | "whatsapp" | "sms";
    subject?: string;
    body: string;
    objective: string;
  }[];
}

export interface ReengagementOutput {
  coldAudienceSize: string;
  reengagementGoal: string;    // realistic expected reactivation rate
  universalInsight: string;    // why most win-back campaigns fail (for this audience)
  segments: ReengagementSegment[];
  winBackSequence: {
    emailSubjects: string[];   // 3-email win-back subjects
    whatsappMessages: string[]; // 2-message WhatsApp win-back
    smsMessages: string[];     // optional SMS
  };
  newAngle: string;            // completely fresh positioning angle for cold leads
  contentStrategy: string;    // what type of content to send to warm them first
  offerAdjustment: string;    // should the offer be different for cold leads? (payment, bonus)
  suppressionCriteria: string; // which leads to remove from re-engagement (waste of effort)
  actions: AgentAction[];
}

const REENGAGEMENT_PROMPT = `Você é o Agente Re-engagement do NexOS AI — especialista em ressuscitar leads frios e recuperar audiências que pararam de engajar.

Sua filosofia: leads frios não são leads perdidos. São leads que ainda não viram a mensagem certa, no momento certo, com o ângulo certo.

## FRAMEWORK DE REATIVAÇÃO

### DIAGNÓSTICO DE FRIEZA (por que foram embora?)
Leads ficam frios por razões diferentes, e cada razão exige uma abordagem diferente:

1. **Price hesitation** — interessaram mas acharam caro. Não precisam de desconto — precisam de âncora de valor.
2. **Busy/forgotten** — vida aconteceu. O lead sumiu, não rejeitou. Um "olha eu ainda estou aqui" basta.
3. **Not convinced** — a promessa não fechou para eles. Precisam de novo mecanismo ou nova prova social.
4. **Went to competitor** — compraram outra solução. Foco: o que a concorrência não entrega.
5. **Timing wrong** — não era o momento certo. Agora pode ser. Pergunta: "e agora?"
6. **Passive looker** — nunca foram quentes. Eram leads demográficos, não psicográficos. Provavelmente para suprimir.

### REGRAS DE WIN-BACK

**Regra 1 — Não comece com oferta**
O primeiro contato de reativação deve ser de valor, não de venda. Artigo, insight, curiosidade. Só então volte com a oferta.

**Regra 2 — Admita o silêncio**
"Faz um tempo que não falamos" > fingir que o silêncio não aconteceu. Honestidade cria conexão.

**Regra 3 — Novo ângulo, não repetição**
A mensagem que não converteu antes não vai converter repetida. Precisa de um ângulo completamente novo.

**Regra 4 — Supressão inteligente**
Leads que não abriram NENHUM email em 6+ meses e nunca clicaram em nada: suprima. Não são leads, são endereços. Mandar para eles prejudica sua deliverabilidade para quem importa.

**Regra 5 — Oferta ajustada**
Para reativar, considere: acesso trial, bônus adicional, parcelamento diferente, ou versão simplificada do produto. Mas nunca desconto simples — devalua a oferta para todos.

## SOBRE AÇÕES DO SISTEMA
Para segmentos "passive_looker" com > 30% da base: emita ação SWITCH_SEGMENT (suprimir da sequência principal)
Para leads hot recém-reativados: emita ação FIRE_SEQUENCE (sequência de abertura imediata)

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "coldAudienceSize": "string — estimativa de tamanho da audiência fria",
  "reengagementGoal": "string — taxa de reativação realista e base de cálculo",
  "universalInsight": "string — por que a maioria dos win-back campaigns falha para este avatar",
  "segments": [
    {
      "segment": "price_hesitation|busy_forgotten|not_convinced|competitor_went|timing_wrong|passive_looker",
      "size": "string — % estimado da base fria",
      "diagnosis": "string — por que foram embora",
      "reengagementAngle": "string — o ângulo específico para reativar",
      "sequence": [
        {
          "day": 0,
          "channel": "email|whatsapp|sms",
          "subject": "string — se email",
          "body": "string — corpo completo da mensagem",
          "objective": "string — o que esta mensagem deve provocar"
        }
      ]
    }
  ],
  "winBackSequence": {
    "emailSubjects": ["string — subject D+0", "string — subject D+3", "string — subject D+7"],
    "whatsappMessages": ["string — mensagem D+1", "string — mensagem D+5"],
    "smsMessages": ["string — SMS opcional"]
  },
  "newAngle": "string — ângulo completamente novo (diferente do que foi usado no lançamento original)",
  "contentStrategy": "string — que conteúdo enviar antes da oferta para re-aquecer",
  "offerAdjustment": "string — deve a oferta ser diferente para frios? (sem desconto simples)",
  "suppressionCriteria": "string — critérios específicos para suprimir leads sem retorno",
  "actions": [
    {
      "type": "FIRE_SEQUENCE|SWITCH_SEGMENT|SEND_NOTIFICATION",
      "confidence": 0.0,
      "urgency": "immediate|next_12h|next_24h|next_week",
      "rationale": "string",
      "params": {},
      "requiresApproval": false,
      "estimatedImpact": "string"
    }
  ]
}
\`\`\``;

export async function runReengagementAgent(
  campaignId: string | null,
  workspaceId: string,
  coldLeadCount: number,
  productDescription: string,
  avatarDescription: string,
  daysSinceLastContact: number,
  previousConversionRate: number,
  log: Logger,
): Promise<ReengagementOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "reengagement",
    systemPrompt: REENGAGEMENT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Desenvolva a estratégia completa de reativação desta audiência fria.

**Leads frios:** ${coldLeadCount}
**Produto:** ${productDescription}
**Avatar:** ${avatarDescription}
**Dias desde último contato:** ${daysSinceLastContact}
**Taxa de conversão anterior:** ${(previousConversionRate * 100).toFixed(1)}%

**PROCESSO:**
1. Segmente a audiência fria por provável razão de frieza
2. Para cada segmento, defina o ângulo de reativação específico
3. Escreva a sequência completa de win-back (email + WhatsApp)
4. Defina critérios de supressão (quem não vale reativar)
5. Crie o novo ângulo de posicionamento do produto para frios
6. Emita ações de sistema necessárias

Seja específico — sem copy genérico de "sentimos sua falta".
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Diagnosticando razões de frieza por segmento...",
      "Desenvolvendo ângulos específicos por segmento...",
      "Escrevendo sequências de win-back...",
      "Definindo critérios de supressão inteligente...",
      "Gerando ações de sistema...",
    ],
  });

  return parseAgentJSON<ReengagementOutput>(result.content, {
    coldAudienceSize: String(coldLeadCount),
    reengagementGoal: "10-15% de reativação",
    universalInsight: "",
    segments: [],
    winBackSequence: { emailSubjects: [], whatsappMessages: [], smsMessages: [] },
    newAngle: "",
    contentStrategy: "",
    offerAdjustment: "",
    suppressionCriteria: "",
    actions: [],
  });
}
