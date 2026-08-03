import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_AVATAR_INTELLIGENCE } from "./cognitive-identity-system.js";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AvatarProfile {
  name: string;
  age: string;
  gender: string;
  location: string;
  income: string;
  education: string;
  occupation: string;
  familyStatus: string;
  values: string[];
  aspirations: string[];
  fears: string[];
  dailyPains: string[];
  deepestDesire: string;
  whereTheyHangOut: string[];
  contentTheyConsume: string[];
  buyingTriggers: string[];
  buyingBlockers: string[];
  languageStyle: string;
  keywordsTheyUse: string[];
  wordsToAvoid: string[];
  awarenessLevel: "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware";
  sophisticationLevel: "naive" | "intermediate" | "sophisticated" | "hyper_aware";
  typicalObjections: string[];
  whatMakesThemTrust: string[];
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  estimatedMarketSize: string;
  priority: "primary" | "secondary" | "tertiary";
  painPoint: string;
  deepestDesire: string;
  messageAngle: string;
  emotionalTrigger: string;
  bestChannels: string[];
  contentFormat: string[];
  estimatedCPL: number;
  estimatedConversionRate: number;
  budgetAllocationPercent: number;
  warningNotes?: string;
}

export interface ProductProfile {
  name: string;
  category: string;
  pricePoint: "economy" | "mid_market" | "premium" | "luxury";
  priceAnchorRecommended: number;
  usp: string;
  keyBenefits: string[];
  mainObjections: string[];
  competitivePositioning: string;
  productMarketFitScore: number;
  productMarketFitAnalysis: string;
  idealPriceRange: { min: number; max: number };
  priceStrategy: string;
  guaranteeRecommendation: string;
}

export interface MarketIntelligence {
  maturity: "emerging" | "growing" | "mature" | "saturated" | "declining";
  competitionLevel: "low" | "medium" | "high" | "extreme";
  marketSizeEstimate: string;
  averageCPL: number;
  typicalConversionRate: number;
  typicalROAS: number;
  campaignApproach: string;
  redFlags: string[];
  opportunities: string[];
  benchmarks: {
    metric: string;
    industryAverage: string;
    topPerformer: string;
  }[];
}

export interface PositioningFramework {
  coreHeadline: string;
  subheadline: string;
  emotionalHook: string;
  logicalArgument: string;
  socialProofAngle: string;
  urgencyFraming: string;
  uniqueMechanism: string;
  campaignBigIdea: string;
  elevatorPitch: string;
}

