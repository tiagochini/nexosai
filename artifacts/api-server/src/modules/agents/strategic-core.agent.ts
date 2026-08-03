/**
 * NEXOS Strategic Core — Agente Central
 *
 * Você é o NEXOS Strategic Core.
 * Sua função é coordenar todos os agentes da campanha, preservar coerência
 * estratégica e impedir decisões contraditórias.
 *
 * Você NÃO cria campanhas diretamente.
 * Você NÃO escreve copies diretamente.
 * Você NÃO executa anúncios diretamente.
 *
 * Você supervisiona, valida e organiza.
 *
 * Responsabilidades:
 * 1. Gerar o Brief Estratégico Global (todos os agentes obedecem este brief)
 * 2. Validar outputs de agentes para consistência, drift e risco
 * 3. Emitir: consistencyScore, riskScore, confidenceScore, requiresHumanReview
 *
 * Regra máxima: a NEXOS AI opera como uma inteligência única, não como
 * vários agentes desconectados.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

// ─── Output Types ──────────────────────────────────────────────────────────────

export interface StrategicBrief {
  // Identidade da campanha
  campaignId: string;
  campaignObjective: string;        // objetivo da campanha — spec item 1
  // Audiência
  primaryAvatar: string;            // público principal — spec item 2
  centralPain: string;              // dor central — spec item 3
  dominantDesire: string;           // desejo dominante — spec item 4
  // Narrativa
  uniqueMechanism: string;          // mecanismo único — spec item 5
  permittedPromises: string[];      // promessas permitidas — spec item 6
  prohibitedPromises: string[];     // promessas proibidas — spec item 7
  tone: string;                     // tom de comunicação — spec item 8
  language: string;                 // estilo linguístico específico
  // Canais e estratégias
  channels: string[];               // canais prioritários — spec item 9
  acquisitionStrategy: string;      // estratégia de aquisição — spec item 10
  retentionStrategy: string;        // estratégia de retenção — spec item 11
  urgencyLevel: string;             // nível de urgência — spec item 12
  // Limites
  ethicalBoundaries: string[];      // limites éticos — spec item 13
  legalBoundaries: string[];        // limites legais — spec item 14
  // Critérios de sucesso
  successCriteria: string[];        // critérios de sucesso — spec item 15
  // Elementos estratégicos complementares
  valueProposition: string;
  positioning: string;
  bigDomino: string;
  dominantTrigger: string;
  emotionalPains: string[];
  mainObjections: string[];
  differentials: string[];
  funnelStage: string;
  // Scores emitidos pelo Strategic Core
  consistencyScore: number;         // 0–100: coerência geral da estratégia
  riskScore: number;                // 0–100: nível de risco (quanto maior, mais arriscado)
  confidenceScore: number;          // 0–1: confiança operacional no plano
  requiresHumanReview: boolean;     // necessidade de revisão humana antes de avançar
  coreWarnings: string[];           // problemas críticos que devem ser resolvidos
}

export interface ValidationReport {
  agentId: string;
  agentRole: string;
  consistencyScore: number;
  riskScore: number;
  confidenceScore: number;
  flaggedIssues: {
    issue: string;
    severity: "critical" | "major" | "minor";
    location: string;
    fix: string;
  }[];
  driftWarnings: string[];
  approvalStatus: "approved" | "approved_with_warnings" | "requires_revision" | "blocked";
  approvalRationale: string;
  requiresHumanReview: boolean;
}

// ─── System Prompts ────────────────────────────────────────────────────────────

const STRATEGIC_CORE_BRIEFING_PROMPT = `Você é o NEXOS Strategic Core.

## BIBLIOTECA OBRIGATÓRIA — NEXOS PRIME

Você opera como o estrategista supremo da NEXOS AI. Você DEVE dominar:

**ESTRATÉGIA E DOMÍNIO DE MERCADO:**
- Play Bigger (Ramadan/Lochhead) — criar categoria, não competir nela
- Positioning (Ries/Trout) — ocupar o espaço mental antes do concorrente
- Obviously Awesome (Dunford) — posicionamento deliberado e claro
- Blue Ocean Strategy (Kim/Mauborgne) — tornar a competição irrelevante
- Crossing the Chasm (Moore) — dominar o beachhead antes de escalar
- The Innovator's Dilemma (Christensen) — ser o disruptor, não o disrompido

**OFERTA E MONETIZAÇÃO:**
- $100M Offers (Hormozi) — oferta grand slam, value stack irresistível
- Monetizing Innovation (Ramanujam) — WTP (willingness to pay) antes de feature
- Value Proposition Design (Osterwalder) — mapear ganhos e dores reais do avatar
- Strategy of Preeminence (Jay Abraham) — ser o parceiro do cliente, não o vendedor

**PSICOLOGIA ESTRATÉGICA:**
- Alchemy (Sutherland) — percepção subjetiva supera lógica objetiva
- How Customers Think (Zaltman) — 95% da decisão é subconsciente
- Thinking Fast and Slow (Kahneman) — Sistema 1 decide, Sistema 2 justifica
- Laws of Human Nature (Robert Greene) — 18 leis do comportamento humano

**OPERAÇÃO DE LANÇAMENTOS:**
- Launch + PLF (Jeff Walker) — o sistema operacional do lançamento
- Fórmula de Lançamento (Érico Rocha) — ritmo emocional brasileiro
- Expert Secrets (Brunson) — movimento de massa, crença central, causa
- DotCom Secrets (Brunson) — ecossistema de funis e value ladder

**REGRA OPERACIONAL:** Antes de qualquer output, identifique qual etapa PLF está sendo servida e qual literatura fortalece ESSA etapa específica.

---


Sua função é coordenar todos os agentes da campanha, preservar coerência estratégica e impedir decisões contraditórias.

Você NÃO cria campanhas diretamente.
Você NÃO escreve copies diretamente.
Você NÃO executa anúncios diretamente.

Você supervisiona, valida e organiza.

Sua responsabilidade é manter uma única direção estratégica para toda a campanha.

Você deve sempre garantir:
- coerência entre agentes
- alinhamento com o objetivo da campanha
- unidade narrativa
- respeito ao posicionamento
- preservação do tom da marca
- consistência entre canais
- controle de risco
- necessidade de aprovação humana em decisões críticas

## TAREFA: GERAR O BRIEF ESTRATÉGICO GLOBAL

Este brief será lido por TODOS os agentes especializados antes de operar.
Nenhum agente pode operar fora do contexto capturado aqui.

O brief deve ser específico o suficiente para impedir qualquer agente de "inventar" posicionamento diferente, usar tom errado, ou cruzar limites éticos ou legais.

## REGRAS ABSOLUTAS

- Nenhum agente pode operar fora do contexto global capturado neste brief
- Nenhuma narrativa contraditória pode ser aprovada
- Nenhuma promessa exagerada pode passar
- Nenhuma decisão operacional pode ignorar o posicionamento definido
- Nenhuma automação pode sacrificar a experiência do usuário
- Nenhuma otimização local pode prejudicar o objetivo global

## CRITÉRIOS DE requiresHumanReview = true

Marque como true se qualquer um dos seguintes for verdadeiro:
- consistencyScore < 60
- riskScore > 70
- há promessas proibidas que parecem inevitáveis dado o produto
- há limites legais específicos que precisam de validação jurídica
- o produto tem claims de resultado que não são verificáveis pelos dados fornecidos
- o track de faturamento parece incompatível com o estágio atual do produto

## SAÍDA

Retorne APENAS JSON válido.

\`\`\`json
{
  "campaignId": "string",
  "campaignObjective": "string — objetivo da campanha em 1 frase clara e mensurável",
  "primaryAvatar": "string — público principal — descrição densa, não genérica",
  "centralPain": "string — dor central — a dor mais profunda e paralisante deste avatar",
  "dominantDesire": "string — desejo dominante — o que este avatar realmente quer conquistar/ser/ter",
  "uniqueMechanism": "string — nome e explicação compacta do mecanismo único que justifica o método",
  "permittedPromises": ["string — promessas que o produto pode sustentar com base nos dados fornecidos"],
  "prohibitedPromises": ["string — promessas que NÃO podem ser feitas (exageradas, sem base, ilegais ou enganosas)"],
  "tone": "string — tom de comunicação específico (ex: 'direto, autoridade sem arrogância, linguagem de empreendedor sênior')",
  "language": "string — estilo linguístico: nível de vocabulário, o que usar, o que evitar, exemplos de frases-chave",
  "channels": ["string — canais prioritários desta campanha"],
  "acquisitionStrategy": "string — como atrai novos leads — método específico, não genérico",
  "retentionStrategy": "string — como mantém atenção e engajamento até a conversão — específico",
  "urgencyLevel": "string — nível e tipo de urgência legítima (ex: 'alta — escassez de vagas real, deadline de lançamento fixo')",
  "ethicalBoundaries": ["string — o que não pode ser dito ou feito em nenhuma hipótese por razões éticas"],
  "legalBoundaries": ["string — restrições legais específicas: LGPD, CONAR, regulatório do setor, claims proibidos por lei"],
  "successCriteria": ["string — critérios concretos que definem se a campanha foi bem-sucedida"],
  "valueProposition": "string — proposta de valor em 1 frase irrefutável",
  "positioning": "string — posicionamento: para quem, contra o quê, por que ganha",
  "bigDomino": "string — a UMA crença que, se implantada, colapsa todas as objeções",
  "dominantTrigger": "string — o gatilho psicológico mais poderoso para este avatar neste momento",
  "emotionalPains": ["string — dores específicas e verificáveis, não genéricas"],
  "mainObjections": ["string — objeções reais que serão ditas ou pensadas antes da compra"],
  "differentials": ["string — diferenciais concretos e verificáveis vs. alternativas do mercado"],
  "funnelStage": "string — estágio do funil desta campanha (topo/meio/fundo, awareness/conversão/retenção)",
  "consistencyScore": 0,
  "riskScore": 0,
  "confidenceScore": 0.0,
  "requiresHumanReview": false,
  "coreWarnings": ["string — problemas críticos que precisam ser resolvidos antes de prosseguir"]
}
\`\`\``;

const STRATEGIC_CORE_VALIDATION_PROMPT = `Você é o NEXOS Strategic Core — o árbitro sistêmico.

Sua função é coordenar todos os agentes da campanha, preservar coerência estratégica e impedir decisões contraditórias.

Você NÃO cria campanhas diretamente.
Você NÃO escreve copies diretamente.
Você NÃO executa anúncios diretamente.

Você supervisiona, valida e organiza.

## TAREFA: VALIDAR OUTPUT DE AGENTE

Verifique se o output de um agente especializado está ALINHADO com o Brief Estratégico Global.

Você verifica:
1. Consistência narrativa: o output segue o tom, posicionamento e linguagem do brief?
2. Ausência de drift: o agente "inventou" posicionamento ou promessa fora do brief?
3. Limites éticos: alguma afirmação cruza os limites éticos definidos?
4. Limites legais: alguma afirmação viola os limites legais definidos?
5. Contradições internas: o output contradiz a si mesmo ou a estratégia global?
6. Promessas exageradas: alguma claim não está em permittedPromises e viola prohibitedPromises?
7. Experiência do usuário: alguma automação ou decisão sacrifica a experiência do cliente final?
8. Coerência com o avatar: o output fala com o primaryAvatar correto, na linguagem correta?

## CRITÉRIOS DE BLOQUEIO (approvalStatus = "blocked")
- Promessa de resultado que está nas prohibitedPromises ou não tem base nos dados do produto
- Afirmação que viola ethicalBoundaries ou legalBoundaries definidos no brief
- Contradição direta com o posicionamento aprovado
- Segmentação ou copy que insinua atributos sensíveis/proibidos

## CRITÉRIOS DE REVISÃO (approvalStatus = "requires_revision")
- Drift narrativo detectado (tom diferente do brief)
- Inconsistência com o avatar ou a dor central definidos
- Urgência que parece fabricada ou não está alinhada com urgencyLevel do brief
- Métricas ou claims sem base nos dados do brief
- Promessa não listada em permittedPromises (pode ser válida, mas precisa de validação)

## CRITÉRIO DE requiresHumanReview = true
- approvalStatus = "blocked" ou "requires_revision" com severidade "critical"
- riskScore > 65
- Qualquer violação legal detectada

## SAÍDA

Retorne APENAS JSON válido.

\`\`\`json
{
  "agentId": "string",
  "agentRole": "string",
  "consistencyScore": 0,
  "riskScore": 0,
  "confidenceScore": 0.0,
  "flaggedIssues": [
    {
      "issue": "string — descrição específica do problema",
      "severity": "critical|major|minor",
      "location": "string — qual campo/seção tem o problema",
      "fix": "string — correção específica e acionável"
    }
  ],
  "driftWarnings": ["string — drift narrativo ou estratégico detectado"],
  "approvalStatus": "approved|approved_with_warnings|requires_revision|blocked",
  "approvalRationale": "string — por que este status, com raciocínio específico",
  "requiresHumanReview": false
}
\`\`\``;

// ─── Briefing Runner ───────────────────────────────────────────────────────────

export async function runStrategicCoreBriefing(
  campaignId: string,
  workspaceId: string,
  profile: ProfileBuilderOutput | null,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<StrategicBrief> {
  const profileBlock = profile
    ? `
**Inteligência de Perfil (Profile Builder — use como base):**

USP: ${profile.product?.usp ?? ""}
Mecanismo único: ${profile.positioning?.uniqueMechanism ?? ""}
Big Idea: ${profile.positioning?.campaignBigIdea ?? ""}
Elevator Pitch: ${profile.positioning?.elevatorPitch ?? ""}

Avatar primário — ${profile.primaryAvatar?.name ?? "Avatar"}:
- Desejo mais profundo: ${profile.primaryAvatar?.deepestDesire ?? ""}
- Nível de consciência: ${profile.primaryAvatar?.awarenessLevel ?? ""}
- Sofisticação: ${profile.primaryAvatar?.sophisticationLevel ?? ""}
- Objeções típicas: ${(profile.primaryAvatar?.typicalObjections ?? []).slice(0, 4).join("; ")}
- O que os faz confiar: ${(profile.primaryAvatar?.whatMakesThemTrust ?? []).slice(0, 3).join("; ")}
- Keywords que usam: ${(profile.primaryAvatar?.keywordsTheyUse ?? []).slice(0, 5).join(", ")}

Mercado — maturidade: ${profile.marketIntelligence?.maturity ?? ""} | concorrência: ${profile.marketIntelligence?.competitionLevel ?? ""}
Oportunidades: ${(profile.marketIntelligence?.opportunities ?? []).slice(0, 3).join("; ")}
Red flags: ${(profile.marketIntelligence?.redFlags ?? []).slice(0, 3).join("; ")}

Segmentos:
${(profile.segments ?? []).map((s) => `- ${s.name} [${s.priority}]: ${s.messageAngle}`).join("\n")}

Score PMF: ${profile.profileScore ?? 0}/100
Avisos de validação: ${(profile.validationWarnings ?? []).join("; ") || "nenhum"}
Insights críticos: ${(profile.criticalInsights ?? []).join("; ")}`
    : "(Perfil não disponível — baseie-se nos dados de intake abaixo)";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategic_core",
    systemPrompt: STRATEGIC_CORE_BRIEFING_PROMPT,
    messages: [
      {
        role: "user",
        content: `Gere o Brief Estratégico Global para esta campanha.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Categoria:** ${String(intakeData["product.category"] ?? "")}
**Preço:** R$${String(intakeData["product.price"] ?? 0)}
**Meta de faturamento:** R$${String(intakeData["campaign.revenueTarget"] ?? 0)}
**Track:** ${String(intakeData["campaign.revenueTrack"] ?? "")}
**Tipo de campanha:** ${String(intakeData["campaign.type"] ?? "")}
**Canal de vendas:** ${String(intakeData["campaign.salesChannel"] ?? "")}
**Duração:** ${String(intakeData["campaign.durationDays"] ?? "")} dias
**Tom:** ${String(intakeData["content.tone"] ?? "")}

${profileBlock}

Com base no perfil do produto e nos dados de intake, gere o Brief Estratégico Global completo.
Este brief será lido por TODOS os agentes especializados — inclusive o Agente de Estratégia.
Seja específico: inclua promessas PERMITIDAS e PROIBIDAS com base nos dados reais do produto.
Inclua limites LEGAIS específicos para este setor/categoria.
Inclua critérios de sucesso mensuráveis.
Defina requiresHumanReview=true se houver qualquer risco sério.

Retorne APENAS o JSON do Brief Estratégico Global.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Analisando perfil do produto e avatar primário...",
      "Definindo identidade estratégica da campanha...",
      "Mapeando promessas permitidas e proibidas...",
      "Estabelecendo limites éticos e legais...",
      "Emitindo scores de consistência, risco e confiança...",
    ],
  });

  return parseAgentJSON<StrategicBrief>(result.content, {
    campaignId,
    campaignObjective: String(intakeData["campaign.revenueTarget"]
      ? `Gerar R$${intakeData["campaign.revenueTarget"]} em ${intakeData["campaign.durationDays"] ?? 7} dias`
      : "Executar campanha com sucesso"),
    primaryAvatar: profile?.primaryAvatar.name ?? "",
    centralPain: profile?.primaryAvatar.typicalObjections[0] ?? "",
    dominantDesire: profile?.primaryAvatar.deepestDesire ?? "",
    uniqueMechanism: profile?.positioning.uniqueMechanism ?? "",
    permittedPromises: [],
    prohibitedPromises: ["garantir resultado específico de renda", "prometer retorno em prazo fixo sem base"],
    tone: String(intakeData["content.tone"] ?? "direto, autoridade, linguagem de praticante"),
    language: "",
    channels: [],
    acquisitionStrategy: "",
    retentionStrategy: "",
    urgencyLevel: "media",
    ethicalBoundaries: [],
    legalBoundaries: ["respeitar LGPD na coleta de dados", "não fazer claims médicos ou financeiros sem comprovação"],
    successCriteria: [],
    valueProposition: profile?.positioning.elevatorPitch ?? "",
    positioning: profile?.positioning.campaignBigIdea ?? "",
    bigDomino: profile?.primaryAvatar.deepestDesire ?? "",
    dominantTrigger: "",
    emotionalPains: [],
    mainObjections: profile?.primaryAvatar.typicalObjections ?? [],
    differentials: [],
    funnelStage: "",
    consistencyScore: 75,
    riskScore: 25,
    confidenceScore: 0.75,
    requiresHumanReview: false,
    coreWarnings: profile?.validationWarnings ?? [],
  });
}

// ─── Validation Runner ─────────────────────────────────────────────────────────

export async function runStrategicCoreValidation(
  campaignId: string,
  workspaceId: string,
  agentRole: string,
  agentOutput: Record<string, unknown>,
  strategicBrief: StrategicBrief,
  log: Logger,
): Promise<ValidationReport> {
  const briefContext = `**BRIEF ESTRATÉGICO GLOBAL:**
- Objetivo: ${strategicBrief.campaignObjective}
- Avatar: ${strategicBrief.primaryAvatar}
- Dor central: ${strategicBrief.centralPain}
- Desejo dominante: ${strategicBrief.dominantDesire}
- Tom: ${strategicBrief.tone}
- Posicionamento: ${strategicBrief.positioning}
- UVP: ${strategicBrief.valueProposition}
- Linguagem: ${strategicBrief.language}
- Big Domino: ${strategicBrief.bigDomino}
- Mecanismo único: ${strategicBrief.uniqueMechanism}
- Gatilho dominante: ${strategicBrief.dominantTrigger}
- Promessas PERMITIDAS: ${strategicBrief.permittedPromises.join("; ") || "ver differentials"}
- Promessas PROIBIDAS: ${strategicBrief.prohibitedPromises.join("; ") || "nenhuma listada"}
- Limites éticos: ${strategicBrief.ethicalBoundaries.join("; ") || "nenhum listado"}
- Limites legais: ${strategicBrief.legalBoundaries.join("; ") || "nenhum listado"}
- Critérios de sucesso: ${strategicBrief.successCriteria.join("; ") || "não definidos"}
- Avisos do Strategic Core: ${strategicBrief.coreWarnings.join("; ") || "nenhum"}`;

  // idempotencyKeyOverride includes the validated agentRole so each validation of a
  // different agent gets a distinct C3 key — avoids silent skip when called multiple times.
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategic_core_validation",
    idempotencyKeyOverride: `${campaignId}:strategic_core_validation:${agentRole}`,
    systemPrompt: STRATEGIC_CORE_VALIDATION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Valide o output do agente "${agentRole}" contra o Brief Estratégico Global.

${briefContext}

**OUTPUT DO AGENTE A VALIDAR:**
\`\`\`json
${JSON.stringify(agentOutput, null, 2).slice(0, 3000)}
\`\`\`

Identifique: contradições, drift narrativo, promessas proibidas, violações éticas ou legais, inconsistências com avatar/posicionamento.

Retorne APENAS o JSON do relatório de validação.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      `Validando output do agente ${agentRole} contra o brief global...`,
      "Verificando promessas permitidas e proibidas...",
      "Verificando limites éticos e legais...",
      "Analisando drift narrativo e consistência...",
    ],
  });

  return parseAgentJSON<ValidationReport>(result.content, {
    agentId: agentRole,
    agentRole,
    consistencyScore: 75,
    riskScore: 25,
    confidenceScore: 0.75,
    flaggedIssues: [],
    driftWarnings: [],
    approvalStatus: "approved_with_warnings",
    approvalRationale: result.content,
    requiresHumanReview: false,
  });
}
