/**
 * Social Profile Analyzer Agent
 *
 * Analisa o perfil público de uma rede social usando Gemini com Google Search grounding.
 * Compara o estado atual do perfil com os objetivos comerciais do workspace.
 * Funciona ANTES da conexão OAuth — só precisa do handle público.
 */

import type { Logger } from "pino";
import { env } from "../../lib/env.js";

export interface SocialProfileAnalysis {
  platform: string;
  handle: string;
  analyzedAt: string;

  // Visão geral do perfil
  overview: {
    bio: string;
    estimatedFollowers: string;
    followingCount: string;
    postFrequency: string;         // ex: "3–5 posts/semana"
    accountAge: string;            // estimativa
    verified: boolean | null;
  };

  // Performance de conteúdo
  contentAnalysis: {
    dominantFormats: string[];     // ex: ["reels", "carrosséis", "stories"]
    topThemes: string[];           // ex: ["motivação", "bastidores", "dicas práticas"]
    avgEngagementSignal: string;   // ex: "alto", "médio", "baixo" (baseado em sinal qualitativo)
    bestPerformingContent: string; // descrição dos posts que mais performam
    visualStyle: string;           // estilo visual predominante
    captionStyle: string;          // tom e extensão das legendas
  };

  // Análise estratégica
  strategicAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];             // concorrentes, saturação de nicho etc.
  };

  // Gap vs objetivos comerciais
  gapAnalysis: {
    alignmentScore: number;        // 0-10: quão alinhado está o perfil com os objetivos
    criticalGaps: string[];
    quickWins: string[];           // o que pode ser mudado imediatamente para gerar resultado
  };

  // Plano de ação
  actionPlan: {
    immediate: string[];           // próximos 7 dias
    shortTerm: string[];           // próximos 30 dias
    longTerm: string[];            // próximos 90 dias
    contentCalendarHint: string;   // sugestão de mix de conteúdo semanal
  };

  // Dados brutos do Gemini para debug
  rawGeminiText?: string;
  searchSourced: boolean;         // true se Gemini usou Google Search
}

// ─── Análise de Perfil via Gemini + Google Search ────────────────────────────

export async function analyzeSocialProfile(
  platform: "instagram" | "facebook" | "tiktok" | "linkedin" | "youtube",
  handle: string,
  businessContext: string,
  log: Logger,
): Promise<SocialProfileAnalysis> {
  const cleanHandle = handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?[^/]+\//, "").replace(/\/$/, "");
  const platformUrl = buildProfileUrl(platform, cleanHandle);

  const systemPrompt = buildSystemPrompt(platform, cleanHandle, platformUrl, businessContext);

  const geminiKey = env.GEMINI_API_KEY || env.AI_INTEGRATIONS_GEMINI_API_KEY;

  // Modelos com suporte a Google Search grounding
  const searchModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  let rawText = "";
  let searchSourced = false;

  if (geminiKey) {
    for (const modelId of searchModels) {
      try {
        log.info({ platform, handle: cleanHandle, model: modelId }, "social-profile-analyzer: chamando Gemini com Google Search");

        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }], role: "user" }],
              tools: [{ google_search: {} }],
              generationConfig: {
                responseMimeType: "text/plain",
                temperature: 0.3,
                maxOutputTokens: 4096,
              },
            }),
            signal: AbortSignal.timeout(60_000),
          },
        );

        if (geminiResp.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = await geminiResp.json() as any;
          const parts = data?.candidates?.[0]?.content?.parts ?? [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textPart = parts.find((p: any) => typeof p.text === "string");
          if (textPart?.text?.length > 100) {
            rawText = textPart.text as string;
            searchSourced = true;
            log.info({ model: modelId, chars: rawText.length }, "social-profile-analyzer: Gemini respondeu com search ✓");
            break;
          }
        } else {
          const errText = await geminiResp.text().catch(() => "");
          log.warn({ model: modelId, status: geminiResp.status, errText: errText.slice(0, 200) }, "social-profile-analyzer: Gemini falhou — tentando próximo modelo");
        }
      } catch (err) {
        log.warn({ err, modelId }, "social-profile-analyzer: erro ao chamar Gemini");
      }
    }
  }

  // Fallback: Gemini sem search (análise baseada em conhecimento do modelo)
  if (!rawText && geminiKey) {
    try {
      log.info({ platform, handle: cleanHandle }, "social-profile-analyzer: usando Gemini sem search como fallback");
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }], role: "user" }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
          signal: AbortSignal.timeout(45_000),
        },
      );
      if (geminiResp.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await geminiResp.json() as any;
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => typeof p.text === "string");
        if (textPart?.text?.length > 100) rawText = textPart.text as string;
      }
    } catch (fallbackErr) {
      log.warn({ fallbackErr }, "social-profile-analyzer: fallback Gemini sem search também falhou");
    }
  }

  const parsed = parseAnalysisJSON(rawText, platform, cleanHandle);
  parsed.searchSourced = searchSourced;
  parsed.rawGeminiText = rawText.slice(0, 2000); // truncar para debug
  return parsed;
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildProfileUrl(platform: string, handle: string): string {
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${handle}/`;
    case "facebook":  return `https://www.facebook.com/${handle}`;
    case "tiktok":    return `https://www.tiktok.com/@${handle}`;
    case "linkedin":  return `https://www.linkedin.com/in/${handle}`;
    case "youtube":   return `https://www.youtube.com/@${handle}`;
    default:          return `https://www.${platform}.com/${handle}`;
  }
}

