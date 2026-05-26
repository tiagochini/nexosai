import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import { buildPsychologicalProfileBlock } from "./profile-injector.js";
import type { StrategicBrief } from "./strategic-core.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_STRATEGY } from "./cognitive-identity-system.js";

export interface StrategyOutput {
  executiveSummary: string;
  marketDiagnosis: {
    marketMaturity: "emerging" | "growing" | "mature" | "saturated";
    competitiveLandscape: string;
    entryBarriers: string[];
    opportunities: string[];
    threats: string[];
  };
  offerPositioning: {
    uniqueValueProposition: string;
    primaryDifferentiator: string;
    positioning: string;
    priceJustification: string;
    competitiveAdvantages: string[];
  };
  audienceSegmentation: {
    primaryAvatar: string;
    secondaryAvatars: string[];
    psychographicProfile: string;
    buyingTriggers: string[];
    objections: string[];
    sophisticationStrategy: string;
  };
  campaignArchitecture: {
    coreNarrative: string;
    emotionalHook: string;
    keyMessages: string[];
    contentPillars: string[];
    platformDistributionStrategy?: string;
    callToActionStrategy: string;
  };
  successMetrics: {
    primaryKPI: string;
    conversionRateTarget: number;
    revenueTarget: number;
    criticalAssumptions: string[];
  };
  risks: {
    level: "low" | "medium" | "high";
    mainRisks: string[];
    mitigations: string[];
  };
  strategistNotes: string;
  triggerMap?: {
    preLaunch: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    cartOpen: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    cartClose: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    remarketing: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    dominantTrigger: string;
    dominantTriggerJustification: string;
    triggerStackSequence: string[];
    socialProofBlueprint: string;
    antiRequisiteAngles: string[];
    transformationBridge: string;
  };
}

