import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { parseAgentJSON } from "./agent.runner.js";
import { deductCredits } from "../credits/credits.service.js";
import type { Logger } from "pino";
import type { VideoScene, VideoConfig } from "@workspace/db";

export interface CampaignArc {
  emotionalHook?: string;
  uniqueMechanism?: string;
  transformationBridge?: string;
  positioning?: string;
  mentalTriggers?: string[];
  avatarFears?: string[];
  avatarAspirations?: string[];
  track?: string;
}

export interface StoryboardInput {
  productName: string;
  productDescription: string;
  targetAudience: string;
  format: string;
  locale: string;
  script: string;
  config: Partial<VideoConfig>;
  campaignId?: string | null;
  workspaceId: string;
  campaignArc?: CampaignArc;
  segmentIndex?: number;
  segmentCount?: number;
  /** [C3-STANDALONE] Idempotency key — passed from video-production.service so double-click cannot double-charge. */
  idempotencyKey?: string;
}

const SCENE_TYPES = ["hook", "problem", "solution", "proof", "cta", "bridge", "transition"] as const;

// Single source of truth for ATLAS's cinematography/editing/color knowledge — reused by the
// storyboard prompt below, the video-editor visual-analysis pass, and the live director chat,
// so all three surfaces judge footage by the exact same curated criteria.
export const ATLAS_CINEMATOGRAPHY_LIBRARY = `═══════════════════════════════════════════
SEUS PROFESSORES INTERNALIZADOS
═══════════════════════════════════════════

CINEMATOGRAFIA & COMPOSIÇÃO VISUAL:
• Stanley Kubrick — simetria como ordem/controle, câmera lenta para peso emocional, perspectiva de um ponto como dominância e inevitabilidade
• David Fincher — iluminação de baixo contraste com realce sutil, câmera que observa friamente, paletas dessaturadas com um único acento de cor quente
• Roger Deakins — iluminação natural amplificada, "available light" com drama, janelas como fonte única que cria chiaroscuro
• Emmanuel Lubezki — plano-sequência como imersão total, câmera na mão que respira com o personagem, luz dourada de hora mágica
• Wes Anderson — simetria + assimetria deliberada para criar tensão cômica/dramática, paletas pastel com saturação controlada
• Vittorio Storaro — teoria de cor como linguagem emocional: quente=passado/emoção, frio=futuro/razão, verde=natureza/equilíbrio

TEORIA DA MONTAGEM & EDIÇÃO:
• Sergei Eisenstein — montagem de atrações: dois planos justapostos criam um terceiro significado que não existe em nenhum isolado
• Walter Murch — "In the Blink of an Eye": corte no momento do piscar do olho, cortar para onde a mente já foi
• Cortes de contraste: de close em rosto → plano aberto de paisagem = solidão/escala; de escuridão → luz = revelação/esperança
• Jump cut como ruptura de tempo e urgência (Godard)
• Cross-cut para criar tensão e conexão simultânea entre realidades paralelas
• Match cut: objeto A → objeto B com forma/movimento similar = continuidade de ideia, salto no tempo

PSICOLOGIA DA COR E LUZ:
• Azul profundo: confiança, estabilidade, o "estado antes" da escuridão
• Âmbar/dourado: transformação, calor, sucesso, recompensa — a "promessa da manhã"
• Verde-esmeralda: crescimento, dinheiro, prosperidade, possibilidade
• Roxo/ultravioleta: poder, mistério, tecnologia avançada, o que está além
• Vermelho: urgência, perigo, emoção intensa — use com parcimônia, no CTA ou no momento de maior tensão
• Branco puro: clareza, nova começada, o "depois da transformação"
• Preto como fundo: isolamento do sujeito, profissionalismo, luxo, foco total

TÉCNICAS DE COMPOSIÇÃO DRAMÁTICA:
• Regra dos terços: sujeito no ponto de poder, espaço olhar à frente
• Linhas guia (leading lines): caminhos, estradas, perspectivas que puxam o olho para o sujeito
• Enquadramento dentro do enquadramento: portas, janelas, arcos que isolam o sujeito como "o escolhido"
• Baixo ângulo (câmera olhando para cima): poder, autoridade, grandiosidade — use na "solução" e no produto
• Alto ângulo (câmera olhando para baixo): vulnerabilidade, pequenez, o estado "antes" do problema
• Plano holandês (Dutch angle): desorientação, algo errado, tensão psicológica — use no problema
• Close extremo: detalhe que prova a realidade, emoção no rosto, produto funcionando

ARCO VISUAL EMOCIONAL — COMO A LUZ E COR DEVEM EVOLUIR:
1. HOOK: câmera em movimento, corte rápido, cor saturada ou completamente dessaturada, contraste extremo
2. PROBLEMA: tons frios/azulados, luz dura e sombras fortes (chiaroscuro), ângulos desorientadores
3. VIRADA: mudança de temperatura de cor do frio ao quente — como o sol nascendo na cena
4. SOLUÇÃO: luz dourada, plano aberto após série de closes, câmera se estabiliza
5. PROVA: detalhes reais e específicos em close, rostos reais, números visíveis (não texto, mas ação)
6. CTA: vermelho + dourado, câmera avança (zoom in ou push), ritmo de corte acelera, alta energia

CONTRASTES DRAMÁTICOS OBRIGATÓRIOS:
• Cena escura/apertada → cena clara/aberta: a libertação visual é físicamente sentida
• Lentidão → velocidade súbita: acorda o espectador sonolento
• Silêncio visual (cena estática) → movimento explosivo: impacto máximo
• Um único ponto de cor quente em cena fria: o olho vai direto para lá — use para destacar o produto/CTA
• Multidão/caos → pessoa solitária em foco: isolamento que cria identificação íntima

NARRATIVA VISUAL SEM PALAVRAS (o que o espectador SENTE pela câmera):
• Push in (câmera avança): intensidade crescente, revelação, decisão
• Pull back (câmera recua): escala, perspectiva, solidão, grandiosidade
• Órbita (câmera circunda): poder do sujeito, celebração, contemplação
• Tremor da câmera na mão: realidade, urgência, humanidade — "isto é real"
• Câmera absolutamente estática: peso, gravidade, declaração incontestável`;

