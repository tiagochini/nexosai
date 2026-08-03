/**
 * NEXOS AI — Emotional Coherence Checker
 *
 * Reads all generated content pieces for a campaign and verifies that
 * the Campaign Emotional Arc progression is being respected across pieces.
 *
 * The coherence gap it solves:
 *   Each agent generates with the same psychological profile.
 *   But nobody checks if CPL3 actually delivers "visão de solução",
 *   if the live script picks up where CPL3 left off, or if the
 *   ad copy is creating the right emotional entry state for the funnel.
 *
 * Result stored in campaignsTable.brainData.coherenceReport (persistent, survives restart).
 * Awaited after content generation — result is visible to founder in approval UI
 * via GET /campaigns/:id/content/coherence.
 */

import { eq } from "drizzle-orm";
import { db, campaignsTable, contentPiecesTable } from "@workspace/db";
import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { CampaignEmotionalArc } from "./campaign-emotional-arc.agent.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoherenceIssue {
  pieceType: string;
  severity: "critical" | "warning" | "info";
  expectedPhase: string;
  detectedState: string;
  description: string;
  fix: string;
}

export interface PhaseCoherence {
  phase: string;
  phaseName: string;
  piecesResponsible: string[];
  score: number;
  status: "aligned" | "partial" | "broken";
  note?: string;
}

export interface CoherenceReport {
  campaignId: string;
  generatedAt: string;
  overallScore: number;
  verdict: "excellent" | "good" | "needs_attention" | "broken";
  piecesReviewed: number;
  issues: CoherenceIssue[];
  phaseCoherence: PhaseCoherence[];
  missingPhases: string[];
  recommendations: string[];
  winningStrengths: string[];
}

// ─── Content-piece → arc-phase mapping ───────────────────────────────────────

