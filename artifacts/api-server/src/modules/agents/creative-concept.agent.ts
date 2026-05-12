import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";
import type { CreativeConcept } from "@workspace/db";

const FORMAT_DESCRIPTIONS: Record<string, string> = {
  feed_square: "Post feed quadrado 1:1 (1080×1080px) — Instagram/Facebook",
  feed_portrait: "Post feed retrato 4:5 (1080×1350px) — Instagram Reels/Feed",
  stories: "Stories vertical 9:16 (1080×1920px) — Instagram/Facebook Stories",
  banner: "Banner horizontal 16:9 (1920×1080px) — Google/YouTube/Facebook Cover",
  carousel_slide: "Slide de carrossel 1:1 (1080×1080px) — Instagram/Facebook Carousel",
};

const PLATFORM_STYLE: Record<string, string> = {
  instagram: "estilo visual limpo, aspiracional, alta produção — estética de premium brand ou lifestyle brasileiro",
  facebook: "visual direto, informativo, com contraste alto — funciona bem em mobile feed",
  google: "visual clean e profissional, produto/benefício em destaque, fundo neutro",
  tiktok: "energia jovem, cores vibrantes, estética nativa/UGC, deve parecer orgânico",
  universal: "versátil — funciona em qualquer plataforma, clean e profissional",
};

const CREATIVE_CONCEPT_PROMPT = `Você é o Diretor de Arte da NexOS AI — especialista em criar conceitos visuais de anúncios de alta conversão para o mercado brasileiro de infoprodutos e produtos digitais.

Você pensa como um art director de agência top: você VENDE com imagem, não apenas decora.

## PRINCÍPIOS DO CRIATIVO DE ALTO IMPACTO

1. **O criativo precisa parar o scroll em 0.3 segundos** — existe UMA coisa principal na cena
2. **Mostre a transformação, não o produto** — o lead se vê chegando onde quer estar
3. **Use tensão visual** — contraste claro/escuro, foco/desfoque, cor quente vs. fria
4. **Emoção > informação** — um rosto expressivo ou uma cena de desejo bate mais que bullet points
5. **A copy vai em cima** — o visual precisa funcionar SEM texto (o texto é adicionado depois no editor de anúncios)

## REGRAS PARA O PROMPT DALL-E

- NUNCA inclua texto/palavras/letras visíveis na imagem — o texto é adicionado depois
- Use linguagem descritiva rica em cena, luz, cor e emoção
- Especifique o estilo fotográfico ou de ilustração
- Descreva a composição: o que está em primeiro plano, fundo, ângulo
- Use referências de estilo conhecidas (ex: "fotografia comercial estilo Revolve", "illustration flat design estilo Stripe")
- Inclua a relação de aspecto relevante para o formato
- Máximo 200 palavras no prompt

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "headline": "string — título principal do anúncio (máx 10 palavras, impacto máximo)",
  "subHeadline": "string — subtítulo/complemento (máx 20 palavras)",
  "visualDescription": "string — descrição detalhada em PT-BR do que o usuário verá na imagem",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "cta": "string — texto do botão CTA (máx 4 palavras, ex: Quero Saber Mais)",
  "mentalTrigger": "string — gatilho mental principal (authority/transformation/scarcity/curiosity/social_proof)",
  "angle": "string — ângulo persuasivo (dor/transformação/aspiração/curiosidade/urgência)",
  "mood": "string — humor/tom visual (aspiracional/urgente/empático/celebrativo/profissional)",
  "platform": "string — plataforma alvo",
  "format": "string — formato do criativo",
  "dallePrompt": "string — prompt completo em inglês para DALL-E 3 gerar a imagem (máx 200 palavras, sem texto visível)",
  "rationale": "string — explicação em PT-BR do por que este conceito vai converter"
}
\`\`\``;

export async function runCreativeConceptAgent(
  campaignId: string,
  workspaceId: string,
  platform: string,
  format: string,
  productName: string,
  productDescription: string,
  targetAudience: string,
  requestNote: string,
  log: Logger,
): Promise<CreativeConcept> {
  const formatDesc = FORMAT_DESCRIPTIONS[format] ?? format;
  const platformStyle = PLATFORM_STYLE[platform] ?? "clean e profissional";

  const userMessage = `Crie o conceito visual completo para um anúncio de alta conversão.

**Produto:** ${productName}
**Descrição:** ${productDescription}
**Público-alvo:** ${targetAudience}
**Plataforma:** ${platform} — ${platformStyle}
**Formato:** ${formatDesc}
${requestNote ? `**Briefing adicional:** ${requestNote}` : ""}

Crie um conceito que PARA O SCROLL e gera clique. 
- O visual deve transmitir a TRANSFORMAÇÃO que o produto oferece
- Deve funcionar sem nenhum texto na imagem
- O prompt DALL-E deve ser específico o suficiente para gerar algo profissional

Retorne APENAS o JSON do conceito visual.`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "creative_director",
    systemPrompt: CREATIVE_CONCEPT_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    log,
    thinkingMessages: [
      "Analisando produto e público-alvo...",
      "Definindo ângulo persuasivo e gatilho mental...",
      "Compondo conceito visual com maior potencial de conversão...",
      "Elaborando prompt DALL-E para geração de imagem...",
    ],
  });

  return parseAgentJSON<CreativeConcept>(result.content, {
    headline: productName,
    subHeadline: "",
    visualDescription: "",
    colorPalette: ["#1a1a2e", "#6c63ff", "#ffffff"],
    cta: "Saiba Mais",
    mentalTrigger: "curiosity",
    angle: "transformação",
    mood: "aspiracional",
    platform,
    format,
    dallePrompt: `Professional advertising photography for ${productName}, clean composition, high production value, no text or words visible, studio lighting, vibrant colors`,
    rationale: result.content,
  });
}