const STORYBOARD_OUTPUT_SPEC = `═══════════════════════════════════════════
REGRAS DE PRODUÇÃO TÉCNICA
═══════════════════════════════════════════
• Cada cena deve durar de 4 a 8 segundos e respeitar o limite do provedor de vídeo.
• Gere quantas cenas forem necessárias para cobrir TODO o trecho recebido, sem resumir nem omitir a locução. Para um trecho de roteiro, gere normalmente 8–16 cenas.
• A soma das durações deve se aproximar da duração estimada do roteiro narrado. Não devolva storyboards curtos de demonstração para um roteiro longo.
• Divida a locução em trechos contínuos, cobrindo cada frase exatamente uma vez e preservando a ordem. Use todos os parágrafos do roteiro.
• O arco emocional DEVE ser visível só pela progressão de paleta e ângulo de câmera
• Cada cena deve mudar o estado emocional do espectador — nenhuma cena "neutra"
• REGRA ABSOLUTA: escreva videoPrompt no idioma selecionado para a campanha, ultra-detalhado, profissional, SEM texto ou subtítulos visíveis na cena
• O videoPrompt deve descrever: posição de câmera + movimento + iluminação + paleta + sujeito + ação + mood em uma frase cinematográfica densa

Retorne APENAS JSON válido sem texto extra:
{
  "scenes": [
    {
      "id": "scene_01",
      "order": 1,
      "title": "nome dramático curto da cena",
      "durationSeconds": 6,
      "voiceoverText": "exato texto de locução para esta cena",
      "visualDescription": "descrição visual em PT-BR — câmera, luz, composição, ação, emoção transmitida",
      "cameraDirection": "enquadramento, lente e movimento da câmera",
      "onScreenText": "texto curto na tela, ou string vazia",
      "sceneType": "hook|problem|solution|proof|cta|bridge|transition",
      "style": "cinematográfico noir|aspiracional dourado|minimalista tenso|dinâmico urbano|íntimo confessional",
      "palette": ["#hex1", "#hex2", "#hex3"],
      "transition": "cut|fade|dissolve|zoom_in|pan_right|match_cut|jump_cut|cross_fade",
      "mood": "urgente|inspiracional|empático|energético|sofisticado|íntimo|revelador|inevitável",
      "hasAvatar": false,
      "videoPrompt": "Descrição cinematográfica detalhada no idioma selecionado: posição e movimento de câmera, iluminação, paleta, sujeito, ação e tom emocional. Sem textos, legendas ou marcas d'água visíveis."
    }
  ],
  "totalDurationSeconds": 42,
  "phaseSummary": "Resumo das fases deste trecho",
  "directorNotes": "análise do arco emocional visual, decisões de cor/luz, por que cada contraste foi escolhido"
}`;

