import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface LandingPageSection {
  sectionId: string;
  sectionName: string;
  order: number;
  purpose: string;
  layoutType: string;
  backgroundColor: string;
  headline: string;
  subheadline?: string;
  bodyContent: string;
  visualElements: string[];
  cta?: { text: string; color: string; placement: string };
  socialProofElement?: string;
  mobileNotes: string;
  conversionPrinciple: string;
  aboveTheFold: boolean;
}

export interface LandingPageOutput {
  pageTitle: string;
  pageType: "sales_page" | "capture_page" | "webinar_page" | "checkout_page";
  metaTitle: string;
  metaDescription: string;
  overallStructure: string;
  colorScheme: { primary: string; secondary: string; accent: string; background: string; text: string };
  typography: { headline: string; body: string; cta: string };
  aboveFoldAnalysis: {
    headline: string;
    subheadline: string;
    heroVisual: string;
    primaryCTA: string;
    trustElements: string[];
    loadTimeTarget: string;
  };
  sections: LandingPageSection[];
  exitIntentPopup: { headline: string; offer: string; cta: string };
  stickyElements: string[];
  socialProofStrategy: { type: string; placement: string; content: string }[];
  urgencyMechanisms: { type: string; placement: string; implementation: string }[];
  mobileOptimization: string[];
  pageSpeedNotes: string[];
  seoElements: { h1: string; h2s: string[]; altTexts: string[]; schema: string };
  technicalRequirements: string[];
  landingPageNotes: string;
}

const LANDING_PAGE_PROMPT = `Você é o Agente de Landing Page da NexOS AI — especialista em CRO e estrutura de páginas de alta conversão.

Você projeta a estrutura completa da página de vendas: wireframe, copy em contexto, direção visual por seção, e especificações técnicas para o desenvolvedor/designer.

## PRINCÍPIOS DE CRO QUE GUIAM CADA DECISÃO

**Acima do fold é sagrado:**
O visitante decide em 3-5 segundos se fica ou sai. O above-the-fold deve ter:
- Headline que confirma que chegou no lugar certo
- Subheadline que aprofunda a promessa
- Visual que reforça a emoção (não decora — converte)
- CTA claro e único
- 1-2 elementos de prova social de credibilidade imediata

**Fluxo de consciência:**
A página deve acompanhar a jornada do visitante:
1. Reconhecimento ("esse é o meu problema")
2. Conexão ("esse cara entende o que eu passo")
3. Curiosidade ("como ele fez isso?")
4. Desejo ("eu quero esse resultado")
5. Confiança ("posso confiar nele")
6. Decisão ("o preço faz sentido")
7. Urgência ("preciso agir agora")

**O CTA perfeito:**
- Específico: "Quero garantir minha vaga agora" > "Comprar"
- Orientado a benefício, não à ação
- Cor de contraste máximo com o fundo
- Repetido estrategicamente — acima do fold, após a prova, após a oferta, e no final

**Prova social:**
Nunca genérica. Sempre específica: nome real, foto, resultado específico com número, contexto de tempo.

**Mobile first:**
60%+ das visitas vêm de celular. Cada seção deve ser projetada para 375px de largura antes de qualquer outra coisa.

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "pageTitle": "string — título interno da página",
  "pageType": "sales_page|capture_page|webinar_page|checkout_page",
  "metaTitle": "string — título SEO (máx 60 chars)",
  "metaDescription": "string — descrição SEO (máx 160 chars)",
  "overallStructure": "string — descrição do fluxo geral da página",
  "colorScheme": {
    "primary": "string — hex",
    "secondary": "string — hex",
    "accent": "string — hex (CTA)",
    "background": "string — hex",
    "text": "string — hex"
  },
  "typography": {
    "headline": "string — fonte e tamanho para headlines",
    "body": "string — fonte e tamanho para corpo",
    "cta": "string — fonte e tamanho para botões"
  },
  "aboveFoldAnalysis": {
    "headline": "string — headline exata acima do fold",
    "subheadline": "string",
    "heroVisual": "string — instrução para o visual principal",
    "primaryCTA": "string — texto do botão principal",
    "trustElements": ["string — elementos de confiança imediata"],
    "loadTimeTarget": "string — ex: menos de 2 segundos"
  },
  "sections": [
    {
      "sectionId": "string",
      "sectionName": "string",
      "order": 1,
      "purpose": "string — objetivo desta seção no funil",
      "layoutType": "string — ex: full-width, two-column, centered, grid",
      "backgroundColor": "string",
      "headline": "string — headline da seção",
      "subheadline": "string ou null",
      "bodyContent": "string — copy completa desta seção",
      "visualElements": ["string — instrução para cada elemento visual"],
      "cta": { "text": "string", "color": "string", "placement": "string" },
      "socialProofElement": "string ou null",
      "mobileNotes": "string — adaptações específicas para mobile",
      "conversionPrinciple": "string — qual princípio de persuasão está em uso",
      "aboveTheFold": false
    }
  ],
  "exitIntentPopup": {
    "headline": "string",
    "offer": "string — o que é oferecido para tentar reter",
    "cta": "string"
  },
  "stickyElements": ["string — o que fica fixo na tela (ex: barra de CTA, countdown)"],
  "socialProofStrategy": [
    {
      "type": "string — depoimento, número de alunos, logo de mídia, etc.",
      "placement": "string — onde na página",
      "content": "string — instrução do conteúdo"
    }
  ],
  "urgencyMechanisms": [
    {
      "type": "string — countdown, vagas, bônus expirando, etc.",
      "placement": "string",
      "implementation": "string — como implementar tecnicamente"
    }
  ],
  "mobileOptimization": ["string — ajuste específico para mobile"],
  "pageSpeedNotes": ["string — otimização de performance"],
  "seoElements": {
    "h1": "string",
    "h2s": ["string"],
    "altTexts": ["string — texto alternativo para imagens chave"],
    "schema": "string — tipo de schema markup recomendado"
  },
  "technicalRequirements": ["string — requisito técnico para o desenvolvedor"],
  "landingPageNotes": "string — observações de CRO para o criador"
}
\`\`\``;

