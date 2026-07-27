/**
 * NEXOS AI — Background Compliance Pre-Scan
 * ────────────────────────────────────────────────────────────────────────────
 * Runs after content generation completes (campaign enters awaiting_approval).
 * Validates every pending_approval piece in one batch and saves results to
 * complianceChecksTable (contentId FK) so the approval page can show a
 * full compliance landscape upfront — before the user clicks Approve.
 *
 * Fire-and-forget — never throws; never blocks the HTTP response.
 */

import { eq, and } from "drizzle-orm";
import {
  db,
  contentPiecesTable,
  complianceChecksTable,
} from "@workspace/db";
import type { ComplianceViolation } from "@workspace/db";
import { validatePieceCompliance } from "../agents/compliance.agent.js";
import type { PieceLevelComplianceResult, PieceLevelViolation } from "../agents/compliance.agent.js";
import type { Logger } from "pino";

// ── Re-export so routes only import from here ────────────────────────────────
export type { PieceLevelComplianceResult };

// ── Text extraction (mirrors content.routes.ts approve handler) ──────────────

export function extractPieceText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content !== "object") return "";

  const c = content as Record<string, unknown>;
  const candidates: string[] = [];

  for (const key of [
    "body", "caption", "copyText", "primaryText", "script",
    "message", "subject", "headline", "bigPromise", "openingLine",
  ]) {
    if (typeof c[key] === "string") candidates.push(c[key] as string);
  }

  for (const key of ["sections", "emailSequence", "videos", "segments"]) {
    const arr = c[key];
    if (Array.isArray(arr)) {
      (arr as Record<string, unknown>[]).slice(0, 5).forEach(item => {
        for (const f of ["body", "script", "copyText", "caption", "subject"]) {
          if (typeof item[f] === "string") candidates.push(item[f] as string);
        }
      });
    }
  }

  return candidates.join("\n\n").slice(0, 4000);
}

// ── riskLevel → complianceStatusEnum mapping ─────────────────────────────────

function toCheckStatus(
  riskLevel: PieceLevelComplianceResult["riskLevel"],
  passed: boolean,
): "passed" | "warning" | "failed" {
  if (passed) return "passed";
  if (riskLevel === "blocked") return "failed";
  return "warning";
}

// ── riskLevel → overallSeverity mapping ──────────────────────────────────────

function toSeverity(
  riskLevel: PieceLevelComplianceResult["riskLevel"],
): "none" | "low" | "medium" | "high" | "critical" {
  switch (riskLevel) {
    case "safe":       return "none";
    case "low_risk":   return "low";
    case "medium_risk": return "medium";
    case "high_risk":  return "high";
    case "blocked":    return "critical";
    default:           return "none";
  }
}

// ── PieceLevelViolation → DB ComplianceViolation ──────────────────────────────

function mapViolations(violations: PieceLevelViolation[]): ComplianceViolation[] {
  return violations.map(v => ({
    rule: v.category,
    severity: v.severity,
    excerpt: v.originalText ?? "",
    description: v.issue,
    suggestion: v.correctedText ?? "",
  }));
}

// ── Main sweep ────────────────────────────────────────────────────────────────

/**
 * Runs validatePieceCompliance on every pending_approval piece for the
 * campaign and persists results to complianceChecksTable.
 * Sequential (one piece at a time) to respect AI rate limits.
 */
