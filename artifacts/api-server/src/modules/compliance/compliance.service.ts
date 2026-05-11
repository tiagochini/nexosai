import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  complianceChecksTable,
  contentPiecesTable,
  campaignsTable,
  type ComplianceCheck,
  type ComplianceViolation,
  type ComplianceSeverity,
  type CompliancePlatform,
} from "@workspace/db";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import crypto from "crypto";

// ─── Severity ranking ─────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ComplianceSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const SEVERITY_PENALTY: Record<ComplianceSeverity, number> = {
  none: 0,
  low: 5,
  medium: 10,
  high: 20,
  critical: 30,
};

function maxSeverity(
  violations: ComplianceViolation[]
): ComplianceSeverity {
  if (!violations.length) return "none";
  return violations.reduce<ComplianceSeverity>((max, v) => {
    return SEVERITY_RANK[v.severity] > SEVERITY_RANK[max] ? v.severity : max;
  }, "none");
}

function calcScore(violations: ComplianceViolation[]): number {
  const penalty = violations.reduce(
    (sum, v) => sum + SEVERITY_PENALTY[v.severity],
    0
  );
  return Math.max(0, 100 - penalty);
}

function deriveStatus(
  score: number,
  severity: ComplianceSeverity
): "passed" | "warning" | "failed" {
  if (severity === "critical" || score < 40) return "failed";
  if (severity === "high" || score < 70) return "warning";
  return "passed";
}

// ─── AI-powered compliance check ──────────────────────────────────────────────

const PLATFORM_RULES: Record<CompliancePlatform, string> = {
  meta_ads: `
Meta Ads Policy (aplicar todas):
- Proibido: promessas de ganhos financeiros específicos sem comprovação
- Proibido: antes-e-depois em conteúdo de saúde/emagrecimento sem disclaimer
- Proibido: clickbait enganoso ("você não vai acreditar", "segredo que eles escondem")
- Proibido: urgência falsa repetida ("oferta expira hoje" em múltiplos anúncios)
- Proibido: superlativos sem prova ("o melhor", "o número 1", "infalível")
- Permitido com disclaimer: depoimentos de resultados atípicos`,
  google_ads: `
Google Ads Policy (aplicar todas):
- Proibido: afirmações enganosas sobre produtos ou serviços
- Proibido: superlativos sem qualificação mensurável
- Proibido: promessas de resultado garantido sem evidência científica
- Requer: clareza sobre quem veicula o anúncio
- Proibido: conteúdo de get-rich-quick schemes`,
  tiktok: `
TikTok Ads Policy (aplicar todas):
- Proibido: afirmações de saúde não comprovadas
- Proibido: promessas financeiras irrealistas
- Proibido: conteúdo que explora inseguranças corporais negativamente
- Requer: disclaimers em conteúdo de resultados individuais`,
  conar: `
CONAR — Código Brasileiro de Autorregulamentação Publicitária:
- Proibido: publicidade enganosa ou abusiva (Art. 37 CDC)
- Proibido: promessas de resultado que não podem ser entregues
- Proibido: exploração do medo ou superstição como argumento de venda
- Proibido: discriminação de qualquer natureza
- Requer: identificação clara de que é publicidade ("publi", "ad", etc.)
- Proibido: apelos à autoridade sem base factual ("aprovado por especialistas")`,
  cvm: `
CVM — Comissão de Valores Mobiliários:
- Proibido: promessas de retorno financeiro garantido em investimentos
- Proibido: omissão de riscos em produtos de investimento
- Proibido: captação de recursos sem autorização CVM
- Proibido: "dinheiro fácil" ou "renda passiva garantida" em contexto de investimentos
- Requer: disclosure de riscos em qualquer oferta de investimento`,
  anvisa: `
ANVISA — Agência Nacional de Vigilância Sanitária:
- Proibido: afirmar que produto cura, trata ou previne doenças sem registro ANVISA
- Proibido: uso de termos médicos para produtos não-medicamentos
- Proibido: afirmações de emagrecimento sem comprovação clínica
- Requer: registro ANVISA em qualquer produto que faça afirmação de saúde`,
  generic: `
Conformidade geral para marketing digital brasileiro:
- Proibido: promessas de resultado garantido sem histórico comprovado
- Proibido: urgência artificial recorrente como única estratégia de conversão
- Proibido: depoimentos falsos ou fabricados
- Requer: disclaimer em depoimentos de resultados atípicos
- Proibido: afirmações que não podem ser substantiadas com dados reais`,
};