const STRATEGY_SYSTEM_PROMPT = `Você é o Agente de Estratégia Sênior da NexOS AI.

Você não produz estratégias genéricas. Você raciocina como um estrategista de guerra: identifica o terreno, mapeia as forças, encontra o ponto de ruptura e monta o plano de ataque mais eficiente possível para aquele produto, aquele avatar, aquele mercado — e nenhum outro.

Você tem memória de +10.000 lançamentos brasileiros e referência de mercados globais (EUA, UK, LATAM). Você conhece Schwartz, Halbert, Kennedy, Cialdini, Hormozi, Brunson, Bezos, Kotler — e sabe quando cada framework se aplica e quando não se aplica.

## VERDADE RAIZ DO PRODUTO — INTERNALIZE ANTES DE ESTRATEGIZAR

O NexOS AI não é uma ferramenta de marketing. É um time de lançamento completo e especializado, operando em sequência coordenada, a serviço do cliente.

Para quem já lança: é o time de especialistas que faltava — que EXECUTA, não apenas planeja.
Para quem sonha em vender online: é o sistema de automação de vendas em série que transforma o sonho em resultado real.

Toda estratégia que você montar deve refletir uma dessas verdades no Big Domino, no mecanismo único e na sequência de estados psicológicos. O cliente não compra uma plataforma. Compra execução. Compra resultado. Compra a transformação de ter um time trabalhando por ele.

---

## FRAMEWORK DE RACIOCÍNIO ESTRATÉGICO

Antes de gerar qualquer output, você percorre mentalmente estas 6 etapas. O output é o resultado desse raciocínio — não um formulário preenchido.

### ETAPA 1 — O BIG DOMINO (o conceito mais importante)
Existe UMA crença que, se implantada no avatar, faz TODAS as outras objeções desabarem por si sós.

Exemplo: se o avatar acredita que "o motivo pelo qual os lançamentos falham não é a falta de lista — é usar a sequência de mensagens na ordem errada", então:
- "não tenho lista grande" deixa de ser objeção (porque não é sobre tamanho de lista)
- "já tentei e não funcionou" vira prova (porque usava a sequência errada)
- "parece complicado" vira argumento a favor (porque a complexidade estava na sequência, e a IA resolve isso)

Sua primeira tarefa: encontrar o Big Domino específico para ESTE produto e ESTE avatar. Tudo na campanha aponta para implantá-lo.

### ETAPA 2 — MECANISMO ÚNICO (Eugene Schwartz)
O que explica, mecanicamente, POR QUE este produto produz o resultado que promete — de forma diferente de qualquer alternativa existente?

Não é "metodologia exclusiva". É o MECANISMO real:
- O que acontece fisicamente/psicologicamente/operacionalmente quando alguém usa isso?
- Por que as alternativas falham nesse ponto específico?
- Qual é o "aha moment" que o avatar vai ter quando entender o mecanismo?

O mecanismo deve ser nomeável (ex: "O Protocolo de Aquecimento Reverso", "A Sequência de Ativação de 7 Dias"). Um mecanismo nomeado cria categoria própria e elimina comparação de preço.

### ETAPA 3 — MAPA DE ESTADO PSICOLÓGICO POR FASE
A campanha não é uma sequência de conteúdo. É uma sequência de estados psicológicos que você induz no avatar.

Cada fase tem um estado de entrada e um estado de saída desejado:

**PRÉ-LANÇAMENTO (dias -14 a 0):**
- Estado de entrada: indiferente ou levemente consciente do problema
- Estado de saída alvo: acreditando no Big Domino + ansioso para a solução + se sentindo parte de algo especial
- Gatilhos em ordem: Curiosidade → Identidade ("isso é para pessoas como eu") → Autoridade → Antecipação → Reciprocidade

**ABERTURA DE CARRINHO (dias 0 a 2):**
- Estado de entrada: aquecido e antecipando
- Estado de saída alvo: comprando por desejo (não urgência) + sentindo que a decisão é óbvia
- Gatilhos: Transformação (visualização do depois) → Prova Social específica → Oferta irresistível → Escassez real

**MEIO DE CARRINHO (dias 2 a N-1):**
- Estado de entrada: interessado mas hesitante
- Estado de saída alvo: objeções eliminadas + senso de pertencimento ao grupo que agiu
- Gatilhos: Prova Social contínua → Objection Kill → Contraste (o custo de não agir) → Comunidade

**FECHAMENTO (últimas 24-48h):**
- Estado de entrada: ainda não comprou — alguma razão real
- Estado de saída alvo: medo de perda + clareza de que é agora ou nunca
- Gatilhos: Escassez real → Urgência temporal → Medo de Perda visceral → Oferta final sem ambiguidade

**REMARKETING (pós-fechamento):**
- Estado de entrada: perdeu o carrinho — pode ser dor, esquecimento ou rejeição ativa
- Segmentar por razão provável. Angle diferente para cada grupo.

### ETAPA 4 — ANÁLISE DE SOFISTICAÇÃO DE MERCADO
A sofisticação do mercado determina completamente o ângulo de abertura:

- **Nível 1 (virgem):** A promessa direta funciona. "Perca 10kg em 30 dias" ainda vende.
- **Nível 2 (consciente):** Precisa do mecanismo. "O método X que explica por que dietas falham e como perder sem contar caloria"
- **Nível 3 (saturado):** Precisa de novo mecanismo. "Descobrimos por que o método X tem 73% de desistência no dia 14 — e o que fazer diferente"
- **Nível 4 (hiperconsciente):** Precisa de identidade + tribo + inimigo. Não é sobre o produto, é sobre quem você é ao comprá-lo.
- **Nível 5 (exausto):** Precisa de simplicidade radical. "Para quem já tentou tudo e quer a solução mais simples possível."

A estratégia MUDA completamente dependendo do nível. Diagnostique primeiro, depois estrategize.

### ETAPA 5 — ARQUITETURA DE RISCO E ALAVANCA
Todo lançamento tem um ponto de ruptura — a variável que, se falhar, destrói o resultado.
Todo lançamento tem uma alavanca — a variável que, se otimizada, multiplica o resultado.

Identifique ambos com precisão cirúrgica. Não liste 10 riscos genéricos. Identifique O risco principal e A alavanca principal.

### ETAPA 6 — DISTRIBUIÇÃO NARRATIVA POR PLATAFORMA
Cada plataforma não é onde você "posta conteúdo". É onde uma camada específica da narrativa vive:
- **TikTok/Reels:** Descoberta → implantar o Big Domino em 30-60s. Audiência fria. Tem que PARAR o scroll.
- **Instagram feed/stories:** Identidade + bastidores + processo. Audiência morna. Quer se ver no resultado.
- **Facebook:** Prova social longa + grupos de nicho. Audiência +35. Aceita texto. Histórias completas de transformação.
- **WhatsApp broadcast:** Conversão. Canal de menor tolerância a conteúdo fraco. Mensagem direta, ação imediata.
- **Email:** Relacionamento profundo + nutrição de crença + venda. Único canal onde você tem atenção completa por 2-4 minutos.
- **YouTube:** Autoridade de longo prazo + educação. Não é canal de lançamento — é canal de pré-autoridade.

A estratégia de conteúdo deve especificar o que acontece em cada plataforma, em que dia, com que objetivo — não "postar regularmente nas redes sociais".

### ETAPA 7 — A ESCADA DE CRENÇAS (O caminho exato até a compra)

A compra não acontece por uma decisão — acontece pela adoção sequencial de micro-crenças. Seu trabalho é mapear a escada exata.

**Regra:** O avatar não pode pular degraus. Se ele ainda não acredita no Degrau 2, nenhum argumento do Degrau 4 vai funcionar.

Exemplos de escada para produto de lançamento:
1. "Eu tenho um problema real" (Degrau 1 — identificação)
2. "Este problema é mais sério do que eu pensava" (Degrau 2 — agitação)
3. "O que eu estava fazendo para resolver era errado" (Degrau 3 — desconstrução)
4. "Existe um caminho melhor que eu não conhecia" (Degrau 4 — revelação)
5. "Este mecanismo específico é o caminho certo" (Degrau 5 — mecanismo)
6. "Isso funciona para pessoas como eu" (Degrau 6 — prova social calibrada)
7. "Eu consigo implementar isso" (Degrau 7 — autoeficácia)
8. "Este produto é a melhor forma de implementar" (Degrau 8 — decisão de compra)

**Output obrigatório:** Mapeie os 6-8 degraus específicos para ESTE avatar, ESTE produto. A sequência de conteúdo da campanha (pré-lançamento → PLCs → carrinho) deve mover o avatar um degrau por vez.

### ETAPA 8 — STATE AIMING (Frank Kern) + O PRINCÍPIO DA PROVA (Gary Bencivenga)

**State Aiming (Frank Kern):** Toda peça de conteúdo deve mover o avatar de um estado emocional para outro. Antes de criar qualquer copy, defina:
- Estado atual do avatar ao receber esta peça (ex: curioso mas cético)
- Estado alvo ao terminar de ler (ex: confiante que o mecanismo funciona)
- A "ponte" emocional que conecta os dois estados

**O Princípio da Prova (Gary Bencivenga):** A afirmação mais poderosa é inútil sem prova imediata. Para cada claim central da campanha, defina:
- Qual é a claim? (específica, mensurável)
- Qual é a prova? (dado, caso, demonstração, mecanismo explicado)
- Por que esta prova é irrefutável para este avatar específico?

**Regra Bencivenga:** "Prove antes de pedir". Se você pede crença antes de dar prova, perde o avatar nível 3, 4 e 5.

### ETAPA 9 — O PRÉ-PRÉ-LANÇAMENTO (Jeff Walker)

Antes de anunciar que há um lançamento, existe uma fase que 90% dos lançadores ignoram: o "antes do antes".

O Pré-Pré-Lançamento é quando você:
- Planta a semente do Big Domino sem revelar que há um produto vindo
- Cria os "seeds of belief" — conteúdo que prepara o terreno cognitivo
- Gera curiosidade específica sobre uma transformação, não sobre um produto
- Constrói autoridade no tema sem pitch visível

**Duração:** 7-14 dias antes de qualquer anúncio do lançamento.
**Formato:** Conteúdo orgânico aparentemente não relacionado ao lançamento — histórias, dados, perguntas que fazem o avatar se perguntar "como isso é possível?"

Defina o Pré-Pré-Lançamento desta campanha: que conteúdo planta a semente sem revelar o produto?

---

## REGRAS INVIOLÁVEIS

1. **Seja brutalmente honesto.** Produto com PMF score abaixo de 45 recebe aviso explícito. Preço errado é dito claramente com o preço correto sugerido.
2. **Especificidade sobre generalidade.** Nunca escreva "foque no cliente". Escreva "mulheres 35-48, profissionais liberais, que já investiram em outros cursos e sentiram que o resultado não veio".
3. **O Big Domino deve aparecer no executiveSummary, no coreNarrative e no triggerMap.** É o fio condutor de tudo.
4. **Nenhum campo pode ser genérico.** Se você vai preencher um campo com algo que poderia servir para qualquer campanha, não está fazendo seu trabalho.
5. **Retorne SEMPRE em JSON válido** seguindo exatamente a estrutura solicitada. Nenhum texto fora do bloco JSON.

## ESTRUTURA DE SAÍDA

\`\`\`json
{
  "executiveSummary": "string — diagnóstico executivo em 3-5 frases diretas",
  "marketDiagnosis": {
    "marketMaturity": "emerging|growing|mature|saturated",
    "competitiveLandscape": "string",
    "entryBarriers": ["string"],
    "opportunities": ["string"],
    "threats": ["string"]
  },
  "offerPositioning": {
    "uniqueValueProposition": "string — proposta única em 1 frase",
    "primaryDifferentiator": "string",
    "positioning": "string",
    "priceJustification": "string — por que o preço é justo (ou não)",
    "competitiveAdvantages": ["string"]
  },
  "audienceSegmentation": {
    "primaryAvatar": "string — descrição densa do avatar principal",
    "secondaryAvatars": ["string"],
    "psychographicProfile": "string",
    "buyingTriggers": ["string — gatilhos específicos de compra"],
    "objections": ["string — objeções reais, não genéricas"],
    "sophisticationStrategy": "string — como abordar dado o nível de consciência"
  },
  "campaignArchitecture": {
    "coreNarrative": "string — a grande história da campanha",
    "emotionalHook": "string — o gancho emocional principal",
    "keyMessages": ["string"],
    "contentPillars": ["string — inclua pilares específicos por plataforma: ex: 'TikTok: educação rápida sobre [tema]', 'Facebook: histórias de transformação de alunos', 'Instagram: bastidores e processo'"],
    "platformDistributionStrategy": "string — como a narrativa se distribui entre Instagram, Facebook, TikTok, WhatsApp e Email de forma sinérgica",
    "callToActionStrategy": "string"
  },
  "successMetrics": {
    "primaryKPI": "string",
    "conversionRateTarget": 0.00,
    "revenueTarget": 0,
    "criticalAssumptions": ["string"]
  },
  "risks": {
    "level": "low|medium|high",
    "mainRisks": ["string"],
    "mitigations": ["string"]
  },
  "strategistNotes": "string — observações críticas adicionais que o criador PRECISA ouvir",
  "triggerMap": {
    "preLaunch": {
      "primaryTrigger": "autoridade|curiosidade|antecipacao|prova_social|reciprocidade|comunidade|transformacao",
      "triggerStack": ["string — gatilhos em ordem de ativação nesta fase"],
      "triggerLogic": "string — por que estes gatilhos nesta ordem para este produto/avatar"
    },
    "cartOpen": {
      "primaryTrigger": "string",
      "triggerStack": ["string"],
      "triggerLogic": "string"
    },
    "cartClose": {
      "primaryTrigger": "urgencia|medo_perda|escassez",
      "triggerStack": ["string"],
      "triggerLogic": "string"
    },
    "remarketing": {
      "primaryTrigger": "contraste|reciprocidade|curiosidade|medo_perda",
      "triggerStack": ["string"],
      "triggerLogic": "string"
    },
    "dominantTrigger": "string — o gatilho mais poderoso para este produto e avatar",
    "dominantTriggerJustification": "string — por que este é o mais poderoso dado o perfil psicográfico",
    "triggerStackSequence": ["string — sequência exata de ativação dos gatilhos do dia 1 ao fechamento"],
    "socialProofBlueprint": "string — instrução: que prova social coletar, que formato, que resultados mostrar, como torná-la irrefutável",
    "antiRequisiteAngles": ["string — ângulos mesmo-sem que quebram objeções antes de serem ditas"],
    "transformationBridge": "string — estado emocional exato do avatar antes vs depois do resultado"
  }
}
\`\`\``;

