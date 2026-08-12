import { eq, and, desc, gte, isNull, ne } from "drizzle-orm";
import {
  db,
  marketIntelReportsTable,
  campaignsTable,
  type MarketIntelReport,
} from "@workspace/db";
import type { Logger } from "pino";
import {
  runMarketIntelAgent,
  type MarketIntelOutput,
  type MarketIntelExtraContext,
} from "../agents/market-intel.agent.js";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { logger } from "../../lib/logger.js";

export interface MarketIntelAnalyzeInput {
  productName: string;
  market: string;
  productCategory?: string;
  knownCompetitors?: string[];
  currentPositioning?: string;
  priceRange?: string;
  platforms?: string[];
  targetAudience?: string;
}

const REUSE_WINDOW_DAYS = 90;

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listReports(workspaceId: string): Promise<MarketIntelReport[]> {
  return db
    .select()
    .from(marketIntelReportsTable)
    .where(eq(marketIntelReportsTable.workspaceId, workspaceId))
    .orderBy(desc(marketIntelReportsTable.createdAt))
    .limit(100);
}

export async function getReport(
  id: string,
  workspaceId: string,
): Promise<MarketIntelReport | null> {
  const [report] = await db
    .select()
    .from(marketIntelReportsTable)
    .where(
      and(
        eq(marketIntelReportsTable.id, id),
        eq(marketIntelReportsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return report ?? null;
}

export async function deleteReport(id: string, workspaceId: string): Promise<void> {
  await db
    .delete(marketIntelReportsTable)
    .where(
      and(
        eq(marketIntelReportsTable.id, id),
        eq(marketIntelReportsTable.workspaceId, workspaceId),
      ),
    );
}

export async function campaignBelongsToWorkspace(
  campaignId: string,
  workspaceId: string,
): Promise<boolean> {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(
      and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)),
    )
    .limit(1);
  return !!campaign;
}

export async function linkReportToCampaign(
  id: string,
  workspaceId: string,
  campaignId: string,
): Promise<MarketIntelReport | null | "already_linked"> {
  const owned = await campaignBelongsToWorkspace(campaignId, workspaceId);
  if (!owned) return null;

  const [existing] = await db
    .select({ campaignId: marketIntelReportsTable.campaignId })
    .from(marketIntelReportsTable)
    .where(
      and(
        eq(marketIntelReportsTable.id, id),
        eq(marketIntelReportsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!existing) return null;
  if (existing.campaignId && existing.campaignId !== campaignId) {
    return "already_linked";
  }

  const [updated] = await db
    .update(marketIntelReportsTable)
    .set({ campaignId, updatedAt: new Date() })
    .where(
      and(
        eq(marketIntelReportsTable.id, id),
        eq(marketIntelReportsTable.workspaceId, workspaceId),
      ),
    )
    .returning();
  return updated ?? null;
}

/**
 * Most recent UNLINKED (campaignId IS NULL) ready report for the same product
 * in the reuse window. Reports already linked to a campaign are never reused —
 * re-pointing them would silently strip the older campaign's intake context.
 * Product-name match only (min 4 chars) — market-alone matching was too loose.
 */
export async function findRecentReport(
  workspaceId: string,
  productName: string,
): Promise<MarketIntelReport | null> {
  const cutoff = new Date(Date.now() - REUSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const reports = await db
    .select()
    .from(marketIntelReportsTable)
    .where(
      and(
        eq(marketIntelReportsTable.workspaceId, workspaceId),
        eq(marketIntelReportsTable.status, "ready"),
        isNull(marketIntelReportsTable.campaignId),
        gte(marketIntelReportsTable.createdAt, cutoff),
      ),
    )
    .orderBy(desc(marketIntelReportsTable.createdAt))
    .limit(20);

  const norm = (s: string) => s.toLowerCase().trim();
  const p = norm(productName);
  if (p.length < 4) return null;
  return (
    reports.find((r) => {
      const rp = norm(r.productName);
      if (rp.length < 4) return false;
      return rp.includes(p) || p.includes(rp);
    }) ?? null
  );
}

// ─── Analysis lifecycle ──────────────────────────────────────────────────────

/**
 * Creates a report row (status=running) and runs the agent in the background.
 * Returns the created row immediately — the frontend/intake polls for readiness.
 */
export async function startAnalysis(
  workspaceId: string,
  input: MarketIntelAnalyzeInput,
  log: Logger,
  opts?: { campaignId?: string; source?: "manual" | "intake" },
): Promise<MarketIntelReport> {
  const [report] = await db
    .insert(marketIntelReportsTable)
    .values({
      workspaceId,
      campaignId: opts?.campaignId ?? null,
      productName: input.productName,
      market: input.market,
      status: "running",
      input: input as unknown as Record<string, unknown>,
      source: opts?.source ?? "manual",
    })
    .returning();

  if (!report) throw new Error("Falha ao criar relatório de análise de mercado");

  setImmediate(() => {
    executeAnalysis(report.id, workspaceId, input, opts?.campaignId ?? null).catch(
      (err) => log.error({ err, reportId: report.id }, "Market intel analysis crashed"),
    );
  });

  return report;
}

async function executeAnalysis(
  reportId: string,
  workspaceId: string,
  input: MarketIntelAnalyzeInput,
  campaignId: string | null,
): Promise<void> {
  const log = logger.child({ module: "market-intel", reportId });
  try {
    const extra: MarketIntelExtraContext = {
      priceRange: input.priceRange,
      platforms: input.platforms,
      targetAudience: input.targetAudience,
    };
    const output = await runMarketIntelAgent(
      campaignId,
      workspaceId,
      input.market,
      input.productCategory ?? input.productName,
      input.knownCompetitors ?? [],
      input.currentPositioning ?? "não definido ainda",
      log,
      extra,
    );

    await db
      .update(marketIntelReportsTable)
      .set({
        status: "ready",
        output: output as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(marketIntelReportsTable.id, reportId));

    log.info("Market intel report ready");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error({ err }, "Market intel analysis failed");
    await db
      .update(marketIntelReportsTable)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(marketIntelReportsTable.id, reportId))
      .catch(() => {});
  }
}

// ─── Intake hook ─────────────────────────────────────────────────────────────

/**
 * Called from within the intake flow (fire-and-forget) once the intake has
 * enough product/market fields. Reuses a recent report for the same
 * product/niche when available; otherwise starts a fresh analysis linked to
 * the campaign. Returns the report id (existing or new), or null when there
 * isn't enough data yet.
 */
export async function triggerMarketIntelFromIntake(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<string | null> {
  const productName = str(intakeData["product.name"]);
  const description = str(intakeData["product.description"]);
  const audience = str(intakeData["audience.description"]);
  if (!productName || (!description && !audience)) return null;

  // Already linked to this campaign? (failed reports are excluded so the next
  // intake turn retries instead of being stuck on a dead report forever)
  const [existing] = await db
    .select({ id: marketIntelReportsTable.id })
    .from(marketIntelReportsTable)
    .where(
      and(
        eq(marketIntelReportsTable.workspaceId, workspaceId),
        eq(marketIntelReportsTable.campaignId, campaignId),
        ne(marketIntelReportsTable.status, "failed"),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const market = buildMarketDescription(intakeData);

  // Reuse a recent unlinked report for the same product
  const recent = await findRecentReport(workspaceId, productName);
  if (recent) {
    await db
      .update(marketIntelReportsTable)
      .set({ campaignId, updatedAt: new Date() })
      .where(eq(marketIntelReportsTable.id, recent.id))
      .catch(() => {});
    log.info({ reportId: recent.id, campaignId }, "Reusing recent market intel report for intake");
    return recent.id;
  }

  const competitors = str(intakeData["market.competitors"]) ?? str(intakeData["risk.previousCampaigns"]);
  const price = intakeData["product.price"];

  const report = await startAnalysis(
    workspaceId,
    {
      productName,
      market,
      productCategory: str(intakeData["product.category"]) ?? productName,
      knownCompetitors: competitors ? [competitors] : [],
      currentPositioning:
        str(intakeData["creator.uniqueAngle"]) ??
        str(intakeData["creator.positioning"]) ??
        "não definido ainda",
      priceRange: price != null ? `R$${String(price)}` : undefined,
      targetAudience: audience ?? undefined,
    },
    log,
    { campaignId, source: "intake" },
  );

  log.info({ reportId: report.id, campaignId }, "Market intel analysis triggered from intake");
  return report.id;
}

/**
 * Compact context block injected into the intake conversation when a report
 * for this campaign is ready. Includes clarifying questions the agent should
 * weave into the conversation naturally.
 */
export async function buildIntakeMarketIntelContext(
  campaignId: string,
  workspaceId: string,
): Promise<string | null> {
  const [report] = await db
    .select()
    .from(marketIntelReportsTable)
    .where(
      and(
        eq(marketIntelReportsTable.workspaceId, workspaceId),
        eq(marketIntelReportsTable.campaignId, campaignId),
        eq(marketIntelReportsTable.status, "ready"),
      ),
    )
    .orderBy(desc(marketIntelReportsTable.createdAt))
    .limit(1);

  if (!report?.output) return null;
  const out = report.output as unknown as MarketIntelOutput;

  const parts: string[] = ["ANÁLISE DE MERCADO DISPONÍVEL (use como base factual, não invente além):"];
  if (out.marketMaturity) parts.push(`Maturidade: ${out.marketMaturity}${out.marketSize ? ` | Tamanho: ${out.marketSize}` : ""}`);
  const topCompetitors = (out.competitors ?? []).slice(0, 3)
    .map((c) => `${c.name} (vulnerável em: ${c.biggestVulnerability}; preço: ${c.pricingStrategy})`)
    .join("; ");
  if (topCompetitors) parts.push(`Concorrentes: ${topCompetitors}`);
  const topGap = out.positioningGaps?.[0];
  if (topGap) parts.push(`Gap principal: ${topGap.gap} — ${topGap.opportunity}`);
  // Pricing arbitrage — critical for Jeff when user doesn't know their price
  if (out.pricingArbitrage) parts.push(`ARBITRAGEM DE PREÇO: ${out.pricingArbitrage.slice(0, 300)}`);
  if (out.entryRecommendation) parts.push(`Entrada recomendada: ${out.entryRecommendation.slice(0, 200)}`);
  const questions = (out.clarifyingQuestions ?? []).slice(0, 3);
  if (questions.length > 0) {
    parts.push(
      `PERGUNTAS PENDENTES DA ANÁLISE (faça-as de forma natural durante a conversa, UMA por vez, quando fizer sentido): ${questions.join(" | ")}`,
    );
  }
  return parts.join("\n").slice(0, 1200);
}

// ─── Deep-dive chat ──────────────────────────────────────────────────────────

const MARKET_INTEL_CHAT_PROMPT = `Você é o Market Intelligence Analyst do NexOS — especialista em inteligência competitiva para o mercado digital brasileiro. Você desmonta estratégias de concorrentes, encontra gaps e identifica arbitragens de conteúdo, plataforma e preço. Responda sempre em PT-BR. Quando analisar um mercado: foque nas vulnerabilidades exploráveis e nos gaps não ocupados — não apenas liste players. O objetivo é encontrar a posição defensável onde você para de competir. Suas respostas são diretas, específicas e acionáveis — sem enrolação.`;

const DEEPDIVE_SYNTHESIS_PROMPT = `Você é o sintetizador de inteligência do NexOS. Sua função é extrair insights acionáveis de uma conversa de análise de mercado e formatá-los como um bloco de contexto que será injetado nos agentes de Social Media (presença digital) e Lançamentos para que criem conteúdo e estratégias mais precisas.

Analise o histórico da conversa e extraia:
1. Ângulos de conteúdo descobertos na conversa (o que postar, que tipo de argumento funciona)
2. Objeções e dúvidas do mercado identificadas (use para antecipar no conteúdo)
3. Insights de posicionamento e diferenciação descobertos
4. Dados numéricos concretos mencionados (tamanho de mercado, preços, percentuais)
5. Decisões estratégicas acordadas na conversa

Responda em PT-BR em texto corrido, máximo 600 palavras, sem headers markdown. Seja direto e acionável — escreva como se estivesse passando um briefing para o time de conteúdo.`;

export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: string; // ISO timestamp
}

/**
 * Retorna o histórico de chat salvo para um relatório.
 * Retorna array vazio se não houver histórico ainda.
 */
export async function getChatHistory(
  reportId: string,
  workspaceId: string,
): Promise<StoredChatMessage[]> {
  const report = await getReport(reportId, workspaceId);
  if (!report) return [];
  const raw = report.chatHistory as unknown as StoredChatMessage[] | null;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Sintetiza os insights da conversa de deepdive e salva em deepdiveInsights.
 * Chamado de forma fire-and-forget após cada nova troca — roda em background.
 */
async function synthesizeAndSaveInsights(
  reportId: string,
  workspaceId: string,
  history: StoredChatMessage[],
  log: Logger,
): Promise<void> {
  try {
    // Só sintetiza se houver pelo menos 2 trocas (4 mensagens: 2 user + 2 assistant)
    if (history.length < 4) return;

    const convo = history
      .map((m) => `${m.role === "user" ? "Usuário" : "Analista"}: ${m.content}`)
      .join("\n\n");

    const result = await completeWithAgent(
      "market_intel",
      DEEPDIVE_SYNTHESIS_PROMPT,
      [{ role: "user" as const, content: `CONVERSA DE DEEPDIVE:\n\n${convo.slice(0, 15000)}` }],
      workspaceId,
      log,
    );

    await db
      .update(marketIntelReportsTable)
      .set({ deepdiveInsights: result.content.slice(0, 3000) })
      .where(
        and(
          eq(marketIntelReportsTable.id, reportId),
          eq(marketIntelReportsTable.workspaceId, workspaceId),
        ),
      );

    log.info({ reportId }, "market-intel: deepdive insights synthesized and saved");
  } catch (err) {
    log.warn({ err, reportId }, "market-intel: failed to synthesize deepdive insights (non-fatal)");
  }
}

export async function chatWithMarketIntel(
  reportId: string,
  workspaceId: string,
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  log: Logger,
): Promise<string> {
  const report = await getReport(reportId, workspaceId);
  if (!report) throw new Error("Relatório não encontrado");
  if (report.status !== "ready" || !report.output) {
    throw new Error("Relatório ainda não está pronto");
  }

  const contextBlock = `CONTEXTO — RELATÓRIO DE ANÁLISE DE MERCADO (${report.productName} / ${report.market}):\n${JSON.stringify(report.output).slice(0, 12000)}`;

  const messages = [
    { role: "user" as const, content: contextBlock },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content.slice(0, 30000) })),
    { role: "user" as const, content: question.slice(0, 4000) },
  ];

  const result = await completeWithAgent(
    "market_intel",
    MARKET_INTEL_CHAT_PROMPT,
    messages,
    workspaceId,
    log,
    report.campaignId ?? undefined,
  );

  const answer = result.content;
  const now = new Date().toISOString();

  // Persist the new message pair to DB
  const existingHistory = Array.isArray(report.chatHistory)
    ? (report.chatHistory as unknown as StoredChatMessage[])
    : [];
  const updatedHistory: StoredChatMessage[] = [
    ...existingHistory,
    { role: "user", content: question, ts: now },
    { role: "assistant", content: answer, ts: now },
  ];

  await db
    .update(marketIntelReportsTable)
    .set({ chatHistory: updatedHistory as unknown as typeof marketIntelReportsTable.$inferInsert["chatHistory"] })
    .where(
      and(
        eq(marketIntelReportsTable.id, reportId),
        eq(marketIntelReportsTable.workspaceId, workspaceId),
      ),
    );

  // Fire-and-forget: synthesize insights after every exchange (updates deepdiveInsights async)
  setImmediate(() => {
    synthesizeAndSaveInsights(reportId, workspaceId, updatedHistory, log).catch(() => {});
  });

  return answer;
}

// ─── Social presence context ─────────────────────────────────────────────────

/**
 * Monta um bloco de inteligência de mercado otimizado para geração de posts e
 * reels de social media. Inclui campos ausentes na versão de intake:
 * contentArbitrage, platformArbitrage, winningStrategyVsField, untappedSegments.
 *
 * Se campaignId for fornecido, busca o relatório vinculado à campanha.
 * Caso contrário, usa o relatório mais recente pronto do workspace (fallback
 * que cobre workspaces com relatório existente antes dessa integração).
 */
export async function buildSocialMarketIntelContext(
  workspaceId: string,
  campaignId?: string | null,
): Promise<string | null> {
  // 1) Tenta por vínculo de campanha
  let report: MarketIntelReport | undefined;
  if (campaignId) {
    const [linked] = await db
      .select()
      .from(marketIntelReportsTable)
      .where(
        and(
          eq(marketIntelReportsTable.workspaceId, workspaceId),
          eq(marketIntelReportsTable.campaignId, campaignId),
          eq(marketIntelReportsTable.status, "ready"),
        ),
      )
      .orderBy(desc(marketIntelReportsTable.createdAt))
      .limit(1);
    report = linked;
  }

  // 2) Fallback: relatório mais recente pronto do workspace (cobre relatórios
  //    existentes antes da integração ser ativada)
  if (!report) {
    const [latest] = await db
      .select()
      .from(marketIntelReportsTable)
      .where(
        and(
          eq(marketIntelReportsTable.workspaceId, workspaceId),
          eq(marketIntelReportsTable.status, "ready"),
        ),
      )
      .orderBy(desc(marketIntelReportsTable.createdAt))
      .limit(1);
    report = latest;
  }

  if (!report?.output) return null;
  const out = report.output as unknown as MarketIntelOutput;

  const parts: string[] = [
    `=== INTELIGÊNCIA DE MERCADO (${report.productName} / ${report.market}) ===`,
    "Use esses dados como base factual para criar conteúdo diferenciado. NÃO mencione concorrentes pelo nome nos posts.",
  ];

  // Maturidade e tamanho
  if (out.marketMaturity || out.marketSize) {
    parts.push(`Maturidade do mercado: ${out.marketMaturity ?? "?"} | Tamanho: ${out.marketSize ?? "?"}`);
  }

  // Vulnerabilidades dos concorrentes → ângulos de diferenciação
  const topCompetitors = (out.competitors ?? []).slice(0, 4);
  if (topCompetitors.length > 0) {
    const compLines = topCompetitors
      .map((c) => `• ${c.name}: vulnerável em "${c.biggestVulnerability}"; preço ${c.pricingStrategy}`)
      .join("\n");
    parts.push(`VULNERABILIDADES DOS CONCORRENTES (use para diferenciação no conteúdo):\n${compLines}`);
  }

  // Gaps de posicionamento → ângulos de conteúdo
  const gaps = (out.positioningGaps ?? []).slice(0, 3);
  if (gaps.length > 0) {
    const gapLines = gaps.map((g) => `• ${g.gap}: ${g.opportunity}`).join("\n");
    parts.push(`GAPS DE POSICIONAMENTO (ângulos não explorados pela concorrência):\n${gapLines}`);
  }

  // Arbitragem de conteúdo → o que postar que concorrentes ignoram
  if (out.contentArbitrage) {
    parts.push(`ARBITRAGEM DE CONTEÚDO (o que criar que concorrentes ignoram): ${out.contentArbitrage.slice(0, 400)}`);
  }

  // Arbitragem de plataforma → onde focar
  if (out.platformArbitrage) {
    parts.push(`ARBITRAGEM DE PLATAFORMA (onde há menos concorrência): ${out.platformArbitrage.slice(0, 300)}`);
  }

  // Estratégia vencedora
  if (out.winningStrategyVsField) {
    parts.push(`ESTRATÉGIA VENCEDORA vs campo: ${out.winningStrategyVsField.slice(0, 300)}`);
  }

  // Segmentos inexplorados
  const untapped = (out.untappedSegments ?? []).slice(0, 2);
  if (untapped.length > 0) {
    parts.push(`SEGMENTOS NÃO ATACADOS: ${untapped.join(" | ")}`);
  }

  // Arbitragem de preço
  if (out.pricingArbitrage) {
    parts.push(`ARBITRAGEM DE PREÇO: ${out.pricingArbitrage.slice(0, 250)}`);
  }

  // Insights do deepdive — insights refinados da conversa com o analista.
  // Têm prioridade máxima: representam decisões estratégicas explícitas do usuário.
  const deepdive = typeof report.deepdiveInsights === "string" && report.deepdiveInsights.trim()
    ? report.deepdiveInsights.trim()
    : null;
  if (deepdive) {
    parts.push(
      `=== INSIGHTS DO DEEPDIVE COM O ANALISTA (prioridade máxima — decisões explícitas do usuário) ===\n${deepdive.slice(0, 1500)}`,
    );
  }

  return parts.join("\n\n").slice(0, 5000);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function buildMarketDescription(intakeData: Record<string, unknown>): string {
  const pieces = [
    str(intakeData["product.description"]),
    str(intakeData["audience.description"]) ? `Público: ${str(intakeData["audience.description"])}` : null,
  ].filter(Boolean);
  return (pieces.join(". ") || str(intakeData["product.name"]) || "mercado digital").slice(0, 1500);
}
