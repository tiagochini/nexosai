import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface DesignToken {
  name: string;
  value: string;
  usage: string;
}

export interface CreativeDirectorOutput {
  campaignTitle: string;
  visualIdentity: {
    concept: string;
    moodboard: string;
    aesthetic: string;
    references: string[];
    antiReferences: string[];
  };
  colorSystem: {
    primary: DesignToken;
    secondary: DesignToken;
    accent: DesignToken;
    background: DesignToken;
    surface: DesignToken;
    text: DesignToken;
    textMuted: DesignToken;
    success: DesignToken;
    warning: DesignToken;
    error: DesignToken;
    gradients: { name: string; value: string; usage: string }[];
  };
  typography: {
    displayFont: { family: string; weights: string[]; usage: string; googleFontsUrl: string };
    bodyFont: { family: string; weights: string[]; usage: string; googleFontsUrl: string };
    accentFont: { family: string; usage: string; googleFontsUrl: string };
    scaleDesktop: { name: string; size: string; lineHeight: string; weight: string }[];
    scaleMobile: { name: string; size: string; lineHeight: string; weight: string }[];
  };
  iconography: {
    style: string;
    library: string;
    usage: string;
  };
  photography: {
    style: string;
    colorGrading: string;
    subjectGuidelines: string;
    backgroundGuidelines: string;
    doExamples: string[];
    dontExamples: string[];
  };
  videoStyle: {
    pace: string;
    colorGrading: string;
    transitions: string;
    textAnimations: string;
    musicStyle: string;
    captionStyle: string;
  };
  layoutPrinciples: {
    gridSystem: string;
    spacing: string;
    borderRadius: string;
    shadows: string;
    hierarchy: string;
  };
  componentLibrary: {
    primaryButton: { background: string; text: string; border: string; borderRadius: string; fontSize: string; padding: string };
    secondaryButton: { background: string; text: string; border: string; borderRadius: string; fontSize: string; padding: string };
    card: { background: string; border: string; borderRadius: string; shadow: string };
    badge: { variants: { name: string; background: string; text: string }[] };
  };
  socialMediaTemplates: {
    platform: string;
    format: string;
    gridRatio: string;
    safeZone: string;
    coverImageSpec: string;
  }[];
  doAndDonts: {
    dos: string[];
    donts: string[];
  };
  creativeDirectorNotes: string;
}