export async function runComplianceSweep(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<void> {
  const pieces = await db
    .select({
      id: contentPiecesTable.id,
      type: contentPiecesTable.type,
      title: contentPiecesTable.title,
      content: contentPiecesTable.content,
    })
    .from(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.campaignId, campaignId),
        eq(contentPiecesTable.status, "pending_approval"),
      ),
    );

  if (pieces.length === 0) {
    log.info({ campaignId }, "[compliance-sweep] no pending_approval pieces — skipping");
    return;
  }

  log.info({ campaignId, count: pieces.length }, "[compliance-sweep] starting background pre-scan");

  let passed = 0;
  let failed = 0;

  for (const piece of pieces) {
    try {
      const pieceText = extractPieceText(piece.content);
      if (pieceText.trim().length < 30) {
        passed++;
        continue;
      }

      const result = await validatePieceCompliance(
        pieceText,
        piece.type ?? "content",
        campaignId,
        workspaceId,
        log,
      );

      await db.insert(complianceChecksTable).values({
        workspaceId,
        campaignId,
        contentId: piece.id,
        contentTitle: piece.title,
        contentType: piece.type ?? "content",
        contentText: pieceText.slice(0, 1000),
        platform: "generic",
        status: toCheckStatus(result.riskLevel, result.passed),
        overallSeverity: toSeverity(result.riskLevel),
        complianceScore: result.complianceScore,
        violations: mapViolations(result.violations),
        suggestions: result.recommendations,
        checkedBy: "pre-scan",
        traceId: `pre_scan_${campaignId}`,
        metadata: { sweepType: "pre_scan", pieceLevelResult: result },
      });

      result.passed ? passed++ : failed++;
    } catch (err) {
      log.warn({ err, pieceId: piece.id }, "[compliance-sweep] piece scan failed — skipping");
      failed++;
    }
  }

  log.info({ campaignId, passed, failed }, "[compliance-sweep] pre-scan complete");
}

// ── Summary query (for the GET endpoint) ─────────────────────────────────────

export interface PieceScanResult {
  pieceId: string;
  riskLevel: PieceLevelComplianceResult["riskLevel"];
  complianceScore: number;
  passed: boolean;
  violationCount: number;
  recommendations: string[];
  violations: ComplianceViolation[];
}

export interface ComplianceSweepSummary {
  total: number;
  passing: number;
  withViolations: number;
  blocked: number;
  highRisk: number;
  mediumRisk: number;
  byPiece: Record<string, PieceScanResult>;
  scanned: boolean;
}

export async function getComplianceSweepSummary(
  campaignId: string,
  workspaceId: string,
): Promise<ComplianceSweepSummary> {
  const rows = await db
    .select()
    .from(complianceChecksTable)
    .where(
      and(
        eq(complianceChecksTable.campaignId, campaignId),
        eq(complianceChecksTable.workspaceId, workspaceId),
      ),
    )
    .orderBy(complianceChecksTable.createdAt);

  if (rows.length === 0) {
    return {
      total: 0, passing: 0, withViolations: 0, blocked: 0,
      highRisk: 0, mediumRisk: 0, byPiece: {}, scanned: false,
    };
  }

  // Keep only the latest scan result per contentId
  const latestByPiece = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    if (!row.contentId) continue;
    const meta = row.metadata as Record<string, unknown> | null;
    if (meta?.sweepType !== "pre_scan") continue;
    latestByPiece.set(row.contentId, row);
  }

  const byPiece: Record<string, PieceScanResult> = {};
  let passing = 0;
  let withViolations = 0;
  let blocked = 0;
  let highRisk = 0;
  let mediumRisk = 0;

  for (const [pieceId, row] of latestByPiece) {
    const meta = row.metadata as Record<string, unknown> | null;
    const fullResult = meta?.pieceLevelResult as PieceLevelComplianceResult | null;
    const riskLevel = fullResult?.riskLevel ?? (row.status === "passed" ? "safe" : "medium_risk");
    const isPassed = row.status === "passed";

    byPiece[pieceId] = {
      pieceId,
      riskLevel,
      complianceScore: row.complianceScore,
      passed: isPassed,
      violationCount: (row.violations as ComplianceViolation[])?.length ?? 0,
      recommendations: (row.suggestions as string[]) ?? [],
      violations: (row.violations as ComplianceViolation[]) ?? [],
    };

    if (isPassed) {
      passing++;
    } else {
      withViolations++;
      if (riskLevel === "blocked") blocked++;
      else if (riskLevel === "high_risk") highRisk++;
      else if (riskLevel === "medium_risk") mediumRisk++;
    }
  }

  return {
    total: latestByPiece.size,
    passing,
    withViolations,
    blocked,
    highRisk,
    mediumRisk,
    byPiece,
    scanned: latestByPiece.size > 0,
  };
}