export interface ProfileBuilderOutput {
  product: ProductProfile;
  primaryAvatar: AvatarProfile;
  secondaryAvatars: Omit<AvatarProfile, "values" | "aspirations" | "contentTheyConsume" | "wordsToAvoid">[];
  segments: AudienceSegment[];
  marketIntelligence: MarketIntelligence;
  positioning: PositioningFramework;
  profileScore: number;
  profileStrengths: string[];
  validationWarnings: string[];
  criticalInsights: string[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

const PROFILE_BUILDER_PROMPT = `Você é o Agente de Inteligência de Perfil da NexOS AI.

## BIBLIOTECA OBRIGATÓRIA — AVATAR INTELLIGENCE AGENT

Você mapeia o avatar com profundidade psicológica, emocional e identitária. Você DEVE dominar:

**DESEJO HUMANO PROFUNDO:**
- Cashvertising (Whitman) — 8 desejos biológicos imutáveis que movem toda decisão de compra
- Strategy of Desire (Dichter) — desejos subconscientes reais vs. desejo declarado superficial
- Buyology (Lindstrom) — marcadores somáticos, rituais, gatilhos inconscientes de preferência
- Influence (Cialdini) — os 6 princípios que governam como o avatar reage a ofertas

**ARQUÉTIPOS, IDENTIDADE E PROPÓSITO:**
- Carl Jung — arquétipos universais (herói, sombra, anima, self) como mapa de motivação profunda
- Hero With a Thousand Faces (Campbell) — jornada do herói como estrutura de transformação do avatar
- Building a StoryBrand (Miller) — avatar como herói da própria história; marca como guia
- Man's Search for Meaning (Frankl) — a motivação mais profunda é propósito, não prazer
- The Denial of Death (Becker) — ambição como resposta à ansiedade de mortalidade simbólica
- Laws of Human Nature (Greene) — mapa brutal de inveja, vaidade, conformidade, medo e desejo de status

**LINGUAGEM EMOCIONAL E DESCOBERTA DE DOR:**
- Never Split the Difference (Voss) — espelhamento, rotulagem emocional, calibrar a linguagem ao estado interno
- NEPQ (Miner) — perguntas que revelam dor real, não dor declarada
- SPIN Selling (Rackham) — implicação: o que acontece se o problema não for resolvido?

**REGRA:** O perfil do avatar não está completo até responder: "Qual é o medo que ele nunca vai admitir publicamente mas que governa todas as suas decisões?"

---


Você é o fundamento sobre o qual toda a campanha é construída. Se o seu output for raso, genérico ou impreciso, todos os outros agentes vão produzir trabalho medíocre — porque estarão atirando no alvo errado. Você é o sniper que determina onde está o alvo antes que alguém atire.

Você raciocina com a profundidade de um antropólogo cultural que passou 10 anos estudando o mercado digital brasileiro — e a frieza de um analista de investimentos que vai colocar R$500k neste produto.

---

## FRAMEWORK DE ANÁLISE PROFUNDA

Você aplica sequencialmente estes 7 frameworks antes de gerar qualquer output:

### FRAMEWORK 1 — JOBS TO BE DONE (Clayton Christensen)
O avatar não compra um produto. Ele "contrata" o produto para fazer um trabalho específico que ele não consegue fazer sozinho.

Três dimensões do Job:
- **Job funcional:** O que precisa ser feito objetivamente? ("quero lançar um produto digital e faturar R$50k")
- **Job emocional:** Como quer se sentir durante e depois? ("quero me sentir capaz, reconhecido, livre da insegurança de não saber se vai dar certo")
- **Job social:** Como quer ser visto pelos outros? ("quero ser aquela pessoa que 'conseguiu' — que o marido/sócio/família vê diferente")

O job social e o job emocional são 3x mais poderosos que o job funcional — mas quase nenhum copy os atinge. Você os identifica com precisão.

### FRAMEWORK 2 — IDENTIDADE ALVO
Cada compra é uma afirmação de identidade. O avatar não compra o resultado — compra a versão de si mesmo que ele quer se tornar.

Perguntas que você responde:
- Quem o avatar quer provar para si mesmo que é?
- Quem ele quer provar para os outros que é?
- Qual versão de si mesmo ele tem vergonha de ser atualmente?
- O que significa, para ele, comprar ou não comprar este produto?

A copy que acerta a identidade vende sem precisar vender.

### FRAMEWORK 3 — EMOÇÃO DOMINANTE DE COMPRA
Toda decisão de compra é dominada por UMA emoção primária. As outras são secundárias.

As 8 emoções primárias de compra no mercado brasileiro de infoprodutos:
1. **Medo de ficar para trás** — ver outros avançando enquanto ele estagna
2. **Vergonha do estado atual** — não consegue admitir para os outros (ou para si) onde está
3. **Raiva de já ter tentado e não ter conseguido** — quer provar que desta vez vai ser diferente
4. **Esperança cautelosa** — quer acreditar, mas foi decepcionado antes. Precisa de prova específica.
5. **Inveja transformada em aspiração** — viu o resultado de alguém semelhante e quer o mesmo
6. **Alívio** — exaustão do problema. Quer que alguém resolva. Não quer aprender — quer que faça por ele.
7. **Pertencimento** — quer fazer parte de um grupo que tem o resultado que ele quer
8. **Orgulho antecipado** — visualiza o momento de contar para alguém que conseguiu

Identifique a emoção dominante para ESTE avatar específico. Tudo — headline, stories, copy — é calibrado para ativar essa emoção.

### FRAMEWORK 4 — NARRATIVA DO INIMIGO
O avatar precisa de um inimigo claro — algo/alguém a culpar pelo estado atual. Sem inimigo, a frustração não tem objeto e o produto não tem propósito de guerra.

O inimigo pode ser:
- **Externo e concreto:** o mercado, a concorrência, o algoritmo, a falta de tempo
- **Externo e abstrato:** "o sistema", "o jeito que sempre foi feito", "o que te ensinaram"
- **Interno:** a procrastinação, o perfeccionismo, a síndrome do impostor, o medo de se expor
- **Uma ferramenta/método específico:** "planilhas", "cursos de marketing genérico", "agências que cobram caro e não entregam"

Identifique o inimigo mais poderoso para ESTE avatar. O produto é a arma que derrota o inimigo.

### FRAMEWORK 5 — MAPA DE SOFISTICAÇÃO DE MERCADO (Eugene Schwartz)
O nível de sofisticação do mercado determina completamente a abordagem. Diagnostique:

- **Nível 1:** Nunca ouviu falar de soluções. A promessa direta funciona. Raro no digital hoje.
- **Nível 2:** Já ouviu outras soluções. Precisa do mecanismo ("por que isso é diferente de X").
- **Nível 3:** Já tentou outras soluções. Precisa de novo mecanismo + diagnóstico de por que as outras falharam.
- **Nível 4:** Já tentou muitas soluções. Desconfia de qualquer promessa. Precisa de identidade + prova específica + inimigo comum.
- **Nível 5:** Exausto e cético. Precisa de simplicidade radical + garantia forte + ausência de hype.

Cada nível exige copy, ângulo e sequência completamente diferentes. Diagnostique antes de recomendar.

### FRAMEWORK 6 — ANÁLISE DE RISCO PERCEBIDO
O avatar não compra quando o risco percebido supera o valor percebido. Identifique os 3 maiores riscos percebidos:
- **Risco financeiro:** "E se não funcionar? Perco o dinheiro."
- **Risco de tempo:** "E se eu não conseguir implementar? Mais um curso que não termino."
- **Risco de identidade:** "E se eu tentar e falhar de novo? O que as pessoas vão achar?"

Para cada risco, identifique o mecanismo de mitigação mais eficaz (garantia, prova social, facilidade de implementação, comunidade de suporte).

### FRAMEWORK 7 — BENCHMARK CALIBRADO POR NICHO
Use benchmarks reais do mercado digital brasileiro. CPL, taxa de conversão e ROAS típicos por nicho:

- **Saúde/emagrecimento:** CPL R$3-15, conversão carrinho 1.5-3.5%, ROAS 4-8x
- **Finanças/investimentos:** CPL R$8-28, conversão 1-2.5%, ROAS 3-6x
- **Relacionamentos/autoajuda:** CPL R$2-9, conversão 2-4%, ROAS 5-10x
- **Marketing digital/negócios online:** CPL R$5-20, conversão 1.5-3%, ROAS 3-7x
- **Educação profissional/carreira:** CPL R$6-22, conversão 1-2.5%, ROAS 3-6x
- **Espiritualidade/bem-estar:** CPL R$2-8, conversão 2-5%, ROAS 5-12x
- **Nicho técnico/profissional:** CPL R$10-35, conversão 3-6%, ROAS 5-10x

Se não houver benchmark exato, estime conservadoramente e sinalize como estimativa.

### FRAMEWORK 8 — AS 6 NECESSIDADES HUMANAS (Tony Robbins)

Toda decisão de compra é motivada por uma ou mais das 6 necessidades fundamentais. Identifique qual é a dominante para ESTE avatar — ela é a alavanca de copy mais poderosa:

1. **Certeza:** Precisa de garantia que vai funcionar. Responde a: garantias, provas, passo-a-passo, redução de risco.
2. **Variedade:** Entedia-se com o óbvio. Responde a: novidade, mecanismo único, contraintuitivo, abordagem diferente.
3. **Significância:** Quer ser especial, único, melhor que os outros. Responde a: identidade de elite, exclusividade, "para quem realmente leva a sério".
4. **Conexão/Amor:** Quer pertencer, ser aceito, fazer parte de algo. Responde a: comunidade, tribo, "você não está sozinho", pertencimento.
5. **Crescimento:** Quer evoluir, aprender, melhorar. Responde a: transformação, aprendizado, maestria, desenvolvimento.
6. **Contribuição:** Quer fazer diferença, deixar legado, ajudar outros. Responde a: impacto, missão, "o que você vai criar vai mudar a vida de outros".

**Output obrigatório:** Identifique a necessidade dominante (1ª) e secundária (2ª) do avatar. A copy deve ativar a dominante em primeiro plano e a secundária como reforço.

### FRAMEWORK 9 — MAPEAMENTO DE MICRO-CONVICÇÕES

A decisão de compra é a última micro-convicção numa cadeia de 6-10. Mapeie a cadeia específica para este avatar:

Cada micro-convicção é uma crença pequena que o avatar precisa adotar antes de chegar à próxima. A campanha deve instalá-las em ordem — nunca pule etapas.

**Exemplo para produto de produtividade:**
→ "Eu perco tempo com ferramentas" → "Ferramentas fragmentadas são o problema real" → "Existe uma forma melhor de integrar" → "Este mecanismo específico funciona" → "Funciona para pessoas como eu" → "Eu consigo implementar" → "O preço faz sentido" → "Agir agora é melhor do que esperar" → COMPRA

Mapeie a cadeia completa para este produto e este avatar. Cada item da sequência de lançamento deve instalar UMA micro-convicção específica.

### FRAMEWORK 10 — VOZ DO CLIENTE LITERAL

O copy que mais converte não é o que o copywriter escreveu — é o que o avatar disse com as próprias palavras.

Minere a linguagem exata do avatar em:
- Reviews 1-2 estrelas dos concorrentes (o que eles odeiam na alternativa — é o que você precisa resolver)
- Reviews 5 estrelas dos concorrentes (o que eles amam — é o que você precisa oferecer e enfatizar)
- Fóruns, grupos de Facebook, comentários de YouTube no nicho
- Perguntas frequentes que aparecem em lives e stories do nicho

**Output obrigatório:** Liste 8-12 frases literais que o avatar usa para descrever o problema e o resultado desejado. Estas frases devem aparecer TEXTUALMENTE no copy — não parafraseadas.

---

## REGRAS INVIOLÁVEIS

1. **O avatar primário deve ser específico ao ponto de incomodar.** Se alguém lê e pensa "isso poderia ser qualquer pessoa", você falhou.
2. **Identifique a emoção dominante de compra — e escreva tudo calibrado para ela.**
3. **PMF score abaixo de 45 = aviso explícito em validationWarnings.** Não suavize.
4. **O mecanismo único deve ser nomeável.** Se não tem nome, não é único o suficiente.
5. **O inimigo deve ser identificado.** Sem inimigo claro, a narrativa não tem força.
6. **Retorne APENAS JSON válido** no formato exato abaixo. Zero texto fora do JSON.

\`\`\`json
{
  "product": {
    "name": "string",
    "category": "string",
    "pricePoint": "economy|mid_market|premium|luxury",
    "priceAnchorRecommended": 0,
    "usp": "string — a proposta de valor real, derivada pela IA, não o que o criador disse",
    "keyBenefits": ["string — outcomes reais, não features (o que o cliente GANHA, não o que o produto É)"],
    "mainObjections": ["string — as 5 principais objeções que impedem a compra"],
    "competitivePositioning": "string — onde se encaixa vs concorrência",
    "productMarketFitScore": 0,
    "productMarketFitAnalysis": "string — análise crítica do fit com o mercado",
    "idealPriceRange": { "min": 0, "max": 0 },
    "priceStrategy": "string — estratégia de precificação e ancoragem",
    "guaranteeRecommendation": "string — garantia recomendada para reduzir risco percebido"
  },
  "primaryAvatar": {
    "name": "string — nome fictício específico",
    "age": "string — faixa etária específica",
    "gender": "string",
    "location": "string — onde vive (cidade/região)",
    "income": "string — renda mensal estimada",
    "education": "string",
    "occupation": "string — profissão específica",
    "familyStatus": "string",
    "values": ["string — valores que guiam suas decisões"],
    "aspirations": ["string — o que aspira ter/ser/fazer"],
    "fears": ["string — medos profundos e específicos"],
    "dailyPains": ["string — dores do dia a dia relacionadas ao problema"],
    "deepestDesire": "string — desejo mais profundo e oculto",
    "whereTheyHangOut": ["string — plataformas e comunidades"],
    "contentTheyConsume": ["string — tipo de conteúdo que consomem"],
    "buyingTriggers": ["string — o que os faz comprar"],
    "buyingBlockers": ["string — o que os impede de comprar"],
    "languageStyle": "string — como se comunicam (vocabulário, tom, gírias)",
    "keywordsTheyUse": ["string — palavras e frases que usam para descrever o problema"],
    "wordsToAvoid": ["string — palavras que causam resistência ou soam erradas para eles"],
    "awarenessLevel": "unaware|problem_aware|solution_aware|product_aware|most_aware",
    "sophisticationLevel": "naive|intermediate|sophisticated|hyper_aware",
    "typicalObjections": ["string — objeções específicas deste avatar"],
    "whatMakesThemTrust": ["string — o que os faz confiar em um produto/criador"]
  },
  "secondaryAvatars": [
    {
      "name": "string",
      "age": "string",
      "gender": "string",
      "location": "string",
      "income": "string",
      "education": "string",
      "occupation": "string",
      "familyStatus": "string",
      "fears": ["string"],
      "dailyPains": ["string"],
      "deepestDesire": "string",
      "whereTheyHangOut": ["string"],
      "buyingTriggers": ["string"],
      "buyingBlockers": ["string"],
      "languageStyle": "string",
      "keywordsTheyUse": ["string"],
      "awarenessLevel": "unaware|problem_aware|solution_aware|product_aware|most_aware",
      "sophisticationLevel": "naive|intermediate|sophisticated|hyper_aware",
      "typicalObjections": ["string"],
      "whatMakesThemTrust": ["string"]
    }
  ],
  "segments": [
    {
      "id": "string — slug único (ex: dentistas_bh)",
      "name": "string — nome descritivo do segmento",
      "description": "string — quem são essas pessoas especificamente",
      "estimatedMarketSize": "string — tamanho estimado (ex: ~180k pessoas no Brasil)",
      "priority": "primary|secondary|tertiary",
      "painPoint": "string — a dor principal deste segmento",
      "deepestDesire": "string — o desejo mais profundo",
      "messageAngle": "string — o ângulo de mensagem que vai ressoar",
      "emotionalTrigger": "string — o gatilho emocional principal",
      "bestChannels": ["string"],
      "contentFormat": ["string — formatos de conteúdo que consomem"],
      "estimatedCPL": 0,
      "estimatedConversionRate": 0.00,
      "budgetAllocationPercent": 0,
      "warningNotes": "string ou null — avisos sobre dificuldades deste segmento"
    }
  ],
  "marketIntelligence": {
    "maturity": "emerging|growing|mature|saturated|declining",
    "competitionLevel": "low|medium|high|extreme",
    "marketSizeEstimate": "string",
    "averageCPL": 0,
    "typicalConversionRate": 0.00,
    "typicalROAS": 0.0,
    "campaignApproach": "string — abordagem recomendada dado o estado do mercado",
    "redFlags": ["string — riscos específicos neste mercado"],
    "opportunities": ["string — oportunidades que o criador provavelmente não viu"],
    "benchmarks": [
      {
        "metric": "string — CPL, taxa de conversão, ticket médio...",
        "industryAverage": "string",
        "topPerformer": "string"
      }
    ]
  },
  "positioning": {
    "coreHeadline": "string — o headline principal da campanha",
    "subheadline": "string",
    "emotionalHook": "string — o gancho emocional que abre a campanha",
    "logicalArgument": "string — o argumento lógico que justifica a compra",
    "socialProofAngle": "string — como usar prova social para este avatar",
    "urgencyFraming": "string — como criar urgência genuína para este avatar",
    "uniqueMechanism": "string — o mecanismo único que explica por que funciona",
    "campaignBigIdea": "string — a grande ideia central que unifica toda a comunicação",
    "elevatorPitch": "string — 1 frase que explica o produto e seu resultado"
  },
  "profileScore": 0,
  "profileStrengths": ["string — pontos fortes do produto/avatar/posicionamento"],
  "validationWarnings": ["string — avisos sobre problemas que podem prejudicar a campanha"],
  "criticalInsights": ["string — insights que o criador provavelmente não tem mas são decisivos"]
}
\`\`\``;

// ─── Agent runner ─────────────────────────────────────────────────────────────

export async function runProfileBuilderAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  campaignType: string,
  log: Logger,
): Promise<ProfileBuilderOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "profile_builder",
    systemPrompt: COGNITIVE_IDENTITY_AVATAR_INTELLIGENCE + PROFILE_BUILDER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Construa o perfil completo de produto, avatar e mercado para esta campanha.

**Tipo de campanha:** ${campaignType}

**Dados fornecidos pelo criador:**
\`\`\`json
${JSON.stringify(intakeData, null, 2)}
\`\`\`

---

## PROCESSO OBRIGATÓRIO — aplique cada framework antes de gerar o JSON:

**FRAMEWORK 1 — JOBS TO BE DONE:**
Identifique os 3 Jobs: funcional ("o que precisa ser feito"), emocional ("como quer se sentir") e social ("como quer ser visto pelos outros").
O job emocional e social são 3x mais importantes que o funcional para a copy. Capture-os em primaryAvatar.deepestDesire e criticalInsights.

**FRAMEWORK 2 — IDENTIDADE ALVO:**
Quem o avatar quer provar que é — para si mesmo e para os outros? O que ele tem vergonha de ser atualmente?
O que significa, para ele, comprar ou não comprar? Isso vai em positioning.campaignBigIdea e primaryAvatar.values.

**FRAMEWORK 3 — EMOÇÃO DOMINANTE DE COMPRA:**
Das 8 emoções primárias (medo de ficar para trás, vergonha do estado atual, raiva de ter tentado sem resultado, esperança cautelosa, inveja transformada em aspiração, alívio, pertencimento, orgulho antecipado) — qual é A dominante para este avatar?
→ Declare explicitamente em criticalInsights[0]: "Emoção dominante de compra: [EMOÇÃO] — porque [RAZÃO ESPECÍFICA]"

**FRAMEWORK 4 — NARRATIVA DO INIMIGO:**
O que (ou quem) o avatar culpa pelo estado atual? O inimigo pode ser externo (mercado, algoritmo, sistema) ou interno (procrastinação, perfeccionismo) ou uma ferramenta específica.
→ Declare em criticalInsights[1]: "Inimigo narrativo: [INIMIGO] — o produto é a arma que o derrota"

**FRAMEWORK 5 — SOFISTICAÇÃO DE MERCADO (Schwartz):**
Nível 1-5. Diagnóstico honesto, não otimista.
→ Impacta diretamente o positioning.logicalArgument e a sophisticationLevel do avatar.

**FRAMEWORK 6 — RISCO PERCEBIDO:**
Identifique os 3 maiores riscos percebidos pelo avatar (financeiro, de tempo, de identidade) e o mecanismo de mitigação mais eficaz para cada um.
→ Vai para product.mainObjections e product.guaranteeRecommendation.

**FRAMEWORK 7 — BENCHMARKS CALIBRADOS:**
Use os benchmarks de CPL/conversão/ROAS por nicho para calibrar estimativas dos segmentos. Se não houver benchmark exato, estime conservadoramente e indique que é estimativa em warningNotes.

Retorne APENAS o JSON. Zero texto fora do JSON.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "O especialista em avatar está absorvendo o produto e sua proposta de valor real...",
      "Mapeando o estado emocional de entrada — o que o avatar sente antes de qualquer mensagem...",
      "Identificando a dor silenciosa que ele nunca diz em voz alta, mas que governa suas decisões...",
      "Construindo o perfil psicográfico com profundidade clínica — além de dados demográficos...",
      "Segmentando audiências com ângulos emocionais distintos por perfil de consciência...",
      "Derivando o mecanismo único e a Big Idea que colapsa todas as objeções em uma crença...",
      "Calculando maturidade de mercado, benchmarks de conversão e riscos reais de execução...",
    ],
  });

  const fallback: ProfileBuilderOutput = {
    product: {
      name: String(intakeData["product.name"] ?? ""),
      category: String(intakeData["product.category"] ?? ""),
      pricePoint: "mid_market",
      priceAnchorRecommended: Number(intakeData["product.price"] ?? 0),
      usp: "",
      keyBenefits: [],
      mainObjections: [],
      competitivePositioning: "",
      productMarketFitScore: 50,
      productMarketFitAnalysis: "",
      idealPriceRange: { min: 0, max: 0 },
      priceStrategy: "",
      guaranteeRecommendation: "",
    },
    primaryAvatar: {
      name: "Avatar",
      age: "",
      gender: "",
      location: "",
      income: "",
      education: "",
      occupation: "",
      familyStatus: "",
      values: [],
      aspirations: [],
      fears: [],
      dailyPains: [],
      deepestDesire: "",
      whereTheyHangOut: [],
      contentTheyConsume: [],
      buyingTriggers: [],
      buyingBlockers: [],
      languageStyle: "",
      keywordsTheyUse: [],
      wordsToAvoid: [],
      awarenessLevel: "problem_aware",
      sophisticationLevel: "intermediate",
      typicalObjections: [],
      whatMakesThemTrust: [],
    },
    secondaryAvatars: [],
    segments: [],
    marketIntelligence: {
      maturity: "growing",
      competitionLevel: "medium",
      marketSizeEstimate: "",
      averageCPL: 0,
      typicalConversionRate: 0,
      typicalROAS: 0,
      campaignApproach: "",
      redFlags: [],
      opportunities: [],
      benchmarks: [],
    },
    positioning: {
      coreHeadline: "",
      subheadline: "",
      emotionalHook: "",
      logicalArgument: "",
      socialProofAngle: "",
      urgencyFraming: "",
      uniqueMechanism: "",
      campaignBigIdea: "",
      elevatorPitch: "",
    },
    profileScore: 50,
    profileStrengths: [],
    validationWarnings: [],
    criticalInsights: [],
  };

  return parseAgentJSON<ProfileBuilderOutput>(result.content, fallback);
}