function buildSystemPrompt(platform: string, handle: string, profileUrl: string, businessContext: string): string {
  return `Você é um estrategista sênior de social media com acesso à internet.

Sua tarefa: pesquisar e analisar o perfil ${platform.toUpperCase()} de @${handle} (${profileUrl}) e produzir um relatório estratégico comparando o estado atual do perfil com os objetivos comerciais abaixo.

## OBJETIVOS COMERCIAIS DO CLIENTE
${businessContext || "Não informado — faça uma análise geral de posicionamento e crescimento."}

## INSTRUÇÕES
1. Pesquise o perfil público usando Google Search. Busque por "@${handle} ${platform}", "${handle} ${platform}", posts recentes, mentions, reviews.
2. Analise o conteúdo público disponível: bio, posts recentes, temas, tom, frequência, engajamento aparente.
3. Compare o estado atual com os objetivos comerciais.
4. Identifique gaps críticos e oportunidades de crescimento rápido.
5. Produza um plano de ação concreto e específico (não genérico).

## REGRAS
- Seja específico e cirúrgico: nomes de posts, temas reais encontrados, comparações concretas.
- Não invente dados. Se não encontrou algo, diga "não encontrado publicamente" — não estime falsamente.
- O plano de ação deve ser adaptado ao negócio específico, não um template genérico.
- Se o perfil for privado ou não encontrado, explique e faça uma análise de nicho/concorrentes.

## FORMATO DE SAÍDA
Retorne APENAS JSON válido (sem markdown, sem blocos de código, sem texto extra):
{
  "overview": {
    "bio": "string — bio encontrada ou 'não encontrada publicamente'",
    "estimatedFollowers": "string — ex: '~12k' ou 'não encontrado'",
    "followingCount": "string",
    "postFrequency": "string — ex: '3–5 posts/semana' ou 'esporádico'",
    "accountAge": "string — estimativa ou 'não encontrado'",
    "verified": null
  },
  "contentAnalysis": {
    "dominantFormats": ["string"],
    "topThemes": ["string"],
    "avgEngagementSignal": "alto|médio|baixo|não encontrado",
    "bestPerformingContent": "string — descrição do tipo de conteúdo que mais engaja",
    "visualStyle": "string — estilo visual predominante",
    "captionStyle": "string — tom e extensão das legendas"
  },
  "strategicAnalysis": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "opportunities": ["string"],
    "threats": ["string"]
  },
  "gapAnalysis": {
    "alignmentScore": 7,
    "criticalGaps": ["string"],
    "quickWins": ["string"]
  },
  "actionPlan": {
    "immediate": ["string — ação concreta para os próximos 7 dias"],
    "shortTerm": ["string — ação para os próximos 30 dias"],
    "longTerm": ["string — ação para os próximos 90 dias"],
    "contentCalendarHint": "string — sugestão de mix semanal ideal"
  }
}`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseAnalysisJSON(rawText: string, platform: string, handle: string): SocialProfileAnalysis {
  const base: SocialProfileAnalysis = {
    platform,
    handle,
    analyzedAt: new Date().toISOString(),
    overview: {
      bio: "Não encontrado",
      estimatedFollowers: "Não encontrado",
      followingCount: "Não encontrado",
      postFrequency: "Não encontrado",
      accountAge: "Não encontrado",
      verified: null,
    },
    contentAnalysis: {
      dominantFormats: [],
      topThemes: [],
      avgEngagementSignal: "não encontrado",
      bestPerformingContent: "Não encontrado",
      visualStyle: "Não encontrado",
      captionStyle: "Não encontrado",
    },
    strategicAnalysis: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
    gapAnalysis: { alignmentScore: 0, criticalGaps: [], quickWins: [] },
    actionPlan: { immediate: [], shortTerm: [], longTerm: [], contentCalendarHint: "" },
    searchSourced: false,
  };

  if (!rawText) return base;

  try {
    // Extrair JSON balanceado do texto
    const start = rawText.indexOf("{");
    if (start === -1) return base;
    let depth = 0;
    let end = start;
    for (let i = start; i < rawText.length; i++) {
      if (rawText[i] === "{") depth++;
      if (rawText[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    const jsonStr = rawText.slice(start, end + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(jsonStr) as any;

    return {
      ...base,
      overview: { ...base.overview, ...(parsed.overview ?? {}) },
      contentAnalysis: { ...base.contentAnalysis, ...(parsed.contentAnalysis ?? {}) },
      strategicAnalysis: { ...base.strategicAnalysis, ...(parsed.strategicAnalysis ?? {}) },
      gapAnalysis: { ...base.gapAnalysis, ...(parsed.gapAnalysis ?? {}) },
      actionPlan: { ...base.actionPlan, ...(parsed.actionPlan ?? {}) },
    };
  } catch {
    return base;
  }
}