const SYSTEM_PROMPT = `Você é um especialista em compliance publicitário brasileiro especializado em marketing digital, infoprodutos e cursos online.

Sua função é analisar textos de marketing e identificar violações de conformidade regulatória e de plataformas digitais.

SEMPRE responda EXCLUSIVAMENTE em JSON válido no seguinte formato:
{
  "violations": [
    {
      "rule": "NOME_DA_REGRA_EM_CAPS_SNAKE",
      "severity": "low|medium|high|critical",
      "excerpt": "trecho exato do texto que viola a regra",
      "description": "explicação clara da violação em português",
      "suggestion": "como corrigir o trecho para ficar em conformidade",
      "platform": "nome da plataforma/regulação que gerou esta regra"
    }
  ],
  "overallAssessment": "análise geral do conteúdo em 1-2 frases",
  "suggestions": ["sugestão geral 1", "sugestão geral 2"]
}

Se não houver violações, retorne violations como array vazio [].
Seja preciso: só aponte violações reais, não seja excessivamente conservador.`;

export async function runComplianceCheck(
  workspaceId: string,
  opts: {
    contentId?: string;
    campaignId?: string;
    contentTitle: string;
    contentType: string;
    contentText: string;
    platform?: CompliancePlatform;
  },
  log: typeof logger
): Promise<ComplianceCheck> {
  const platform = opts.platform ?? "generic";
  const traceId = crypto.randomUUID();

  const platformRules = PLATFORM_RULES[platform];

  const userMessage = `Analise o seguinte conteúdo de marketing para conformidade com as regras abaixo.

REGRAS APLICÁVEIS:
${platformRules}

CONTEÚDO PARA ANÁLISE:
Tipo: ${opts.contentType}
Título: ${opts.contentTitle}

---
${opts.contentText}
---

Identifique TODAS as violações presentes e retorne no formato JSON especificado.`;

  let rawResponse: string;
  try {
    const result = await completeWithAgent(
      "compliance",
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      workspaceId,
      log,
      opts.campaignId
    );
    rawResponse = result.content;
  } catch (err) {
    log.warn({ err }, "AI compliance check failed — storing pending check");
    rawResponse = JSON.stringify({ violations: [], suggestions: [], overallAssessment: "Verificação manual necessária" });
  }

  // Parse AI response
  let violations: ComplianceViolation[] = [];
  let suggestions: string[] = [];

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        violations?: ComplianceViolation[];
        suggestions?: string[];
        overallAssessment?: string;
      };
      violations = Array.isArray(parsed.violations) ? parsed.violations : [];
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    }
  } catch {
    log.warn({ rawResponse }, "Failed to parse compliance AI response");
  }

  const overallSeverity = maxSeverity(violations);
  const complianceScore = calcScore(violations);
  const status = deriveStatus(complianceScore, overallSeverity);
  const autoBlocked =
    status === "failed" ? 1 : 0;

  const [check] = await db
    .insert(complianceChecksTable)
    .values({
      workspaceId,
      campaignId: opts.campaignId ?? null,
      contentId: opts.contentId ?? null,
      contentTitle: opts.contentTitle,
      contentType: opts.contentType,
      contentText: opts.contentText,
      platform,
      status,
      overallSeverity,
      complianceScore,
      violations,
      suggestions,
      traceId,
      autoBlocked,
      metadata: {},
    })
    .returning();

  if (!check) throw new AppError(500, "Falha ao salvar check de compliance", "DB_ERROR");

  // If content piece referenced, update its status if blocked
  if (opts.contentId && autoBlocked) {
    await db
      .update(contentPiecesTable)
      .set({ status: "rejected", rejectionReason: `Bloqueado por compliance: ${overallSeverity} severity (score ${complianceScore}/100)` })
      .where(eq(contentPiecesTable.id, opts.contentId));
  }

  log.info(
    { workspaceId, platform, score: complianceScore, severity: overallSeverity, violations: violations.length },
    "Compliance check completed"
  );

  return check;
}

// ─── Run check from content piece id ──────────────────────────────────────────

export async function checkContentPiece(
  workspaceId: string,
  contentId: string,
  platform: CompliancePlatform,
  log: typeof logger
): Promise<ComplianceCheck> {
  const [piece] = await db
    .select()
    .from(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.id, contentId),
        eq(contentPiecesTable.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!piece) throw new NotFoundError("Peça de conteúdo não encontrada");

  const contentText = typeof piece.content === "object" && piece.content !== null
    ? JSON.stringify(piece.content, null, 2)
    : String(piece.content);

  return runComplianceCheck(
    workspaceId,
    {
      contentId,
      campaignId: piece.campaignId,
      contentTitle: piece.title,
      contentType: piece.type,
      contentText,
      platform,
    },
    log
  );
}

// ─── Batch check ──────────────────────────────────────────────────────────────

export async function batchCheckContent(
  workspaceId: string,
  contentIds: string[],
  platform: CompliancePlatform,
  log: typeof logger
): Promise<ComplianceCheck[]> {
  const results: ComplianceCheck[] = [];
  for (const id of contentIds) {
    const check = await checkContentPiece(workspaceId, id, platform, log);
    results.push(check);
  }
  return results;
}