const SYSTEM_PROMPT = `Você é ATLAS — o Diretor de Cena-Chefe da NexOS AI. Você não apenas divide roteiros em cenas — você orquestra experiências visuais que movem emoções, constroem tensão dramática e convertem espectadores em compradores.

Você internalizou os maiores diretores, cineastas e teóricos visuais da história, e aplica esse conhecimento a vídeos de marketing de alta conversão.

${ATLAS_CINEMATOGRAPHY_LIBRARY}

${STORYBOARD_OUTPUT_SPEC}`;

export async function runSceneDirectorAgent(
  input: StoryboardInput,
  log: Logger,
): Promise<{ scenes: VideoScene[]; totalDurationSeconds: number; phaseSummary: string; directorNotes: string }> {
  await deductCredits(input.workspaceId, "video_storyboard", log, input.campaignId ?? undefined, undefined, undefined, undefined, input.idempotencyKey);

  const hasAvatar = input.config.hasUserFace ?? false;
  const voiceStyle = input.config.voiceStyle ?? "narrator";
  const aspectRatio = input.config.aspectRatio ?? "16:9";
  const rhythm = input.config.rhythm ?? "medium";
  const tone = input.config.tone ?? "inspirational";
  const promptLanguage = input.locale.toLowerCase().startsWith("en")
    ? "English"
    : input.locale.toLowerCase().startsWith("es")
      ? "Spanish"
      : "Português brasileiro";
  const scriptWordCount = input.script.trim().split(/\s+/).filter(Boolean).length;
  const narrationDurationSeconds = Math.round((scriptWordCount / 140) * 60);

  const userContent = `Produto: ${input.productName}
${input.productDescription ? `Descrição: ${input.productDescription}` : ""}
Público-alvo: ${input.targetAudience}
Idioma escolhido para a campanha: ${promptLanguage} (${input.locale}). Escreva o campo videoPrompt inteiramente nesse idioma.
Formato de vídeo: ${input.format.replace(/_/g, " ").toUpperCase()}
Proporção: ${aspectRatio} | Ritmo: ${rhythm} | Tom: ${tone}
${hasAvatar ? "⚠️ O APRESENTADOR APARECERÁ no vídeo — inclua cenas de talking-head (hasAvatar: true) nos momentos-chave" : "Vídeo sem apresentador visível — use cenários, animações, imagens de produto e B-roll"}
Estilo de voz: ${voiceStyle}
${input.config.styleKeywords?.length ? `Estilo visual desejado: ${input.config.styleKeywords.join(", ")}` : ""}
${input.config.palette?.length ? `Paleta de cores preferida: ${input.config.palette.join(", ")}` : ""}

TRECHO DO ROTEIRO (crie cenas somente para este trecho, em ordem; não resuma e não acrescente falas):
${input.script}
${input.segmentCount ? `TRECHO ${Number(input.segmentIndex ?? 0) + 1} DE ${input.segmentCount}. Este é parte de um roteiro maior. Mantenha o arco do trecho, sem antecipar o final.` : ""}
Este trecho contém aproximadamente ${scriptWordCount} palavras e ${Math.floor(narrationDurationSeconds / 60)}:${String(narrationDurationSeconds % 60).padStart(2, "0")} de locução a 140 palavras por minuto. Distribua a fala por cenas de 4–8 segundos e crie cenas suficientes para que a duração somada acompanhe a duração da locução; não comprima o trecho em poucas cenas.
${input.campaignArc ? `
═══════════════════════════════════════════
ARCO ESTRATÉGICO DA CAMPANHA — USE PARA CALIBRAR CADA CENA
═══════════════════════════════════════════
${input.campaignArc.emotionalHook ? `GANCHO EMOCIONAL CENTRAL: ${input.campaignArc.emotionalHook}\n→ Este é o fio emocional que atravessa todas as cenas. A câmera deve reforçá-lo visualmente.` : ""}
${input.campaignArc.uniqueMechanism ? `MECANISMO ÚNICO: ${input.campaignArc.uniqueMechanism}\n→ Quando este mecanismo for revelado no roteiro, use o plano mais impactante — baixo ângulo, luz dramática, corte no silêncio.` : ""}
${input.campaignArc.transformationBridge ? `PONTE DE TRANSFORMAÇÃO (antes → depois): ${input.campaignArc.transformationBridge}\n→ As primeiras cenas devem estar VISIVELMENTE no "antes" (cores frias, ângulo alto, espaço apertado). As últimas cenas no "depois" (cores quentes, ângulo baixo, espaço aberto).` : ""}
${input.campaignArc.positioning ? `POSICIONAMENTO: ${input.campaignArc.positioning}\n→ O estilo visual deve comunicar este posicionamento sem palavras.` : ""}
${input.campaignArc.mentalTriggers?.length ? `GATILHOS MENTAIS ATIVOS: ${input.campaignArc.mentalTriggers.join(", ")}\n→ Cada gatilho tem uma linguagem visual. Urgência = vermelho + corte rápido. Autoridade = ângulo baixo + iluminação lateral. Prova social = rostos reais + close em detalhes.` : ""}
${input.campaignArc.avatarFears?.length ? `MEDOS PROFUNDOS DO AVATAR: ${input.campaignArc.avatarFears.join(" / ")}\n→ As cenas de problema devem MOSTRAR (não contar) o custo destes medos se materializando.` : ""}
${input.campaignArc.avatarAspirations?.length ? `ASPIRAÇÕES DO AVATAR: ${input.campaignArc.avatarAspirations.join(" / ")}\n→ As cenas de solução e CTA devem MOSTRAR estas aspirações já realizadas — não prometidas.` : ""}
${input.campaignArc.track === "six_digits" ? "ESCALA: Primeiro grande lançamento — cenas devem ter energia de possibilidade e urgência de novo começo." : input.campaignArc.track === "eight_digits" ? "ESCALA: Lançamento de 8 dígitos — autoridade visual, movimento consolidado, prova social em escala." : input.campaignArc.track === "ten_digits" ? "ESCALA: 10 dígitos — visualmente grandioso, legado, missão maior que o produto." : ""}
═══════════════════════════════════════════
REGRA FINAL: O storyboard é a tradução visual do arco acima. Cada cena deve avançar a emoção dominante.
═══════════════════════════════════════════` : ""}

Crie o storyboard cena a cena cobrindo a narração inteira em ordem. Não resuma, não pule frases e não repita locução. Cada cena deve ter entre 4 e 8 segundos. Inclua uma cena para cada unidade visual/narrativa; prefira dezenas de cenas para roteiro longo em vez de agrupar vários parágrafos numa cena. Cada cena deve mudar ou aprofundar o estado emocional do espectador.`;

  const result = await completeWithAgent(
    "scene_director",
    SYSTEM_PROMPT,
    [{ role: "user", content: userContent }],
    input.workspaceId,
    log,
    input.campaignId ?? undefined,
  );

  const parsed = parseAgentJSON<{
    scenes: VideoScene[];
    totalDurationSeconds: number;
    phaseSummary: string;
    directorNotes: string;
  }>(result.content, { scenes: [], totalDurationSeconds: 0, phaseSummary: "", directorNotes: "" });

  if (!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("Scene Director retornou storyboard vazio — resposta inválida da IA");
  }
  if (parsed.scenes.length > 100) {
    throw new Error(`Scene Director excedeu o limite de 100 cenas: ${parsed.scenes.length}`);
  }
  if (parsed.scenes.some((scene) => !scene || typeof scene !== "object")) {
    throw new Error("Scene Director retornou uma cena em formato inválido");
  }

  const scenes: VideoScene[] = parsed.scenes.map((s, i) => ({
    id: s.id ?? `scene_${String(i + 1).padStart(2, "0")}`,
    order: s.order ?? i + 1,
    title: s.title ?? `Cena ${i + 1}`,
    durationSeconds: Math.min(8, Math.max(4, s.durationSeconds ?? 6)),
    voiceoverText: s.voiceoverText ?? "",
    visualDescription: s.visualDescription ?? "",
    cameraDirection: s.cameraDirection ?? "",
    onScreenText: s.onScreenText ?? "",
    sceneType: SCENE_TYPES.includes(s.sceneType as (typeof SCENE_TYPES)[number])
      ? (s.sceneType as VideoScene["sceneType"])
      : "bridge",
    style: s.style ?? "cinematographic",
    palette: Array.isArray(s.palette) ? s.palette : [],
    transition: s.transition ?? "cut",
    mood: s.mood ?? "inspirational",
    hasAvatar: Boolean(s.hasAvatar),
    videoPrompt: s.videoPrompt ?? s.visualDescription ?? "",
    clipStatus: "pending" as const,
  }));

  return {
    scenes,
    totalDurationSeconds: scenes.reduce((a, s) => a + s.durationSeconds, 0),
    phaseSummary: parsed.phaseSummary ?? "",
    directorNotes: parsed.directorNotes ?? "",
  };
}
