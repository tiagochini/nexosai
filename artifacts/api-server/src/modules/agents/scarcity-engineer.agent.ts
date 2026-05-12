/**
 * Scarcity Engineer Agent
 * Designs authentic, believable scarcity and urgency mechanisms.
 * Prevents fake scarcity that destroys trust. Builds real psychological pressure.
 * Provider: Claude (reasoning, ethics, psychology)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface ScarcityMechanism {
  type: "deadline" | "quantity" | "access" | "bonus" | "price" | "cohort" | "exclusivity";
  name: string;           // branded name for the mechanism
  description: string;    // how it works
  isAuthentic: boolean;   // is this mechanism real (vs manufactured)
  authenticityProof: string; // how to prove it's real to skeptical prospects
  copyBlock: string;      // exact copy to use
  timing: string;         // when in the funnel to deploy
  intensity: "subtle" | "moderate" | "high" | "extreme";
  warningIfFake: string;  // what happens to trust if this is used inauthentically
}

export interface ScarcityPsychology {
  dominantTrigger: "loss_aversion" | "fomo" | "exclusivity" | "deadline_pressure" | "social_proof";
  avatarSensitivity: "low" | "medium" | "high"; // how sensitive this audience is to urgency
  optimalClosingSequence: string;  // the exact flow of the last 48 hours
  escalationCurve: string;         // how to ramp urgency without burning trust
}

export interface ScarcityEngineOutput {
  product: string;
  launchType: string;
  mechanisms: ScarcityMechanism[];
  psychology: ScarcityPsychology;
  copyFramework: {
    hourBefore: string; // copy for 1 hour before close
    dayBefore: string;  // copy for 24h before
    lastDay: string;    // copy for the final day sequence
    cartClose: string;  // the cart-close message
    postClose: string;  // what to send after close (builds anticipation for next time)
  };
  antiPatterns: string[];  // scarcity mistakes that destroy trust in this market
  authenticationStrategy: string; // how to make scarcity undeniable and believable
}

const SCARCITY_ENGINEER_PROMPT = `Você é o Agente Scarcity Engineer do NexOS AI — especialista em criar urgência e escassez autêntica que converte sem destruir a credibilidade do criador.

Sua filosofia: **escassez falsa é pior que nenhuma escassez.** Uma vez que o avatar detecta manipulação, a confiança nunca se recupera completamente. Sua missão é criar mecanismos de urgência REAIS — ou transformar restrições reais em mecanismos de urgência poderosos.

## PRINCÍPIOS DO SCARCITY ENGINEER

### AUTENTICIDADE PRIMEIRO
Escassez funciona quando é real. O mercado brasileiro está em nível avançado de sofisticação — já viu "últimas vagas" que reabrecem, "preços especiais" que não acabam, "bônus exclusivos" que aparecem em todo lançamento. A resposta emocional ao cinismo é imunidade à urgência.

**Mecanismos de escassez AUTÊNTICA:**
- Vagas limitadas pela capacidade real de entrega (mentoria, turma fechada, suporte)
- Preço de lançamento real (sobe depois do lançamento — mas sobe de verdade)
- Bônus exclusivos de lançamento (remove-se depois, para sempre)
- Janela de acesso à comunidade (coorte fecha, próxima turma é daqui 6 meses)
- Bonificação de velocidade real (primeiras X vagas recebem bônus adicional)
- Deadline de evento real (live, turma, início do programa)

**Mecanismos que destroem credibilidade:**
- Contadores que reiniciam
- "Últimas vagas" que nunca acabam
- Preços "exclusivos" que repetem em todo lançamento
- Bônus "removidos" que voltam no próximo lançamento

### PSICOLOGIA DA URGÊNCIA EFETIVA

A urgência funciona em camadas:
1. **Urgência racional** — entendo por que preciso agir agora
2. **Urgência emocional** — sinto o custo de não agir
3. **Urgência social** — vejo que outros estão agindo

As três precisam estar presentes no fechamento. Só urgência racional ("o preço sobe") é fraca. Só urgência emocional é manipulação. A combinação das três é ética e poderosa.

### CURVA DE ESCALONAMENTO
A intensidade da urgência deve escalar de forma crível:
- D-7 a D-3: urgência leve (menção de prazo)
- D-2: urgência moderada (o que você perde ao não agir)
- D-1: urgência alta (prova de que outros estão agindo)
- D-0 manhã: urgência extrema (últimas horas, não há mais amanhã)
- D-0 tarde: final (o carrinho fecha em X horas)

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "product": "string",
  "launchType": "string",
  "mechanisms": [
    {
      "type": "deadline|quantity|access|bonus|price|cohort|exclusivity",
      "name": "string — nome do mecanismo (ex: 'Preço de Fundador')",
      "description": "string — como funciona exatamente",
      "isAuthentic": true,
      "authenticityProof": "string — como provar que é real",
      "copyBlock": "string — copy completo, pronto para usar",
      "timing": "string — quando usar (ex: 'últimas 48h', 'abertura de carrinho')",
      "intensity": "subtle|moderate|high|extreme",
      "warningIfFake": "string — o que acontece à credibilidade se for usado falsamente"
    }
  ],
  "psychology": {
    "dominantTrigger": "loss_aversion|fomo|exclusivity|deadline_pressure|social_proof",
    "avatarSensitivity": "low|medium|high",
    "optimalClosingSequence": "string — fluxo exato das últimas 48 horas",
    "escalationCurve": "string — como escalonar urgência sem queimar confiança"
  },
  "copyFramework": {
    "hourBefore": "string — copy para 1h antes do fechamento",
    "dayBefore": "string — copy para 24h antes",
    "lastDay": "string — copy para o dia final completo",
    "cartClose": "string — mensagem de fechamento do carrinho",
    "postClose": "string — o que enviar depois do fechamento"
  },
  "antiPatterns": ["string — erros de scarcity que destroem credibilidade neste mercado"],
  "authenticationStrategy": "string — como tornar a escassez irrefutável e impossível de questionar"
}
\`\`\``;

export async function runScarcityEngineerAgent(
  campaignId: string | null,
  workspaceId: string,
  productDescription: string,
  launchType: string,
  offerDetails: string,
  avatarDescription: string,
  log: Logger,
): Promise<ScarcityEngineOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "scarcity_engineer",
    systemPrompt: SCARCITY_ENGINEER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Projete o sistema completo de urgência e escassez autêntica para este lançamento.

**Produto:** ${productDescription}
**Tipo de lançamento:** ${launchType}
**Detalhes da oferta:** ${offerDetails}
**Avatar:** ${avatarDescription}

**PROCESSO:**
1. Identifique QUAIS mecanismos de escassez são AUTENTICAMENTE possíveis (dado o produto/formato)
2. Para cada mecanismo, verifique se é realmente sustentável e crível
3. Projete a curva de escalonamento de urgência (D-7 até D-0)
4. Escreva o copy de fechamento para cada fase
5. Identifique o que NÃO fazer para este avatar específico

Priorize autenticidade. Escassez falsa destruída é pior que nenhuma escassez.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando mecanismos de escassez autenticamente possíveis...",
      "Verificando credibilidade de cada mecanismo...",
      "Projetando curva de escalonamento de urgência...",
      "Escrevendo copy de fechamento por fase...",
      "Identificando anti-padrões para este avatar...",
    ],
  });

  return parseAgentJSON<ScarcityEngineOutput>(result.content, {
    product: productDescription,
    launchType,
    mechanisms: [],
    psychology: {
      dominantTrigger: "loss_aversion",
      avatarSensitivity: "medium",
      optimalClosingSequence: "",
      escalationCurve: "",
    },
    copyFramework: {
      hourBefore: "",
      dayBefore: "",
      lastDay: "",
      cartClose: "",
      postClose: "",
    },
    antiPatterns: [],
    authenticationStrategy: "",
  });
}