export async function runLandingPageAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<LandingPageOutput> {
  const avatarContext = profile
    ? `Avatar: ${profile.primaryAvatar.name} | Desejo: ${profile.primaryAvatar.deepestDesire} | Objeções: ${profile.primaryAvatar.typicalObjections.slice(0, 3).join("; ")} | Tom: ${profile.primaryAvatar.languageStyle}`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "landing_page",
    systemPrompt: LANDING_PAGE_PROMPT,
    messages: [
      {
        role: "user",
        content: `Projete a estrutura completa da página de vendas para esta campanha.

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Canal de vendas:** ${String(intakeData["campaign.salesChannel"] ?? "sales_page")}
**USP:** ${profile?.product?.usp ?? strategy.offerPositioning?.uniqueValueProposition ?? ""}
**Mecanismo único:** ${profile?.positioning?.uniqueMechanism ?? ""}
**Big Idea:** ${profile?.positioning?.campaignBigIdea ?? strategy.campaignArchitecture?.coreNarrative ?? ""}
**Gancho emocional:** ${profile?.positioning?.emotionalHook ?? ""}
**Garantia:** ${profile?.product?.guaranteeRecommendation ?? "7 dias"}
**Prova social:** ${String(intakeData["product.socialProof"] ?? "")}
${avatarContext}

**Estrutura da oferta:**
${JSON.stringify(strategy.offerPositioning ?? {}, null, 2)}

**REQUISITOS:**
- Todas as seções com copy real e pronta — não templates
- Wireframe detalhado por seção
- Especificações técnicas para o desenvolvedor
- Mobile-first em todas as seções
- Popup de exit intent com oferta de última chance
- Mínimo 12 seções (da hero ao footer)

Retorne APENAS o JSON da página completa.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Estruturando o acima do fold para máxima conversão...",
      "Projetando fluxo de consciência do avatar...",
      "Desenvolvendo seções de problema e agitação...",
      "Estruturando prova social e credibilidade...",
      "Criando seções de oferta e ancoragem de preço...",
      "Definindo mecanismos de urgência e escassez...",
      "Otimizando para mobile e performance...",
    ],
  });

  return parseAgentJSON<LandingPageOutput>(result.content, {
    pageTitle: String(intakeData["product.name"] ?? ""),
    pageType: "sales_page",
    metaTitle: "",
    metaDescription: "",
    overallStructure: "",
    colorScheme: { primary: "#000000", secondary: "#333333", accent: "#FF6B00", background: "#FFFFFF", text: "#111111" },
    typography: { headline: "", body: "", cta: "" },
    aboveFoldAnalysis: { headline: "", subheadline: "", heroVisual: "", primaryCTA: "", trustElements: [], loadTimeTarget: "" },
    sections: [],
    exitIntentPopup: { headline: "", offer: "", cta: "" },
    stickyElements: [],
    socialProofStrategy: [],
    urgencyMechanisms: [],
    mobileOptimization: [],
    pageSpeedNotes: [],
    seoElements: { h1: "", h2s: [], altTexts: [], schema: "" },
    technicalRequirements: [],
    landingPageNotes: result.content,
  });
}