const CREATIVE_DIRECTOR_PROMPT = `Você é o Agente de Direção Criativa da NexOS AI — especialista em identidade visual para campanhas de produtos digitais.

Você cria o sistema visual completo da campanha: paleta de cores, tipografia, estilo fotográfico, regras de layout e componentes. Tudo derivado da psicologia do avatar e do posicionamento da oferta.

## A RELAÇÃO ENTRE POSICIONAMENTO E VISUAL

A identidade visual não é escolha estética — é comunicação estratégica.

**Exemplos de como o posicionamento determina o visual:**
- Premium/luxury + avatar executivo → tons escuros, dourado/champagne, fonte serif, layouts minimalistas
- Transformação pessoal + avatar 30-40 anos + emocional → cores quentes, imagens de pessoas reais, fonte arredondada
- Educação/método + avatar técnico → azuis, verdes, branco, diagramas, fontes claras e legíveis
- Urgência/escassez + avatar sensível a perda → vermelho/laranja, countdown visual, fontes bold

**Seus entregáveis são usados por:**
- Designers criando as artes da campanha
- Editores de vídeo montando os materiais
- Desenvolvedores construindo a página de vendas
- O criador gravando suas lives e stories

Portanto tudo precisa ser específico e aplicável — não conceitual.

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "visualIdentity": {
    "concept": "string — conceito visual em 1-2 frases",
    "moodboard": "string — descrição detalhada do moodboard (como se estivesse descrevendo as imagens)",
    "aesthetic": "string — o estilo visual em uma palavra ou expressão",
    "references": ["string — referências culturais/marcas com visual similar"],
    "antiReferences": ["string — o que NÃO deve se parecer"]
  },
  "colorSystem": {
    "primary": { "name": "Primary", "value": "#000000", "usage": "string" },
    "secondary": { "name": "Secondary", "value": "#000000", "usage": "string" },
    "accent": { "name": "Accent", "value": "#000000", "usage": "CTAs, destaques, elementos de urgência" },
    "background": { "name": "Background", "value": "#000000", "usage": "string" },
    "surface": { "name": "Surface", "value": "#000000", "usage": "string" },
    "text": { "name": "Text", "value": "#000000", "usage": "string" },
    "textMuted": { "name": "Text Muted", "value": "#000000", "usage": "string" },
    "success": { "name": "Success", "value": "#000000", "usage": "string" },
    "warning": { "name": "Warning", "value": "#000000", "usage": "string" },
    "error": { "name": "Error", "value": "#000000", "usage": "string" },
    "gradients": [{ "name": "string", "value": "string — CSS gradient", "usage": "string" }]
  },
  "typography": {
    "displayFont": {
      "family": "string",
      "weights": ["400", "700"],
      "usage": "string",
      "googleFontsUrl": "string"
    },
    "bodyFont": {
      "family": "string",
      "weights": ["400", "500"],
      "usage": "string",
      "googleFontsUrl": "string"
    },
    "accentFont": {
      "family": "string",
      "usage": "string",
      "googleFontsUrl": "string"
    },
    "scaleDesktop": [
      { "name": "Display XL", "size": "72px", "lineHeight": "1.1", "weight": "700" }
    ],
    "scaleMobile": [
      { "name": "Display XL", "size": "40px", "lineHeight": "1.1", "weight": "700" }
    ]
  },
  "iconography": {
    "style": "string — ex: outline, filled, duotone",
    "library": "string — ex: Phosphor Icons, Lucide, Heroicons",
    "usage": "string"
  },
  "photography": {
    "style": "string",
    "colorGrading": "string — ex: warm tones, high contrast, desaturated",
    "subjectGuidelines": "string",
    "backgroundGuidelines": "string",
    "doExamples": ["string"],
    "dontExamples": ["string"]
  },
  "videoStyle": {
    "pace": "string — ritmo de edição",
    "colorGrading": "string",
    "transitions": "string",
    "textAnimations": "string",
    "musicStyle": "string",
    "captionStyle": "string — fonte, tamanho, cor, posição das legendas"
  },
  "layoutPrinciples": {
    "gridSystem": "string",
    "spacing": "string — escala de espaçamento (ex: 4px base)",
    "borderRadius": "string",
    "shadows": "string",
    "hierarchy": "string — como criar hierarquia visual"
  },
  "componentLibrary": {
    "primaryButton": {
      "background": "string",
      "text": "string",
      "border": "string",
      "borderRadius": "string",
      "fontSize": "string",
      "padding": "string"
    },
    "secondaryButton": {
      "background": "string",
      "text": "string",
      "border": "string",
      "borderRadius": "string",
      "fontSize": "string",
      "padding": "string"
    },
    "card": {
      "background": "string",
      "border": "string",
      "borderRadius": "string",
      "shadow": "string"
    },
    "badge": {
      "variants": [{ "name": "string", "background": "string", "text": "string" }]
    }
  },
  "socialMediaTemplates": [
    {
      "platform": "string",
      "format": "string",
      "gridRatio": "string",
      "safeZone": "string",
      "coverImageSpec": "string"
    }
  ],
  "doAndDonts": {
    "dos": ["string"],
    "donts": ["string"]
  },
  "creativeDirectorNotes": "string — diretrizes gerais de aplicação da identidade"
}
\`\`\``;

