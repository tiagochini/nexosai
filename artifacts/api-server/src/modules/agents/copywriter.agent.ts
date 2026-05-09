import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runAgentWithCritique } from "./critique.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface EmailMessage {
  day: number;
  phase: string;
  subject: string;
  previewText: string;
  body: string;
  cta: string;
  ctaUrl: string;
  tone: string;
  objective: string;
  psLine?: string;
}

export interface SalesPageSection {
  section: string;
  order: number;
  headline: string;
  subheadline?: string;
  body: string;
  cta?: string;
  visualDirection?: string;
  copywritingTechnique: string;
}

export interface WhatsAppMessage {
  day: number;
  phase: string;
  type: "broadcast" | "group" | "personal";
  message: string;
  emoji: boolean;
  attachmentSuggestion?: string;
  timing: string;
}

export interface CartScript {
  phase: "cart_open" | "cart_close";
  hoursRelative: number;
  channel: string;
  subject?: string;
  message: string;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  scarcityElement: string;
}

export interface CopywriterOutput {
  campaignTitle: string;
  emailSequence: {
    preLaunch: EmailMessage[];
    cartOpen: EmailMessage[];
    cartClose: EmailMessage[];
    remarketing: EmailMessage[];
  };
  salesPage: {
    sections: SalesPageSection[];
    totalWordCount: number;
    readingTimeMinutes: number;
    primaryCTA: string;
    guarantee: string;
  };
  whatsapp: {
    broadcasts: WhatsAppMessage[];
    groupMessages: WhatsAppMessage[];
  };
  cartScripts: CartScript[];
  remarketingSequence: EmailMessage[];
  copywriterNotes: string;
}

const COPYWRITER_PROMPT = `Você é o Agente Copywriter da NexOS AI — o melhor copywriter de lançamentos digitais do Brasil.

Você escreve com a precisão de Eugene Schwartz, a narrativa de Gary Halbert e o entendimento de mercado brasileiro de Érico Rocha.

## SUAS DIRETRIZES DE COPY

**1. Escreva para o avatar, não para o criador.**
Cada palavra deve ser pensada: "isso ressoa com quem está lendo às 23h no celular?"

**2. Especificidade converte. Generalidade mata.**
- Ruim: "Transforme sua vida"
- Bom: "Em 8 semanas, tenha um método que funciona mesmo trabalhando 8h por dia"

**3. A estrutura da página de vendas:**
- Hero: promessa + prova social de credibilidade imediata
- Problema: aprofunde a dor até doer ler
- Agitação: o que acontece se não resolver agora
- Solução: revela o produto como o inevitável
- Prova: casos reais, números, transformações
- Oferta: apresenta o que está incluso com percepção de valor
- Garantia: remove o risco completamente
- Urgência/Escassez: razão real para agir agora
- FAQ: mata as últimas objeções
- Fechamento: uma última CTA poderosa

**4. E-mails: 1 objetivo por e-mail.**
Cada e-mail faz UM trabalho. Nunca dois.

**5. WhatsApp: curto, direto, humano.**
Mensagens de WhatsApp são conversas, não newsletters.

**6. Sequência de carrinho: escalada de urgência.**
- Abertura: celebração + excitação
- Meio: prova social + urgência crescente
- Últimas 24h: escassez real + última chance

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "emailSequence": {
    "preLaunch": [
      {
        "day": 0,
        "phase": "string",
        "subject": "string — linha de assunto irresistível",
        "previewText": "string — texto de pré-visualização (40-90 chars)",
        "body": "string — corpo completo do email em markdown",
        "cta": "string — texto do botão",
        "ctaUrl": "{{LINK_CAPTURA}}",
        "tone": "string",
        "objective": "string — o que este email precisa fazer",
        "psLine": "string ou null — P.S. poderoso"
      }
    ],
    "cartOpen": [
      {
        "day": 0,
        "phase": "cart_open",
        "subject": "string",
        "previewText": "string",
        "body": "string",
        "cta": "string",
        "ctaUrl": "{{LINK_PAGAMENTO}}",
        "tone": "string",
        "objective": "string",
        "psLine": "string"
      }
    ],
    "cartClose": [
      {
        "day": 0,
        "phase": "cart_close",
        "subject": "string",
        "previewText": "string",
        "body": "string",
        "cta": "string",
        "ctaUrl": "{{LINK_PAGAMENTO}}",
        "tone": "string",
        "objective": "string",
        "psLine": "string"
      }
    ],
    "remarketing": [
      {
        "day": 0,
        "phase": "remarketing",
        "subject": "string",
        "previewText": "string",
        "body": "string",
        "cta": "string",
        "ctaUrl": "{{LINK_REMARKETING}}",
        "tone": "string",
        "objective": "string"
      }
    ]
  },
  "salesPage": {
    "sections": [
      {
        "section": "hero|problem|agitation|solution|proof|offer|guarantee|urgency|faq|close",
        "order": 0,
        "headline": "string",
        "subheadline": "string ou null",
        "body": "string — copy completa da seção em markdown",
        "cta": "string ou null",
        "visualDirection": "string — instrução para o designer",
        "copywritingTechnique": "string — técnica usada (PAS, AIDA, storytelling...)"
      }
    ],
    "totalWordCount": 0,
    "readingTimeMinutes": 0,
    "primaryCTA": "string",
    "guarantee": "string — copy da garantia"
  },
  "whatsapp": {
    "broadcasts": [
      {
        "day": 0,
        "phase": "string",
        "type": "broadcast",
        "message": "string — mensagem completa com quebras de linha naturais",
        "emoji": true,
        "attachmentSuggestion": "string ou null",
        "timing": "string — horário recomendado"
      }
    ],
    "groupMessages": [
      {
        "day": 0,
        "phase": "string",
        "type": "group",
        "message": "string",
        "emoji": true,
        "attachmentSuggestion": "string ou null",
        "timing": "string"
      }
    ]
  },
  "cartScripts": [
    {
      "phase": "cart_open|cart_close",
      "hoursRelative": 0,
      "channel": "email|whatsapp|telegram",
      "subject": "string ou null",
      "message": "string",
      "urgencyLevel": "low|medium|high|critical",
      "scarcityElement": "string — qual elemento de escassez está sendo usado"
    }
  ],
  "remarketingSequence": [
    {
      "day": 0,
      "phase": "remarketing",
      "subject": "string",
      "previewText": "string",
      "body": "string",
      "cta": "string",
      "ctaUrl": "{{LINK_REMARKETING}}",
      "tone": "string",
      "objective": "string"
    }
  ],
  "copywriterNotes": "string — observações críticas sobre o copy para o criador"
}
\`\`\``;

