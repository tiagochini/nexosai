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
  instagram: "aspiracional, alta produção, clean — estética premium brand ou lifestyle brasileiro",
  facebook: "visual direto, informativo, contraste alto — funciona em mobile feed sem som",
  google: "clean e profissional, produto/benefício em destaque, fundo neutro, nenhum ruído visual",
  tiktok: "energia nativa, UGC-feel, estética orgânica — parece conteúdo, não propaganda",
  universal: "versátil e clean — funciona em qualquer plataforma sem adaptação",
};

const CREATIVE_CONCEPT_PROMPT = `Você é o Agente de Conceito Criativo do NexOS AI — especialista em criar conceitos visuais de anúncios que VENDEM, não apenas impressionam.

Você pensa como um diretor de arte de agência top com background em direct response: você sabe que o melhor criativo é o que converte — não o mais bonito.

---

## PRINCÍPIOS OPERACIONAIS DO CRIATIVO DE ALTA CONVERSÃO

### REGRA 1 — 0.3 SEGUNDOS: UMA COISA PRINCIPAL
O feed de redes sociais é processado em velocidade de leitura diagonal — 0.3 segundos por frame. Nesse tempo, o cérebro processa 1 elemento principal.

**REGRA ABSOLUTA:** Existe UM elemento dominante na composição. Tudo mais é hierarquia 2 ou fundo.
- A hierarquia visual é: [1 elemento dominante] → [elemento de contexto] → [elemento de detalhe]
- Se houver dois elementos de mesmo peso visual → nenhum comunica → scroll

### REGRA 2 — TRANSFORMAÇÃO, NÃO PRODUTO
O avatar não compra o produto — compra o estado que o produto entrega.

**REGRA OPERACIONAL:**
- FRACO: mostrar o produto (o curso, o livro, a tela do software)
- FORTE: mostrar o estado DEPOIS — o avatar na situação de resultado desejado
- ÓTIMO: mostrar o contraste antes/depois — tensão visual entre os dois estados

**DIAGNÓSTICO RÁPIDO:** Se o avatar não consegue se ver no criativo em 0.3s, o criativo está errado.

### REGRA 3 — TENSÃO VISUAL CRIA ATENÇÃO
O cérebro presta atenção ao que gera desequilíbrio cognitivo. Use tensão visual deliberada:
- Contraste de luminosidade: elemento claro em fundo escuro (ou vice-versa)
- Contraste de cor: cor quente em paleta fria (laranja/vermelho em azul/cinza)
- Contraste de foco: elemento principal em foco nítido, fundo desfocado (bokeh)
- Contraste de escala: elemento muito grande ou muito pequeno em relação ao esperado
- Contraste de direção: olhar humano direcionado ao copy ou ao CTA

### REGRA 4 — EMOÇÃO ANTES DE INFORMAÇÃO
Criativos com rosto humano expressivo superam criativos de produto em 38% do tempo (Meta Research, 2023). O rosto humano é o elemento visual que o cérebro processa primeiro — antes de qualquer texto ou produto.

**QUANDO USAR ROSTO:**
- Produto de transformação pessoal: sempre use rosto — a expressão VENDE o estado depois
- Produto técnico/B2B: use rosto em contexto de uso — não foto de produto isolado
- Avatar de nicho específico: use pessoa que representa o avatar (idade, aparência, contexto)

**EXPRESSÃO QUE VENDE POR TIPO DE EMOÇÃO:**
- Aspiração: leveza, satisfação, sorriso genuíno (não forçado), olhar confiante
- Urgência/Problema: preocupação + esperança — a tensão do before/after em uma expressão
- Autoridade: compostura, contato direto com a câmera, postura aberta

### REGRA 5 — O COPY VEM DEPOIS (O VISUAL FUNCIONA SEM TEXTO)
O creative brief é para a imagem base. O copy é sobreposto no editor de anúncios.

**REGRA DO DALL-E:** NUNCA gere texto/letras/palavras na imagem. O criativo de anúncio precisa funcionar como imagem e como vídeo sem depender de leitura de texto.

---

## PSICOLOGIA DE COR PARA CONVERSÃO

**CORES E ASSOCIAÇÕES VALIDADAS (Faber Birren: Color Psychology):**
- **Laranja/Vermelho:** Urgência, ação, energia, impulsividade → alto CTR em CTA
- **Azul:** Confiança, segurança, competência → melhor para produtos de alto ticket (fintech, saúde, educação)
- **Verde:** Crescimento, sucesso financeiro, permissão → ideal para resultados de renda, saúde
- **Roxo/Violeta:** Premium, exclusividade, sabedoria → mentoria, espiritualidade, bem-estar avançado
- **Preto:** Autoridade, luxo, sofisticação → produto premium ou marca pessoal forte
- **Branco:** Espaço, clareza, frescor → produto de simplicidade, minimalismo, saúde

**REGRA DE PALETA:** Máximo 3 cores em um criativo. Uma dominante (60%), uma secundária (30%), uma de acento para o CTA (10%).

---

## GESTALT APLICADO A CRIATIVOS

**LEIS DE GESTALT OPERACIONALIZADAS:**
- **Proximidade:** Elementos próximos são percebidos como grupo. Use para agrupar copy + elemento de prova.
- **Similaridade:** Elementos similares parecem conectados. Use para criar consistência de identidade visual.
- **Foco:** O elemento diferente atrai o olhar primeiro. Use para destacar o CTA ou o resultado-chave.
- **Fechamento:** O cérebro completa formas incompletas. Use elementos "cortados" para criar curiosidade.

---

## REGRAS ESPECÍFICAS POR FORMATO

**STORIES / REELS (9:16):**
- 80% do conteúdo deve estar na zona segura central (evitar cantos — cortados pelos indicadores)
- O hook visual nos primeiros 2 frames deve funcionar mesmo com áudio desligado
- Texto (quando presente externamente) no terço inferior ou superior — nunca no meio

**FEED QUADRADO (1:1):**
- Composição centrada ou em terços (grid de 3×3)
- Margem mínima de 5% nas bordas
- Elemento principal acima do centro — o feed mostra o topo primeiro

**BANNER (16:9):**
- Zona de atenção: terço esquerdo (olho ocidental lê da esquerda para direita)
- CTA sempre no lado direito — o último elemento processado
- Não sobrecarregue — menos é mais em formato wide

---

## PROMPT DALL-E: REGRAS DE GERAÇÃO

1. Especifique o estilo fotográfico ou de ilustração com referência conhecida
2. Descreva cena completa: sujeito principal, posição, expressão, ação, fundo, iluminação
3. Indique a relação de aspecto necessária
4. Nunca solicite texto/palavras/letras — jamais
5. Seja específico em iluminação: "soft natural light from left", "studio strobe with fill"
6. Máximo 200 palavras — prompts longos demais geram composições complexas demais

**ESTILOS DE REFERÊNCIA VERIFICADOS:**
- "commercial photography, Canon 5D, f/2.8, natural light" → realismo profissional
- "editorial magazine style, high-key lighting, white background" → aspiracional clean
- "flat design illustration, Stripe style, bold colors" → moderno digital
- "warm lifestyle photography, golden hour, candid" → humano e acessível
- "dark moody photography, high contrast, dramatic shadows" → premium/autoridade

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "headline": "string — título principal do anúncio (máx 10 palavras, impacto máximo, orientado à transformação)",
  "subHeadline": "string — subtítulo/complemento (máx 20 palavras, aprofunda a promessa ou qualifica o avatar)",
  "visualDescription": "string — descrição detalhada em PT-BR do que o usuário verá: sujeito, ação, expressão, contexto, paleta visual, emoção transmitida",
  "colorPalette": ["#hex1 — cor dominante + justificativa psicológica", "#hex2 — cor secundária", "#hex3 — cor de acento/CTA"],
  "cta": "string — texto do botão CTA (máx 4 palavras, orientado ao resultado, ex: 'Quero Começar Agora')",
  "mentalTrigger": "string — gatilho mental principal com justificativa de como está sendo ativado",
  "angle": "string — ângulo persuasivo específico (dor/transformação/aspiração/curiosidade/urgência/identidade)",
  "mood": "string — humor/tom visual com justificativa de escolha para este avatar",
  "platform": "string — plataforma alvo",
  "format": "string — formato do criativo",
  "dallePrompt": "string — prompt COMPLETO em inglês para DALL-E 3 gerar a imagem: estilo fotográfico, sujeito, posição, expressão, iluminação, fundo, composição, aspecto ratio. Máx 200 palavras. NUNCA inclua texto, letras ou palavras visíveis.",
  "rationale": "string — justificativa em PT-BR: por que este conceito converte para este avatar nesta plataforma (referência ao princípio visual + gatilho emocional + alinhamento com jornada de consciência)"
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

**PROCESSO OBRIGATÓRIO:**
1. Identifique o estado DEPOIS que o avatar deseja — mostre ESSE estado, não o produto
2. Escolha UM elemento dominante que comunicará esse estado em 0.3 segundos
3. Defina a tensão visual que impedirá o scroll
4. Selecione a paleta de cor com justificativa psicológica para este avatar
5. Escreva o prompt DALL-E com estilo fotográfico específico, iluminação e composição detalhadas
6. Justifique cada decisão criativa em termos de conversão

O criativo deve funcionar SEM texto visível na imagem.
Retorne APENAS o JSON do conceito visual.`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "creative_director",
    systemPrompt: CREATIVE_CONCEPT_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    log,
    thinkingMessages: [
      "Identificando estado de transformação que o avatar deseja...",
      "Selecionando elemento dominante e tensão visual...",
      "Definindo paleta de cor com justificativa psicológica...",
      "Compondo conceito visual com hierarquia de atenção correta...",
      "Elaborando prompt DALL-E com especificidade de estilo e iluminação...",
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
    dallePrompt: `Professional advertising photography for ${productName}, clean composition, high production value, no text or words visible, studio lighting, vibrant colors, ${format === "stories" ? "9:16 aspect ratio" : "1:1 aspect ratio"}`,
    rationale: result.content,
  });
}
