/**
 * Email Architect Agent
 * Designs complete multi-email sequences for every launch phase:
 * pre-launch nurture, cart open, urgency escalation, abandon recovery, post-purchase.
 * Provider: Claude (reasoning + structured sequence design)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface EmailInSequence {
  position: number;
  dayIndex: number;          // day relative to cart open (negative = pre-launch)
  phase: "pre_launch" | "cart_open" | "mid_cart" | "urgency" | "last_chance" | "abandon_recovery" | "post_purchase";
  subjectLine: string;
  previewText: string;       // the text after subject in inbox
  emotionalObjective: string; // what state should reader be in after reading
  primaryGatilho: string;    // the dominant psychological trigger
  bodyStructure: string;     // P1 [hook], P2 [body], P3 [CTA] — structure description
  bodyFull: string;          // complete email copy, ready to send
  ctaText: string;
  ctaUrl: string;            // placeholder URL
  sendTimeOptimal: string;   // best time to send (e.g., "terça 19h")
  openRateTarget: string;    // expected open rate benchmark
  notes: string;             // special instructions or variants to test
}

export interface EmailSequenceOutput {
  product: string;
  avatar: string;
  totalEmails: number;
  sequenceLogic: string;    // the narrative arc of the entire sequence
  subjectLinePhilosophy: string; // principles for this audience
  emails: EmailInSequence[];
  segmentVariants: {
    hot: string[];           // subject lines adjusted for hot leads
    cold: string[];          // subject lines adjusted for cold leads
  };
  winBackSequence: string;  // 2-email sequence to recover ghost subscribers
  deliverabilityTips: string[]; // SPF, DKIM, list hygiene tips for this volume
}

const EMAIL_ARCHITECT_PROMPT = `Você é o Agente Email Architect do NexOS AI — o maior especialista em sequências de email de lançamento do Brasil.

Você não escreve emails. Você arquiteta jornadas completas de email que mudam o estado emocional do lead progressivamente, do ceticismo frio até a compra decidida.

## ARQUITETURA DE SEQUÊNCIA DE EMAIL

### PRINCÍPIO 1 — PROGRESSÃO DE ESTADOS
Cada email tem um estado de entrada do lead e um estado de saída desejado. A sequência é uma cadeia de mudanças de estado:
- Pré-lançamento: Indiferente → Curioso → Acreditante → Antecipando
- Abertura: Antecipando → Desejando → Decidido
- Fechamento: Ainda-não-comprou → Medo de perder → Comprando

### PRINCÍPIO 2 — A REGRA DO SUBJECT LINE
O subject line não é para abrir o email — é para garantir que quando o lead estiver pronto para comprar, SEU email seja o que ele abrir.
- Especificidade > criatividade ("Quanto eu fiz no meu primeiro lançamento sem lista" > "Descubra o segredo")
- Curiosidade + benefício ("Por que 73% das pessoas falham no dia 3 — e como evitar")
- Pattern interrupt ("Desculpe o email de ontem")
- Pergunta que exige resposta interna ("Você está cometendo este erro?")

### PRINCÍPIO 3 — A ESTRUTURA QUE CONVERTE
Cada email começa com uma história de 3 linhas (gera empatia → cria tensão → resolve com produto). Nunca começa com "Olá [Nome], hoje quero falar sobre..."

Estrutura P.A.S.T.A:
- **P**roblema → nomeia a dor específica (não genérica)
- **A**gitação → torna a dor real e urgente
- **S**olução → apresenta o mecanismo como saída
- **T**estemunho → prova que funciona para alguém idêntico ao avatar
- **A**ção → CTA específico e único

### PRINCÍPIO 4 — REGRAS ANTI-SPAM
- Nenhum email sem CTA (mesmo que o CTA seja "leia isso") 
- Assunto e preview text devem funcionar juntos como uma unidade
- Máximo 1 link por email (exceto exceções pontuais)
- Sem imagens no corpo — texto puro converte mais
- Re-engajamento automático para não-abridores (subject line diferente, mesmo email)

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "product": "string",
  "avatar": "string",
  "totalEmails": 0,
  "sequenceLogic": "string — o arco narrativo completo: como os estados emocionais progridem email a email",
  "subjectLinePhilosophy": "string — princípios específicos para este avatar ao escrever subjects",
  "emails": [
    {
      "position": 1,
      "dayIndex": -14,
      "phase": "pre_launch|cart_open|mid_cart|urgency|last_chance|abandon_recovery|post_purchase",
      "subjectLine": "string — subject completo pronto para usar",
      "previewText": "string — texto de preview (40-80 chars)",
      "emotionalObjective": "string — estado emocional alvo após leitura",
      "primaryGatilho": "string — gatilho psicológico dominante",
      "bodyStructure": "string — P1: [descrição], P2: [descrição], CTA: [texto]",
      "bodyFull": "string — email completo, formatado, pronto para envio",
      "ctaText": "string",
      "ctaUrl": "{{LINK_DE_VENDAS}}",
      "sendTimeOptimal": "string",
      "openRateTarget": "string — ex: 35-45%",
      "notes": "string — variantes a testar ou contexto adicional"
    }
  ],
  "segmentVariants": {
    "hot": ["string — subject ajustado para leads quentes que já interagiram muito"],
    "cold": ["string — subject ajustado para leads frios que abriram pouco"]
  },
  "winBackSequence": "string — sequência de 2 emails para recuperar inativos antes do carrinho fechar",
  "deliverabilityTips": ["string — dicas de entregabilidade para este volume de envio"]
}
\`\`\``;

export async function runEmailArchitectAgent(
  campaignId: string | null,
  workspaceId: string,
  productDescription: string,
  avatarDescription: string,
  launchDurationDays: number,
  listSize: number,
  log: Logger,
): Promise<EmailSequenceOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "email_architect",
    systemPrompt: EMAIL_ARCHITECT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Arquitete a sequência completa de emails para este lançamento.

**Produto:** ${productDescription}
**Avatar:** ${avatarDescription}
**Duração do lançamento:** ${launchDurationDays} dias
**Tamanho da lista:** ${listSize} contatos

**PROCESSO:**
1. Defina o arco narrativo completo (como o estado emocional muda do início ao fim)
2. Mapeie os emails por fase (pré-lançamento, abertura, meio, urgência, fechamento)
3. Para cada email, escreva o body completo — não structure, texto real
4. Calibre subjects e previews para este avatar específico
5. Adicione variantes para segmentos hot/cold
6. Inclua sequência de win-back para não-abridores

Crie pelo menos 10 emails. Escreva os bodys completos — não sumários.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Arquitetando arco narrativo da sequência...",
      "Mapeando estados emocionais por fase...",
      "Escrevendo emails por fase do lançamento...",
      "Calibrando subjects e previews para o avatar...",
      "Adicionando variantes de segmentação...",
    ],
  });

  return parseAgentJSON<EmailSequenceOutput>(result.content, {
    product: productDescription,
    avatar: avatarDescription,
    totalEmails: 0,
    sequenceLogic: "",
    subjectLinePhilosophy: "",
    emails: [],
    segmentVariants: { hot: [], cold: [] },
    winBackSequence: "",
    deliverabilityTips: [],
  });
}