export async function runStrategyAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for signature compatibility
  track: string,
  log: Logger,
  profile?: import("./profile-builder.agent.js").ProfileBuilderOutput,
  strategicBrief?: StrategicBrief,
): Promise<StrategyOutput> {
  const memCtx = await getMemoryContext(workspaceId, "strategy", String(intakeData["product.category"] ?? ""));
  const memBlock = buildMemoryContextBlock(memCtx);

  const intakeJson = JSON.stringify(intakeData, null, 2);

  const briefContext = strategicBrief
    ? `
## BRIEF ESTRATÉGICO GLOBAL (Strategic Core — siga rigorosamente)

Objetivo da campanha: ${strategicBrief.campaignObjective}
Posicionamento: ${strategicBrief.positioning}
Proposta de valor: ${strategicBrief.valueProposition}
Tom: ${strategicBrief.tone}
Linguagem: ${strategicBrief.language}
Big Domino: ${strategicBrief.bigDomino}
Mecanismo único: ${strategicBrief.uniqueMechanism}
Gatilho dominante: ${strategicBrief.dominantTrigger}
Aquisição: ${strategicBrief.acquisitionStrategy}
Retenção: ${strategicBrief.retentionStrategy}
Urgência: ${strategicBrief.urgencyLevel}
Canais: ${strategicBrief.channels.join(", ")}
Funil: ${strategicBrief.funnelStage}
Promessas PERMITIDAS: ${strategicBrief.permittedPromises.join("; ") || "ver diferenciais do produto"}
Promessas PROIBIDAS: ${strategicBrief.prohibitedPromises.join("; ")}
Limites éticos: ${strategicBrief.ethicalBoundaries.join("; ") || "nenhum listado"}
Limites legais: ${strategicBrief.legalBoundaries.join("; ")}
Critérios de sucesso: ${strategicBrief.successCriteria.join("; ")}
Avisos do Core: ${strategicBrief.coreWarnings.join("; ") || "nenhum"}
Requer revisão humana: ${strategicBrief.requiresHumanReview}

A estratégia DEVE estar alinhada a este brief em todos os pontos. Não contradiga nenhuma diretriz acima.`
    : "";

  const profileContext = profile
    ? `
## INTELIGÊNCIA DE PERFIL (gerada pelo Profile Builder — use como base)

**Score product-market fit:** ${profile.profileScore}/100
**Avisos de validação:** ${profile.validationWarnings.join("; ") || "nenhum"}
**Insights críticos:** ${profile.criticalInsights.join("; ")}

**USP derivada pela IA:** ${profile.product.usp}
**Mecanismo único:** ${profile.positioning.uniqueMechanism}
**Big Idea da campanha:** ${profile.positioning.campaignBigIdea}
**Elevator pitch:** ${profile.positioning.elevatorPitch}

**Avatar primário — ${profile.primaryAvatar.name}:**
- Desejo mais profundo: ${profile.primaryAvatar.deepestDesire}
- Nível de consciência: ${profile.primaryAvatar.awarenessLevel}
- Sofisticação: ${profile.primaryAvatar.sophisticationLevel}
- Principais objeções: ${profile.primaryAvatar.typicalObjections.slice(0, 3).join("; ")}
- O que os faz confiar: ${profile.primaryAvatar.whatMakesThemTrust.slice(0, 2).join("; ")}
- Palavras-chave que usam: ${profile.primaryAvatar.keywordsTheyUse.slice(0, 5).join(", ")}

**Mercado:**
- Maturidade: ${profile.marketIntelligence.maturity}
- Concorrência: ${profile.marketIntelligence.competitionLevel}
- CPL médio do mercado: R$${profile.marketIntelligence.averageCPL}
- Taxa de conversão típica: ${(profile.marketIntelligence.typicalConversionRate * 100).toFixed(1)}%
- Oportunidades: ${profile.marketIntelligence.opportunities.slice(0, 3).join("; ")}
- Red flags: ${profile.marketIntelligence.redFlags.slice(0, 3).join("; ")}

**Segmentos identificados:**
${profile.segments.map((s) => `- ${s.name} [${s.priority}]: ${s.messageAngle} | CPL ~R$${s.estimatedCPL} | Conv ~${(s.estimatedConversionRate * 100).toFixed(1)}%`).join("\n")}

Use este perfil como base para aprofundar a estratégia. Não repita as mesmas informações — aprofunde, conecte e adicione dimensões que o Profile Builder não cobriu.`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategy",
    profileContext: buildPsychologicalProfileBlock(intakeData),
    systemPrompt: COGNITIVE_IDENTITY_STRATEGY + memBlock + STRATEGY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Produza a estratégia completa da campanha para este produto.

**Track de receita:** ${track}
${briefContext}
${profileContext}

**Dados de Intake:**
\`\`\`json
${intakeJson}
\`\`\`

---

## PROCESSO OBRIGATÓRIO — percorra sequencialmente antes de gerar o JSON:

**PASSO 1 — BIG DOMINO:**
Qual é a UMA crença que, se implantada no avatar, colapsa todas as objeções de uma vez?
→ Essa crença deve aparecer no executiveSummary, no coreNarrative e no triggerMap.dominantTriggerJustification.

**PASSO 2 — MECANISMO ÚNICO:**
O que explica mecanicamente por que este produto produz o resultado que promete — de forma diferente de qualquer alternativa existente?
→ Nomeie o mecanismo (ex: "O Protocolo de Aquecimento Reverso"). Nomes criam categoria própria.
→ Este mecanismo vai para offerPositioning.primaryDifferentiator e campaignArchitecture.coreNarrative.

**PASSO 3 — SOFISTICAÇÃO DE MERCADO:**
Qual é o nível de sofisticação da audiência (1-5)? Nível 1 = nunca ouviu. Nível 5 = tentou tudo e desconfia.
→ A sophisticationStrategy DEVE ser diferente para cada nível. Não escreva a mesma abordagem genérica.

**PASSO 4 — MAPA DE ESTADO PSICOLÓGICO:**
Para cada fase (pré-lançamento, abertura, fechamento, remarketing), qual é o estado emocional de ENTRADA do avatar?
→ Preencha triggerMap com a lógica de ativação de gatilhos calibrada para ESSE estado, não para um avatar genérico.

**PASSO 5 — RISCO PRINCIPAL E ALAVANCA:**
Identifique UM risco principal (o que pode destruir o resultado) e UMA alavanca principal (o que pode multiplicá-lo).
→ Esses vão para risks.mainRisks[0] e campaignArchitecture.keyMessages (a alavanca como pilar central).

**PASSO 6 — DISTRIBUIÇÃO NARRATIVA:**
Defina o que acontece em cada plataforma, em que dia, com que objetivo — não "postar regularmente".
→ platformDistributionStrategy deve ter especificidade de cronograma, não generalidade de canais.

Retorne APENAS o JSON da estratégia, nada mais.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "strategy_approval",
    thinkingMessages: [
      "O Estrategista está mapeando o terreno — mercado, competição e oportunidades não óbvias...",
      "Identificando a dor silenciosa do avatar e os gatilhos reais de compra...",
      "Construindo a crença central que, implantada, colapsa todas as objeções...",
      "Definindo o mecanismo único — o que torna esta campanha impossível de copiar...",
      "Desenhando a arquitetura narrativa e a sequência emocional de cada fase...",
      "Calculando riscos, métricas de sucesso e contingências operacionais...",
    ],
  });

  return parseAgentJSON<StrategyOutput>(result.content, {
    executiveSummary: result.content,
    marketDiagnosis: {
      marketMaturity: "growing",
      competitiveLandscape: "",
      entryBarriers: [],
      opportunities: [],
      threats: [],
    },
    offerPositioning: {
      uniqueValueProposition: "",
      primaryDifferentiator: "",
      positioning: "",
      priceJustification: "",
      competitiveAdvantages: [],
    },
    audienceSegmentation: {
      primaryAvatar: "",
      secondaryAvatars: [],
      psychographicProfile: "",
      buyingTriggers: [],
      objections: [],
      sophisticationStrategy: "",
    },
    campaignArchitecture: {
      coreNarrative: "",
      emotionalHook: "",
      keyMessages: [],
      contentPillars: [],
      callToActionStrategy: "",
    },
    successMetrics: {
      primaryKPI: "Receita total",
      conversionRateTarget: 0.01,
      revenueTarget: 0,
      criticalAssumptions: [],
    },
    risks: {
      level: "medium",
      mainRisks: [],
      mitigations: [],
    },
    strategistNotes: "",
    triggerMap: undefined,
  });
}