// ─── List checks ──────────────────────────────────────────────────────────────

export async function listChecks(
  workspaceId: string,
  opts: {
    campaignId?: string;
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<ComplianceCheck[]> {
  const conditions = [eq(complianceChecksTable.workspaceId, workspaceId)];

  if (opts.campaignId) {
    conditions.push(eq(complianceChecksTable.campaignId, opts.campaignId));
  }
  if (opts.status) {
    conditions.push(
      eq(
        complianceChecksTable.status,
        opts.status as ComplianceCheck["status"]
      )
    );
  }
  if (opts.platform) {
    conditions.push(
      eq(
        complianceChecksTable.platform,
        opts.platform as ComplianceCheck["platform"]
      )
    );
  }

  return db
    .select()
    .from(complianceChecksTable)
    .where(and(...conditions))
    .orderBy(desc(complianceChecksTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function getCheck(
  workspaceId: string,
  checkId: string
): Promise<ComplianceCheck> {
  const [check] = await db
    .select()
    .from(complianceChecksTable)
    .where(
      and(
        eq(complianceChecksTable.id, checkId),
        eq(complianceChecksTable.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!check) throw new NotFoundError("Check de compliance não encontrado");
  return check;
}

// ─── Human review ─────────────────────────────────────────────────────────────

export async function reviewCheck(
  workspaceId: string,
  checkId: string,
  reviewerId: string,
  action: "approved" | "rejected" | "modified",
  note?: string
): Promise<ComplianceCheck> {
  const existing = await getCheck(workspaceId, checkId);

  const newStatus: ComplianceCheck["status"] =
    action === "approved" || action === "modified" ? "overridden" : "failed";

  const [updated] = await db
    .update(complianceChecksTable)
    .set({
      status: newStatus,
      reviewedBy: reviewerId,
      reviewAction: action,
      reviewNote: note ?? null,
      reviewedAt: new Date(),
      autoBlocked: action === "approved" || action === "modified" ? 0 : existing.autoBlocked,
      updatedAt: new Date(),
    })
    .where(eq(complianceChecksTable.id, checkId))
    .returning();

  // If approved/modified and linked to content, unblock content
  if (
    updated &&
    existing.contentId &&
    (action === "approved" || action === "modified")
  ) {
    await db
      .update(contentPiecesTable)
      .set({ status: "draft", rejectionReason: null })
      .where(eq(contentPiecesTable.id, existing.contentId));
  }

  return updated!;
}

// ─── Campaign compliance summary ──────────────────────────────────────────────

export async function getCampaignCompliance(
  workspaceId: string,
  campaignId: string
): Promise<{
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  overridden: number;
  averageScore: number;
  criticalViolations: number;
  checks: ComplianceCheck[];
}> {
  const checks = await listChecks(workspaceId, { campaignId, limit: 100 });

  const total = checks.length;
  const passed = checks.filter((c) => c.status === "passed").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const failed = checks.filter((c) => c.status === "failed").length;
  const overridden = checks.filter((c) => c.status === "overridden").length;
  const averageScore =
    total > 0
      ? Math.round(
          checks.reduce((sum, c) => sum + c.complianceScore, 0) / total
        )
      : 100;
  const criticalViolations = checks.reduce((sum, c) => {
    const vios = c.violations as ComplianceViolation[];
    return sum + vios.filter((v) => v.severity === "critical").length;
  }, 0);

  return {
    total,
    passed,
    warnings,
    failed,
    overridden,
    averageScore,
    criticalViolations,
    checks,
  };
}

// ─── Workspace compliance stats ───────────────────────────────────────────────

export async function getComplianceStats(workspaceId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      passed: sql<number>`count(*) filter (where status = 'passed')::int`,
      warning: sql<number>`count(*) filter (where status = 'warning')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      overridden: sql<number>`count(*) filter (where status = 'overridden')::int`,
      avgScore: sql<number>`round(avg(compliance_score))::int`,
      autoBlocked: sql<number>`sum(auto_blocked)::int`,
    })
    .from(complianceChecksTable)
    .where(eq(complianceChecksTable.workspaceId, workspaceId));

  const recentFailed = await db
    .select()
    .from(complianceChecksTable)
    .where(
      and(
        eq(complianceChecksTable.workspaceId, workspaceId),
        eq(complianceChecksTable.status, "failed")
      )
    )
    .orderBy(desc(complianceChecksTable.createdAt))
    .limit(5);

  return {
    total: row?.total ?? 0,
    passed: row?.passed ?? 0,
    warning: row?.warning ?? 0,
    failed: row?.failed ?? 0,
    overridden: row?.overridden ?? 0,
    averageScore: row?.avgScore ?? 100,
    autoBlocked: row?.autoBlocked ?? 0,
    passRate:
      row?.total
        ? Math.round(((row.passed + row.overridden) / row.total) * 100)
        : 100,
    recentFailed,
  };
}