const PIECE_TYPE_TO_PHASES: Record<string, string[]> = {
  cpl_script:        ["identificacao", "amplificacao_de_dor", "visao_de_solucao"],
  live_script:       ["prova", "tensao_de_decisao"],
  webinar_script:    ["prova", "tensao_de_decisao"],
  landing_page:      ["desejo", "prova", "tensao_de_decisao", "urgencia"],
  vsl_script:        ["curiosidade", "identificacao", "amplificacao_de_dor", "visao_de_solucao", "desejo", "prova", "tensao_de_decisao", "urgencia"],
  ad_copy:           ["curiosidade", "identificacao"],
  social_media:      ["curiosidade", "identificacao", "amplificacao_de_dor"],
  stories_sequence:  ["curiosidade", "identificacao", "amplificacao_de_dor", "visao_de_solucao", "desejo", "prova", "urgencia"],
  email_sequence:    ["identificacao", "amplificacao_de_dor", "visao_de_solucao", "desejo", "prova", "urgencia"],
  offer:             ["desejo", "prova", "tensao_de_decisao"],
  creative_concept:  ["curiosidade"],
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

const COHERENCE_CHECKER_PROMPT = `Você é o Auditor de Coerência Emocional da campanha.

Sua missão: verificar se as peças de conteúdo geradas respeitam a progressão emocional planejada no Arco Emocional da campanha.

O problema que você resolve: quando cada agente gera sua peça isolado, a campanha pode perder a progressão narrativa. O CPL3 pode soar igual ao CPL2. A live pode presumir que o avatar está pronto para comprar quando ele ainda está na fase de identificação. O carrinho pode ativar urgência antes de ter construído prova suficiente.

## COMO ANALISAR

Para cada tipo de peça, verifique:
1. A linguagem usada corresponde ao estado emocional esperado para aquela fase?
2. O nível de crença exigido pela peça é compatível com o beliefLevel da fase?
3. A peça está tentando avançar o avatar para o estado certo ou para o estado errado?
4. Existe continuidade narrativa entre as peças sequenciais?
5. Alguma fase do arco está completamente sem cobertura?

## CRITÉRIOS DE SEVERIDADE

- **critical**: Peça opera no estado emocional completamente errado (ex: live de carrinho pedindo para o avatar acreditar que o problema existe — isso é CPL1, não live)
- **warning**: Peça está no estado certo mas usa linguagem de uma fase diferente (ex: CPL2 usando urgência de fechamento)
- **info**: Oportunidade de fortalecer a coerência sem erro grave

## SAÍDA ESPERADA (JSON válido):

\`\`\`json
{
  "overallScore": 82,
  "verdict": "good",
  "issues": [
    {
      "pieceType": "live_script",
      "severity": "warning",
      "expectedPhase": "prova",
      "detectedState": "A live ainda está construindo identificação em vez de entregar prova social e abrir o carrinho com autoridade",
      "description": "A live está gastando tempo amplificando a dor (fase CPL2) quando deveria estar na fase 'prova' — apresentando resultados de outros compradores e eliminando objeções de decisão",
      "fix": "Os primeiros 10 minutos da live devem assumir que o avatar já acredita no problema. Iniciar com prova social massiva (casos de sucesso reais) e só então partir para a tensão de decisão"
    }
  ],
  "phaseCoherence": [
    {
      "phase": "curiosidade",
      "phaseName": "Curiosidade",
      "piecesResponsible": ["ad_copy", "social_media"],
      "score": 90,
      "status": "aligned",
      "note": "Anúncios e posts criam curiosidade sem revelar a solução — correto"
    }
  ],
  "missingPhases": ["alivio_pos_compra"],
  "recommendations": [
    "Adicionar pelo menos 1 email de pós-compra reforçando que a decisão foi certa — eliminará dissonância cognitiva"
  ],
  "winningStrengths": [
    "A sequência CPL1→CPL2→CPL3 respeita perfeitamente a progressão de crença — cada CPL aumenta beliefLevel sem queimar a solução"
  ]
}
\`\`\`

Retorne APENAS JSON válido.`;

// ─── Summarizer ───────────────────────────────────────────────────────────────

function summarizePieceForAudit(piece: { type: string; content: unknown }): string {
  const c = piece.content as Record<string, unknown> | null;
  if (!c) return `[${piece.type}] — sem conteúdo`;

  const parts: string[] = [`## PEÇA: ${piece.type.toUpperCase()}`];

  // Extract key signals depending on piece type
  if (piece.type === "cpl_script") {
    const videos = (c["videos"] as any[]) ?? [];
    videos.slice(0, 4).forEach((v: any) => {
      parts.push(`CPL${v.videoNumber}: "${v.title}" — Objetivo: ${v.objective} | Hook: ${v.hook?.slice(0, 120)}`);
      parts.push(`  psychologicalJob: ${v.psychologicalJob}`);
      parts.push(`  viewerFeeling: ${v.viewerFeeling}`);
    });
  } else if (piece.type === "live_script") {
    parts.push(`Título: ${String(c["title"] ?? "")}`);
    parts.push(`Objetivo: ${String(c["mainObjective"] ?? "")}`);
    const segments = (c["segments"] as any[]) ?? [];
    segments.slice(0, 3).forEach((s: any) => parts.push(`  Segmento "${s.name}": ${String(s.emotionalGoal ?? s.script ?? "").slice(0, 150)}`));
  } else if (piece.type === "ad_copy") {
    const ads = (c["adSets"] as any[]) ?? [];
    ads.slice(0, 3).forEach((ad: any) => parts.push(`  Anúncio: ${ad.objective} | Hook: ${String(ad.primaryText ?? "").slice(0, 120)}`));
  } else if (piece.type === "landing_page") {
    parts.push(`Headline: ${String((c["hero"] as any)?.headline ?? c["headline"] ?? "")}`);
    parts.push(`Subheadline: ${String((c["hero"] as any)?.subheadline ?? "").slice(0, 120)}`);
  } else if (piece.type === "stories_sequence") {
    const seqs = (c["sequences"] as any[]) ?? [];
    seqs.slice(0, 4).forEach((s: any) => {
      parts.push(`  Sequência "${s.name}" (${s.phase}): objetivo=${s.emotionalObjective?.slice(0, 100)}`);
    });
  } else if (piece.type === "social_media") {
    const posts = (c["posts"] as any[]) ?? [];
    posts.slice(0, 4).forEach((p: any) => parts.push(`  Post dia ${p.dayIndex} (${p.phase}): ${String(p.caption ?? p.hook ?? "").slice(0, 100)}`));
  } else if (piece.type === "vsl_script" || piece.type === "webinar_script") {
    parts.push(`Título: ${String(c["title"] ?? "")}`);
    parts.push(`Objetivo: ${String(c["mainObjective"] ?? c["objective"] ?? "").slice(0, 150)}`);
    const sections = (c["sections"] as any[]) ?? [];
    sections.slice(0, 3).forEach((s: any) => parts.push(`  Seção "${s.name}": ${String(s.emotionalPurpose ?? s.script ?? "").slice(0, 120)}`));
  } else {
    // Generic summary
    const str = JSON.stringify(c).slice(0, 400);
    parts.push(str);
  }

  return parts.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runEmotionalCoherenceCheck(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<CoherenceReport | null> {
  try {
    // Load campaign + arc (arc lives in brainData.emotionalArc, not intakeData)
    const [campaign] = await db
      .select({
        intakeData: campaignsTable.intakeData,
        brainData: campaignsTable.brainData,
      })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);

    if (!campaign) return null;

    const brainData = (campaign.brainData ?? {}) as Record<string, unknown>;
    const arc = brainData["emotionalArc"] as CampaignEmotionalArc | undefined;

    if (!arc?.phases?.length) {
      log.info({ campaignId }, "Coherence check skipped — no emotional arc present");
      return null;
    }

    // Load all content pieces
    const pieces = await db
      .select({
        id: contentPiecesTable.id,
        type: contentPiecesTable.type,
        content: contentPiecesTable.content,
      })
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.campaignId, campaignId));

    if (!pieces.length) {
      log.info({ campaignId }, "Coherence check skipped — no content pieces found");
      return null;
    }

    // Build the audit context
    const arcContext = [
      `## ARCO EMOCIONAL DA CAMPANHA`,
      `Resumo: ${arc.arcSummary}`,
      ``,
      `### FASES E ESTADOS ESPERADOS:`,
      ...arc.phases.map(p =>
        `**${p.name}** (${p.phase}): beliefLevel=${p.beliefLevel} | resistência=${p.resistanceLevel} | temp=${p.buyingTemperature}\n` +
        `  Pergunta dominante: "${p.mainInternalQuestion}"\n` +
        `  Objetivo: ${p.objective}\n` +
        `  Diretrizes: ${p.copyDirectives?.slice(0, 2).join("; ")}`
      ),
      ``,
      `### REGRAS DE COERÊNCIA:`,
      ...(arc.emotionalCoherenceRules ?? []).map((r, i) => `${i + 1}. ${r}`),
    ].join("\n");

    const pieceSummaries = pieces.map(summarizePieceForAudit).join("\n\n---\n\n");

    const pieceTypeMap = pieces.map(p => `${p.type}: fases esperadas = ${(PIECE_TYPE_TO_PHASES[p.type] ?? ["não mapeado"]).join(", ")}`).join("\n");

    const userMessage = `${arcContext}

## MAPEAMENTO PEÇA → FASE ESPERADA:
${pieceTypeMap}

## PEÇAS GERADAS PARA AUDITORIA:

${pieceSummaries}

Audite a coerência emocional desta campanha. Verifique se cada peça opera no estado emocional correto para sua fase e se a progressão do arco é mantida entre as peças.`;

    const result = await runAgent({
      campaignId,
      workspaceId,
      agentRole: "emotional_coherence_checker",
      systemPrompt: COHERENCE_CHECKER_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      log,
    });

    const parsed = parseAgentJSON<Omit<CoherenceReport, "campaignId" | "generatedAt" | "piecesReviewed">>(
      result.content,
      {
        overallScore: 0,
        verdict: "needs_attention",
        issues: [],
        phaseCoherence: [],
        missingPhases: [],
        recommendations: [],
        winningStrengths: [],
      },
    );

    const report: CoherenceReport = {
      ...parsed,
      campaignId,
      generatedAt: new Date().toISOString(),
      piecesReviewed: pieces.length,
    };

    // Persist to brainData (durable, survives restarts, readable via GET /content/coherence)
    const currentBrain = (campaign.brainData ?? {}) as Record<string, unknown>;
    await db
      .update(campaignsTable)
      .set({ brainData: { ...currentBrain, coherenceReport: report } as any })
      .where(eq(campaignsTable.id, campaignId));

    log.info(
      { campaignId, score: report.overallScore, verdict: report.verdict, issues: report.issues.length },
      "Emotional coherence check complete",
    );

    return report;
  } catch (err) {
    log.error({ err, campaignId }, "Emotional coherence check failed — non-blocking");
    return null;
  }
}
