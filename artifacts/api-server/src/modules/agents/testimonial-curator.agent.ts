/**
 * Testimonial Curator Agent
 * Designs the complete social proof strategy: what to collect, how to collect,
 * how to present, and when/where to deploy proof for maximum conversion impact.
 * Provider: Claude (empathy, strategy, psychology)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface TestimonialFormat {
  type: "video" | "text_screenshot" | "audio" | "case_study" | "live_call" | "data_proof" | "before_after";
  conversionPower: "low" | "medium" | "high" | "very_high";
  productionDifficulty: "easy" | "medium" | "hard";
  bestPlacement: string[];   // where to use this format
  collectionMethod: string;  // how to get this type of proof
  templateScript: string;    // script/prompt to get this proof from clients
}

export interface TestimonialStrategy {
  segment: string;           // who the testimonial is from
  angle: string;             // what aspect of the transformation they speak to
  objectionKilled: string;   // which prospect objection this kills
  recruitmentScript: string; // how to ask for this specific testimonial
  bestFormat: string;        // video/text/screenshot
  urgencyToCollect: "immediate" | "this_week" | "before_launch";
}

export interface SocialProofPlan {
  deploymentMap: {
    location: string;        // "VSL page - above fold", "cart page", "email D-3"
    proofType: string;
    specificFormat: string;
    objective: string;       // what belief this proof installs at this location
  }[];
  minimumProofRequired: {
    type: string;
    count: number;
    reason: string;
  }[];
}

export interface TestimonialCuratorOutput {
  product: string;
  proofGap: string;          // current proof weakness
  formats: TestimonialFormat[];
  strategies: TestimonialStrategy[];
  proofPlan: SocialProofPlan;
  collectionTimeline: {
    phase: string;
    action: string;
    deadline: string;
  }[];
  proofHierarchy: string;    // which proof type converts most for THIS avatar
  antiPatterns: string[];    // proof patterns that backfire for this market
  reciprocitySystem: string; // how to incentivize clients to give proof
  ugcStrategy: string;       // user-generated content strategy for organic proof
}

const TESTIMONIAL_CURATOR_PROMPT = `Você é o Agente Testimonial Curator do NexOS AI — especialista em estratégia de prova social para lançamentos digitais.

Sua filosofia: a prova social certa, no lugar certo, mata mais objeções do que qualquer copy. E a prova social errada (genérica, não identificável, não específica) é pior que não ter nenhuma.

## FRAMEWORK DE PROVA SOCIAL DE ALTA CONVERSÃO

### ETAPA 1 — O QUE FAZ PROVA SOCIAL FUNCIONAR
Prova social funciona quando o avatar pensa "essa pessoa era exatamente como eu — e funcionou".

**Elementos de identificação:**
- Mesma situação de partida ("eu também era iniciante / com pouco orçamento / com pouco tempo")
- Mesma objeção ("eu também achei que não era para mim")
- Resultado específico com número ("R$47.000 em 12 dias", não "fiz muito dinheiro")
- Resultado que o avatar acha possível para si mesmo (não resultado absurdo demais)

### ETAPA 2 — HIERARQUIA DE CREDIBILIDADE
Nem toda prova é igual. Em ordem de impacto:

1. **Caso de resultado com dado específico** (R$X em Y dias — verificável)
2. **Vídeo de transformação específica** (antes/depois no contexto do produto)
3. **Screenshot de mensagem privada** (parece espontâneo, não solicitado)
4. **Depoimento em vídeo com rosto + contexto** (identificabilidade máxima)
5. **Chamada ao vivo com cliente** (risco máximo, credibilidade máxima)
6. **Texto formal de depoimento** (menor poder de todos — cuidado com tom genérico)

### ETAPA 3 — MAPEAMENTO POR OBJEÇÃO
Cada prova deve matar uma objeção específica. Não colete prova genérica.

Mapeie as objeções principais → Para cada objeção, identifique qual cliente seu tem a mesma história → Colete prova específica da transformação dessa objeção.

### ETAPA 4 — ONDE COLOCAR A PROVA
A prova no lugar errado não funciona:
- **Acima do fold (VSL page)**: proof de resultado específico (número)
- **Antes da oferta (VSL)**: proof de transformação (antes/depois)
- **Na oferta**: proof de valor (o produto superou expectativas)
- **No checkout**: proof de segurança (processo de compra seguro, suporte real)
- **Email D-3**: proof de resultado de outro comprador que também estava indeciso
- **Stories**: proof espontâneo de cliente real (screenshot de DM, vídeo de aluno)

### ETAPA 5 — COMO COLETAR PROVA
A melhor prova parece espontânea — mas foi estrategicamente coletada.
- Pergunta certa → resultado certo: "O que exatamente mudou desde que você [usou o produto]?"
- Timing certo: a melhor prova vem no momento do primeiro resultado significativo
- Formato guiado: give them the script, but in their words

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "product": "string",
  "proofGap": "string — maior fraqueza atual de prova social",
  "formats": [
    {
      "type": "video|text_screenshot|audio|case_study|live_call|data_proof|before_after",
      "conversionPower": "low|medium|high|very_high",
      "productionDifficulty": "easy|medium|hard",
      "bestPlacement": ["string — onde usar"],
      "collectionMethod": "string — como obter",
      "templateScript": "string — script/prompt para solicitar este tipo de prova ao cliente"
    }
  ],
  "strategies": [
    {
      "segment": "string — de quem é o depoimento (avatar específico)",
      "angle": "string — aspecto da transformação",
      "objectionKilled": "string — qual objeção esta prova destrói",
      "recruitmentScript": "string — como pedir este depoimento específico",
      "bestFormat": "string",
      "urgencyToCollect": "immediate|this_week|before_launch"
    }
  ],
  "proofPlan": {
    "deploymentMap": [
      {
        "location": "string — onde no funil",
        "proofType": "string",
        "specificFormat": "string",
        "objective": "string — qual crença esta prova instala aqui"
      }
    ],
    "minimumProofRequired": [
      {
        "type": "string",
        "count": 0,
        "reason": "string — por que este mínimo é necessário"
      }
    ]
  },
  "collectionTimeline": [
    {
      "phase": "string",
      "action": "string",
      "deadline": "string"
    }
  ],
  "proofHierarchy": "string — qual tipo de prova converte mais para este avatar e por quê",
  "antiPatterns": ["string — prova social que prejudica credibilidade neste mercado"],
  "reciprocitySystem": "string — como incentivar clientes a dar depoimentos sem parecer comprar opinião",
  "ugcStrategy": "string — como gerar conteúdo espontâneo de clientes"
}
\`\`\``;

export async function runTestimonialCuratorAgent(
  campaignId: string | null,
  workspaceId: string,
  productDescription: string,
  avatarDescription: string,
  existingProof: string[],
  mainObjections: string[],
  log: Logger,
): Promise<TestimonialCuratorOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "testimonial_curator",
    systemPrompt: TESTIMONIAL_CURATOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Desenvolva a estratégia completa de prova social.

**Produto:** ${productDescription}
**Avatar:** ${avatarDescription}
**Prova atual:** ${existingProof.join("; ") || "nenhuma documentada"}
**Objeções principais:** ${mainObjections.join("; ")}

**PROCESSO:**
1. Identifique o maior gap de prova atual
2. Mapeie quais depoimentos são necessários por objeção
3. Para cada tipo de prova: como coletar, onde usar, script de solicitação
4. Crie o mapa de deployment de prova no funil (onde colocar cada prova)
5. Defina o sistema de coleta com timeline
6. Identifique anti-padrões específicos para este mercado

Seja específico sobre COMO obter cada tipo de prova e o script exato para pedir.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Mapeando gap de prova social atual...",
      "Alinhando depoimentos necessários por objeção...",
      "Projetando estratégias de coleta por tipo...",
      "Mapeando deployment de prova no funil...",
      "Criando timeline de coleta...",
    ],
  });

  return parseAgentJSON<TestimonialCuratorOutput>(result.content, {
    product: productDescription,
    proofGap: "",
    formats: [],
    strategies: [],
    proofPlan: { deploymentMap: [], minimumProofRequired: [] },
    collectionTimeline: [],
    proofHierarchy: "",
    antiPatterns: [],
    reciprocitySystem: "",
    ugcStrategy: "",
  });
}
