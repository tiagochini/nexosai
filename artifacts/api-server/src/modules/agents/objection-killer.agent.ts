/**
 * Objection Killer Agent
 * Systematically maps every objection for a product/audience and generates specific
 * counter-arguments, kill strategies, and pre-emptive inoculation copy.
 * Provider: Claude (deep reasoning, empathy, sequential logic)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface ObjectionKill {
  objection: string;          // the exact objection, in the avatar's words
  category: "price" | "trust" | "time" | "skepticism" | "priority" | "fear" | "technical" | "social";
  frequency: "very_common" | "common" | "occasional" | "rare";
  underlyingFear: string;     // the real fear behind the surface objection
  killStrategy: "reframe" | "proof" | "story" | "contrast" | "pre_empt" | "reverse_question" | "agree_and_redirect";
  copyBlock: string;          // ready-to-use copy that kills this objection
  bestPlacement: string[];    // where in the funnel to use this kill
  inoculationLine: string;    // how to bring up this objection BEFORE the prospect does
}

export interface ObjectionMapOutput {
  product: string;
  avatar: string;
  sophisticationLevel: 1 | 2 | 3 | 4 | 5;
  dominantObjectionCategory: string;
  objections: ObjectionKill[];
  objectionPriority: string[]; // ranked by frequency × impact
  killSequence: string;        // the optimal order to address objections in the funnel
  prebuyerMindset: string;     // what is the avatar thinking right before they almost-buy
  universalKillPrinciple: string; // the single insight that addresses most objections at once
}

const OBJECTION_KILLER_PROMPT = `Você é o Agente Objection Killer do NexOS AI — o especialista mais avançado em eliminação sistemática de objeções do mercado digital brasileiro.

Você não trabalha com respostas genéricas de objeções. Você mapeia as objeções REAIS que esse avatar específico tem, identifica o medo subjacente real (que raramente é o que a objeção sugere) e gera copy cirúrgico que elimina cada objeção antes que ela seja dita.

## FRAMEWORK DE DESTRUIÇÃO DE OBJEÇÕES

### ETAPA 1 — MAPEAMENTO DE REALIDADE
As objeções não são o que parecem:
- "Não tenho dinheiro" → medo de tomar uma decisão errada novamente
- "Não tenho tempo" → prioridade: não acredita que vai funcionar logo de início
- "Vou pensar" → falta uma crença que ainda não foi implantada
- "Já tentei e não funcionou" → mecanismo errado, não falta de tentativa
- "Não sei se é para mim" → auto-sabotagem por medo do sucesso/mudança

### ETAPA 2 — TAXONOMIA DE KILLS

**REFRAME**: Muda a perspectiva de onde a objeção vive
- "Não é que você não tem dinheiro. É que você ainda não viu por que R$X é o preço mais barato do mercado para este resultado."

**PROOF**: Elimina ceticismo com evidência irrefutável
- Específico + verificável + identificável (avatar se vê no caso)

**STORY**: Usa narrativa de terceiro que tinha a mesma objeção
- O personagem deve ser idêntico ao avatar (mesma situação, mesma objeção)

**CONTRAST**: Compara o custo de não agir vs custo de agir
- O custo real da inação (tempo, dinheiro, oportunidade perdida)

**PRE_EMPT**: Levanta a objeção ANTES do prospect levantar
- "Você provavelmente está pensando: mas o que me garante que vai funcionar para mim?"
- Inoculação: você levanta e você mata. O prospect não pode mais usá-la.

**REVERSE_QUESTION**: Transforma a objeção em pergunta que o prospect precisa responder
- "Se eu pudesse mostrar que você recupera o investimento em X dias, ainda seria uma barreira?"

**AGREE_AND_REDIRECT**: Concorda com a objeção e redireciona
- "Você está certo — o tempo é um recurso escasso. Por isso precisamos falar sobre o custo de ficar onde você está."

### ETAPA 3 — INOCULAÇÃO (o mais poderoso)
Levante a objeção ANTES que o prospect a formule. Quando você nomeia a objeção primeiro, você:
1. Demonstra que entende o avatar (gera confiança)
2. Retira a objeção do arsenal do prospect (não pode mais usá-la)
3. Controla o frame de onde a objeção vive

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "product": "string",
  "avatar": "string",
  "sophisticationLevel": 1,
  "dominantObjectionCategory": "price|trust|time|skepticism|priority|fear|technical|social",
  "objections": [
    {
      "objection": "string — a objeção exata nas palavras do avatar",
      "category": "price|trust|time|skepticism|priority|fear|technical|social",
      "frequency": "very_common|common|occasional|rare",
      "underlyingFear": "string — o medo REAL por trás da objeção superficial",
      "killStrategy": "reframe|proof|story|contrast|pre_empt|reverse_question|agree_and_redirect",
      "copyBlock": "string — copy completo pronto para usar, 3-6 linhas",
      "bestPlacement": ["VSL", "email de objeção", "stories", "WhatsApp D+3"],
      "inoculationLine": "string — como trazer esta objeção ANTES que o prospect traga"
    }
  ],
  "objectionPriority": ["objeção mais bloqueadora", "segunda mais bloqueadora"],
  "killSequence": "string — ordem ótima para endereçar objeções no funil (qual fase mata qual objeção)",
  "prebuyerMindset": "string — o estado mental exato do avatar 10 minutos antes de não comprar",
  "universalKillPrinciple": "string — a única crença que, se instalada, elimina 80% das objeções de uma vez"
}
\`\`\``;

export async function runObjectionKillerAgent(
  campaignId: string | null,
  workspaceId: string,
  productDescription: string,
  avatarDescription: string,
  price: number,
  knownObjections: string[],
  log: Logger,
): Promise<ObjectionMapOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "objection_killer",
    systemPrompt: OBJECTION_KILLER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Mapeie e destrua todas as objeções para este produto.

**Produto:** ${productDescription}
**Preço:** R$${price}
**Avatar:** ${avatarDescription}
**Objeções já conhecidas (completar e aprofundar):** ${knownObjections.join("; ") || "nenhuma listada"}

**PROCESSO:**
1. Liste todas as objeções que este avatar tem (não só as óbvias)
2. Para cada uma, identifique o medo subjacente REAL
3. Escolha a estratégia de kill mais efetiva
4. Escreva o copy block completo, pronto para usar
5. Crie a linha de inoculação para cada objeção importante
6. Identifique a sequência ótima de kills no funil

Inclua pelo menos 8 objeções. Seja brutalmente específico — sem copy genérico.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Mapeando objeções reais do avatar...",
      "Identificando medos subjacentes por trás de cada objeção...",
      "Selecionando estratégias de kill por efetividade...",
      "Escrevendo copy blocks cirúrgicos...",
      "Montando sequência de inoculação no funil...",
    ],
  });

  return parseAgentJSON<ObjectionMapOutput>(result.content, {
    product: productDescription,
    avatar: avatarDescription,
    sophisticationLevel: 3,
    dominantObjectionCategory: "trust",
    objections: [],
    objectionPriority: [],
    killSequence: "",
    prebuyerMindset: "",
    universalKillPrinciple: "",
  });
}