export async function runCreativeDirectorAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<CreativeDirectorOutput> {
  const positioningContext = profile
    ? `
Posicionamento: ${profile.positioning.campaignBigIdea}
Estética derivada do avatar: ${profile.primaryAvatar.name} — ${profile.primaryAvatar.languageStyle}
Onde o avatar está: ${profile.primaryAvatar.whereTheyHangOut.join(", ")}
Ponto de preço: ${profile.product.pricePoint}
Mood do avatar: desejo = "${profile.primaryAvatar.deepestDesire}" | medo = "${profile.primaryAvatar.fears[0] ?? ""}"`
    : `
Estilo: ${String(intakeData["content.style"] ?? "")}
Tom: ${String(intakeData["content.tone"] ?? "")}`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "creative_director",
    systemPrompt: CREATIVE_DIRECTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie o sistema de identidade visual completo para a campanha.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Categoria:** ${String(intakeData["product.category"] ?? "")}
**Estilo declarado:** ${Array.isArray(intakeData["content.style"]) ? (intakeData["content.style"] as string[]).join(", ") : String(intakeData["content.style"] ?? "")}
**Tom:** ${String(intakeData["content.tone"] ?? "")}
${positioningContext}

**Conteúdo proibido:** ${String(intakeData["content.forbiddenTopics"] ?? "nenhum")}

**REQUISITOS:**
- Sistema de cores completo com hex codes específicos — não descrições vagas como "azul"
- Tipografia: fontes específicas disponíveis no Google Fonts + escala completa
- Regras de fotografia prontas para briefar o fotógrafo
- Estilo de vídeo para briefar o editor
- Componentes de UI prontos para o desenvolvedor (botões, cards, badges)
- Do's and dont's específicos e acionáveis

Retorne APENAS o JSON do sistema visual completo.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Derivando estética visual do posicionamento e avatar...",
      "Construindo sistema de cores com hex codes precisos...",
      "Selecionando tipografia para máxima legibilidade e impacto...",
      "Definindo estilo fotográfico e de vídeo...",
      "Criando componentes UI e regras de layout...",
      "Documentando regras de aplicação e cases de uso...",
    ],
  });

  return parseAgentJSON<CreativeDirectorOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    visualIdentity: { concept: "", moodboard: "", aesthetic: "", references: [], antiReferences: [] },
    colorSystem: {
      primary: { name: "Primary", value: "#000000", usage: "" },
      secondary: { name: "Secondary", value: "#333333", usage: "" },
      accent: { name: "Accent", value: "#FF6B00", usage: "" },
      background: { name: "Background", value: "#FFFFFF", usage: "" },
      surface: { name: "Surface", value: "#F5F5F5", usage: "" },
      text: { name: "Text", value: "#111111", usage: "" },
      textMuted: { name: "Text Muted", value: "#666666", usage: "" },
      success: { name: "Success", value: "#22C55E", usage: "" },
      warning: { name: "Warning", value: "#F59E0B", usage: "" },
      error: { name: "Error", value: "#EF4444", usage: "" },
      gradients: [],
    },
    typography: {
      displayFont: { family: "", weights: [], usage: "", googleFontsUrl: "" },
      bodyFont: { family: "", weights: [], usage: "", googleFontsUrl: "" },
      accentFont: { family: "", usage: "", googleFontsUrl: "" },
      scaleDesktop: [],
      scaleMobile: [],
    },
    iconography: { style: "", library: "", usage: "" },
    photography: { style: "", colorGrading: "", subjectGuidelines: "", backgroundGuidelines: "", doExamples: [], dontExamples: [] },
    videoStyle: { pace: "", colorGrading: "", transitions: "", textAnimations: "", musicStyle: "", captionStyle: "" },
    layoutPrinciples: { gridSystem: "", spacing: "", borderRadius: "", shadows: "", hierarchy: "" },
    componentLibrary: {
      primaryButton: { background: "", text: "", border: "", borderRadius: "", fontSize: "", padding: "" },
      secondaryButton: { background: "", text: "", border: "", borderRadius: "", fontSize: "", padding: "" },
      card: { background: "", border: "", borderRadius: "", shadow: "" },
      badge: { variants: [] },
    },
    socialMediaTemplates: [],
    doAndDonts: { dos: [], donts: [] },
    creativeDirectorNotes: result.content,
  });
}