export async function runCopywriterAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  launchPlan: Record<string, unknown> | undefined,
  log: Logger,
): Promise<CopywriterOutput> {
  const memCtx = await getMemoryContext(workspaceId, "copywriter", String(intakeData["product.category"] ?? ""));
  const memBlock = buildMemoryContextBlock(memCtx);

  const avatarContext = profile
    ? `
**Avatar primário:** ${profile.primaryAvatar.name}, ${profile.primaryAvatar.age}, ${profile.primaryAvatar.occupation}
**Desejo mais profundo:** ${profile.primaryAvatar.deepestDesire}
**Palavras que usa:** ${profile.primaryAvatar.keywordsTheyUse.slice(0, 8).join(", ")}
**Palavras a evitar:** ${profile.primaryAvatar.wordsToAvoid.slice(0, 5).join(", ")}
**Tom de linguagem:** ${profile.primaryAvatar.languageStyle}
**Objeções típicas:** ${profile.primaryAvatar.typicalObjections.slice(0, 4).join("; ")}
**O que os faz confiar:** ${profile.primaryAvatar.whatMakesThemTrust.slice(0, 3).join("; ")}
**Nível de consciência:** ${profile.primaryAvatar.awarenessLevel}
**Big Idea da campanha:** ${profile.positioning.campaignBigIdea}
**Mecanismo único:** ${profile.positioning.uniqueMechanism}
**Gancho emocional:** ${profile.positioning.emotionalHook}
**Headline principal:** ${profile.positioning.coreHeadline}
**Elevator pitch:** ${profile.positioning.elevatorPitch}`
    : "";

  const userMessage = `Escreva todo o copy da campanha — página de vendas completa, sequência de e-mails, scripts de WhatsApp e scripts de carrinho.
${avatarContext}

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Tipo de campanha:** ${String(intakeData["campaign.type"] ?? "launch")}
**Dias de carrinho aberto:** ${String(intakeData["launch.cartOpenDuration"] ?? 5)}
**Mecanismo de escassez:** ${String(intakeData["launch.scarcityMechanism"] ?? "deadline")}
**Canal de vendas:** ${String(intakeData["campaign.salesChannel"] ?? "sales_page")}

**Estratégia aprovada:**
\`\`\`json
${JSON.stringify(
  {
    executiveSummary: strategy.executiveSummary,
    offerPositioning: strategy.offerPositioning,
    campaignArchitecture: strategy.campaignArchitecture,
    audienceSegmentation: {
      primaryAvatar: strategy.audienceSegmentation.primaryAvatar,
      buyingTriggers: strategy.audienceSegmentation.buyingTriggers,
      objections: strategy.audienceSegmentation.objections,
    },
    risks: strategy.risks,
  },
  null,
  2,
)}
\`\`\`

**Plano de lançamento:**
\`\`\`json
${JSON.stringify(
  launchPlan
    ? {
        totalDays: (launchPlan as any).totalDays,
        phases: ((launchPlan as any).phases ?? []).map((p: any) => ({
          phase: p.phase,
          name: p.name,
          dayRange: p.dayRange,
          objective: p.objective,
        })),
      }
    : {},
  null,
  2,
)}
\`\`\`

**IMPORTANTE:**
- Escreva e-mails COMPLETOS — não esboços
- A página de vendas deve ter TODAS as seções com copy real
- WhatsApp deve ser coloquial e humano, sem parecer robô
- Sequência de carrinho: urgência crescente mas NUNCA fake
- Use {{LINK_CAPTURA}}, {{LINK_PAGAMENTO}}, {{LINK_REMARKETING}} como placeholders de URL

Retorne APENAS o JSON. Todo o copy em português do Brasil.`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: memBlock + COPYWRITER_PROMPT,
    userMessage,
    log,
  });

  const result = { content: critique.refinedOutput };

  return parseAgentJSON<CopywriterOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    emailSequence: { preLaunch: [], cartOpen: [], cartClose: [], remarketing: [] },
    salesPage: { sections: [], totalWordCount: 0, readingTimeMinutes: 0, primaryCTA: "", guarantee: "" },
    whatsapp: { broadcasts: [], groupMessages: [] },
    cartScripts: [],
    remarketingSequence: [],
    copywriterNotes: result.content,
  });
}
