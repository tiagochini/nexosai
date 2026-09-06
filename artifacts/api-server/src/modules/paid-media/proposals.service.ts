import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, paidMediaAccountsTable, paidMediaEntitiesTable, paidMediaInsightsTable, paidMediaPoliciesTable, paidMediaProposalsTable } from "@workspace/db";
import { evaluatePolicy } from "./actions.service.js";

export async function generateProposal(workspaceId: string, input: { accountId: string; entityId: string; actionType: "pause" | "resume" | "update_daily_budget" | "update_bid"; proposedChange: Record<string, unknown>; optimizationOutput?: Record<string, unknown>; idempotencyKey?: string }) {
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, input.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId))).limit(1);
  const [entity] = await db.select().from(paidMediaEntitiesTable).where(and(eq(paidMediaEntitiesTable.id, input.entityId), eq(paidMediaEntitiesTable.workspaceId, workspaceId), eq(paidMediaEntitiesTable.accountId, input.accountId))).limit(1);
  if (!account || !entity) throw new Error("Account or entity not found in workspace.");
  const insights = await db.select().from(paidMediaInsightsTable).where(and(eq(paidMediaInsightsTable.workspaceId, workspaceId), eq(paidMediaInsightsTable.entityId, entity.id))).orderBy(desc(paidMediaInsightsTable.metricDate)).limit(30);
  const sampleSize = insights.reduce((n, row) => n + row.impressions, 0);
  const quality = insights.length === 0 ? 0 : Math.min(1, insights.length / 7) * (insights.some((row) => Number(row.spend) > 0) ? 1 : .5);
  const idem = input.idempotencyKey ?? createHash("sha256").update(JSON.stringify([workspaceId, account.id, entity.id, input.actionType, input.proposedChange, insights[0]?.metricDate])).digest("hex");
  const [existing] = await db.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.workspaceId, workspaceId), eq(paidMediaProposalsTable.idempotencyKey, idem))).limit(1);
  if (existing) return existing;
  const action = { type: input.actionType, entityId: entity.providerEntityId, entityType: entity.entityType, expectedVersion: entity.version ?? undefined, changes: input.proposedChange, idempotencyKey: idem } as const;
  const decision = await evaluatePolicy(workspaceId, account.id, action, sampleSize, quality);
  const [policy] = await db.select().from(paidMediaPoliciesTable).where(and(eq(paidMediaPoliciesTable.workspaceId, workspaceId), eq(paidMediaPoliciesTable.accountId, account.id))).limit(1);
  const status = decision.eligible ? "approved" as const : "pending_approval" as const;
  const metrics = { sampleSize, quality, insightDays: insights.length, impressions: sampleSize, spend: insights.reduce((n, row) => n + Number(row.spend), 0), optimizationOutput: input.optimizationOutput ?? null };
  const [proposal] = await db.insert(paidMediaProposalsTable).values({
    workspaceId, accountId: account.id, entityId: entity.id, provider: account.provider, actionType: input.actionType, status, idempotencyKey: idem,
    recommendation: String(input.optimizationOutput?.["recommendation"] ?? `Proposed ${input.actionType} for ${entity.name ?? entity.providerEntityId}.`),
    metrics, simulation: { beforeSnapshot: entity.providerData, proposedChange: input.proposedChange, estimatedImpact: input.optimizationOutput?.["simulation"] ?? null },
    beforeAllocation: entity.providerData, afterAllocation: input.proposedChange, requestedChange: action,
    policyDecision: { ...decision, classification: decision.crossPlatform ? "interplatform" : "intraplatform", requiresApproval: !decision.eligible, autoExecute: !!(decision.eligible && policy?.autoExecute) },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();
  return proposal;
}