import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNotNull, or } from "drizzle-orm";
import {
  auditLogsTable, campaignsTable, db, masterplanVersionsTable, paidMediaAccountsTable,
  paidMediaLaunchPlansTable, paidMediaEntitiesTable, paidMediaLaunchAttemptsTable, paidMediaLaunchStepsTable, executionEvidenceTable, productIntakesTable, commercialSubscriptionsTable, workspaceIntegrationsTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { canonicalize, deterministicHash } from "../masterplan/masterplan.service.js";
import { enforceNoMandatoryPause } from "../autonomy/autonomy.service.js";
import { paidMediaProviderCapabilities, type PaidMediaProviderName } from "./providers.js";
import { isPaidMediaIntegration } from "../integrations/integration-purpose.js";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => v && typeof v === "object" && !Array.isArray(v) ? v as Json : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
function validateLaunchReadback(type: string, id: string, readback: Json, payload: Json): void {
  if (String(readback["id"] ?? "") !== id) throw new AppError(502, "Provider readback id mismatch.", "PROVIDER_READBACK_INVALID");
  if (readback["status"] !== "PAUSED") throw new AppError(502, "Provider entity was not created paused.", "PROVIDER_READBACK_INVALID");
  if (typeof payload["name"] !== "string" || readback["name"] !== payload["name"]) throw new AppError(502, "Provider readback name mismatch.", "PROVIDER_READBACK_INVALID");
  for (const key of ["campaign_id", "adset_id"]) if (payload[key] != null && readback[key] !== payload[key]) throw new AppError(502, `Provider readback parent ${key} mismatch.`, "PROVIDER_READBACK_INVALID");
  for (const key of ["daily_budget", "lifetime_budget"]) {
    if (payload[key] == null) continue;
    const expected = Number(payload[key]);
    const actual = Number(readback[key]);
    if (!Number.isFinite(expected) || !Number.isInteger(expected) || !Number.isFinite(actual) || !Number.isInteger(actual) || actual !== expected) {
      throw new AppError(502, `Provider readback ${key} mismatch.`, "PROVIDER_READBACK_INVALID");
    }
  }
  for (const key of ["start_time", "end_time"]) {
    if (payload[key] == null) continue;
    const expected = Date.parse(String(payload[key]));
    const actual = Date.parse(String(readback[key] ?? ""));
    if (!Number.isFinite(expected) || !Number.isFinite(actual) || actual !== expected) {
      throw new AppError(502, `Provider readback ${key} mismatch.`, "PROVIDER_READBACK_INVALID");
    }
  }
  void type;
}
function allocateApprovedMinorUnits(authorizedMinorUnits: number, adSetCount: number): number[] {
  const count = Math.max(1, Math.floor(adSetCount));
  const total = Math.max(0, Math.round(authorizedMinorUnits));
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}
export function allocateApprovedBudget(approved: { amount: number; kind: "daily" | "lifetime" }, adSetCount: number): number[] {
  return allocateApprovedMinorUnits(Math.round(approved.amount * 100), adSetCount).map((minorUnits) => minorUnits / 100);
}
export function redactLaunchEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLaunchEvidence);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Json).map(([key, item]) => /token|secret|password|authorization|cookie/i.test(key) ? [key, "[REDACTED]"] : [key, redactLaunchEvidence(item)]));
  return value;
}

export function compileMasterplanTree(snapshot: unknown, provider: PaidMediaProviderName, accountId: string) {
  const root = obj(snapshot);
  const campaign = obj(root.campaign), strategy = obj(root.strategy), targeting = obj(root.targeting);
  const offer = obj(root.offer), timeline = obj(root.timeline);
  const name = String(campaign["title"] ?? "NexOS campaign");
  const objective = String(strategy["objective"] ?? campaign["objective"] ?? "OUTCOME_SALES");
  const rawBudget = obj(campaign["budget"] ?? strategy["budget"]);
  const budgetKind: "daily" | "lifetime" | undefined = rawBudget["kind"] === "daily" || rawBudget["kind"] === "lifetime" ? rawBudget["kind"] : undefined;
  const budget: { amount: number; kind: "daily" | "lifetime" } | null = budgetKind && typeof rawBudget["amount"] === "number" ? { amount: Number(rawBudget["amount"]), kind: budgetKind } : null;
  const authorizedMinorUnits = budget && Number.isFinite(budget.amount) ? Math.round(budget.amount * 100) : 0;
  const destination = String(offer["destinationUrl"] ?? offer["url"] ?? campaign["destinationUrl"] ?? root["destinationUrl"] ?? "");
  const audiences = arr(targeting["audiences"] ?? targeting["segments"] ?? [targeting]);
  const creatives = arr(root["creatives"] ?? obj(root["content"])["references"] ?? []);
  const nodes = audiences.length ? audiences : [{}];
  const budgetAllocationsMinorUnits = allocateApprovedMinorUnits(authorizedMinorUnits, nodes.length);
  if (budgetAllocationsMinorUnits.reduce((sum, value) => sum + value, 0) !== authorizedMinorUnits) {
    throw new AppError(500, "Budget allocation does not equal the approved authorization.", "BUDGET_ALLOCATION_INVALID");
  }
  const tree = {
    schema: "nexos-paid-media-tree/v1", provider, accountId,
    campaign: { key: "campaign", name, objective, budget, authorizedMinorUnits, budgetKind, startTime: campaign["startTime"] ?? timeline["startTime"], endTime: campaign["endTime"] ?? timeline["endTime"], durationDays: campaign["durationDays"] ?? root["durationDays"], timeline, destination, tracking: canonicalize(root["tracking"] ?? root["trackingRequirements"]) },
    adGroups: nodes.map((audience, i) => ({
      key: `ad-group-${i + 1}`, targeting: canonicalize(audience),
      budget: budget ? budgetAllocationsMinorUnits[i]! / 100 : null,
      budgetMinorUnits: budget ? budgetAllocationsMinorUnits[i]! : null,
      ads: (creatives.length ? creatives : [{ reference: null }]).map((creative, j) => ({
        key: `ad-${i + 1}-${j + 1}`, creative: canonicalize(creative), destination,
      })),
    })),
  };
  const meta = provider === "meta_ads" ? {
    name, objective, status: "PAUSED", special_ad_categories: [], account_id: accountId,
  } : {};
  return { tree, providerPayload: { [provider]: { campaign: meta } }, planHash: deterministicHash({ tree, providerPayload: { [provider]: { campaign: meta } } }) };
}

export function buildLaunchReadiness(input: {
  masterplan: { status: string; id: string; contextFingerprint: string } | null;
  account: { id: string; isSelected: boolean; currency: string; timezone: string; provider: string } | null;
  intake: { id: string; status: string } | null;
  tree: unknown; provider: PaidMediaProviderName;
  requiredApprovals?: string[];
}) {
  const blockers: Array<{ code: string; message: string }> = [];
  if (!input.masterplan || input.masterplan.status !== "approved") blockers.push({ code: "MASTERPLAN_APPROVAL_REQUIRED", message: "Approved Master Plan is required." });
  if (!input.account) blockers.push({ code: "ACCOUNT_NOT_FOUND", message: "Advertiser account is not available in this workspace." });
  else if (!input.account.isSelected) blockers.push({ code: "PRODUCTION_ACCOUNT_SELECTION_REQUIRED", message: "A production advertiser account must be selected." });
  if (input.account && (!input.account.currency || !input.account.timezone)) blockers.push({ code: "ACCOUNT_PROFILE_INCOMPLETE", message: "Account currency and timezone are required." });
  if (!input.intake || !["approved", "locked"].includes(input.intake.status)) blockers.push({ code: "PRODUCT_INTAKE_NOT_APPROVED", message: "An approved product intake version is required." });
  const root = obj(input.tree), campaign = obj(root["campaign"]);
  const budget = obj(campaign["budget"]);
  const lifetimeStartMs = Date.parse(String(campaign["startTime"] ?? ""));
  const lifetimeEndMs = Date.parse(String(campaign["endTime"] ?? ""));
  if (typeof budget["amount"] !== "number" || !Number.isFinite(budget["amount"]) || budget["amount"] <= 0 || Math.abs(Math.round(Number(budget["amount"]) * 100) - Number(budget["amount"]) * 100) > 1e-8) blockers.push({ code: "BUDGET_AUTHORIZATION_REQUIRED", message: "A positive finite budget with at most two currency decimals is required." });
  if ((campaign["budgetKind"] !== "daily" && campaign["budgetKind"] !== "lifetime")
    || (campaign["budgetKind"] === "lifetime" && (!Number.isFinite(lifetimeStartMs) || !Number.isFinite(lifetimeEndMs) || lifetimeStartMs >= lifetimeEndMs))) blockers.push({ code: "BUDGET_SEMANTICS_REQUIRED", message: "Lifetime budgets require an explicit valid startTime before endTime." });
  if (typeof campaign["destination"] !== "string" || !/^https?:\/\//i.test(campaign["destination"])) blockers.push({ code: "DESTINATION_URL_REQUIRED", message: "A valid destination URL is required." });
  const capabilities = paidMediaProviderCapabilities(input.provider);
  if (input.provider !== "meta_ads" || capabilities.operations?.campaign !== "supported" || capabilities.operations?.adGroup !== "supported" || capabilities.operations?.ad !== "supported") blockers.push({ code: "PROVIDER_CAPABILITY_BLOCKED", message: "Provider cannot create the complete campaign tree." });
  const tracking = obj(root["tracking"] ?? root["trackingRequirements"] ?? campaign["tracking"]);
  if (!tracking["pixelId"] && !tracking["datasetId"] && !tracking["conversionEvent"]) blockers.push({ code: "TRACKING_REQUIREMENTS_REQUIRED", message: "A tracking pixel/dataset and conversion event are required." });
  if (arr(obj(root["campaign"])["creatives"] ?? root["creatives"]).length === 0 && arr(obj(root["content"])["references"]).length === 0 && !arr(root["adGroups"]).some((group) => arr(obj(group)["ads"]).some((ad) => Object.values(obj(obj(ad)["creative"])).some((value) => value != null)))) blockers.push({ code: "CREATIVE_READINESS_REQUIRED", message: "At least one approved creative/content reference is required." });
  const constraints = obj(root["operatingMemory"] ?? root["constraints"]);
  if (arr(constraints["prohibitedClaims"]).length || arr(constraints["legalBoundaries"]).length) blockers.push({ code: "POLICY_LEGAL_REVIEW_REQUIRED", message: "Policy and legal constraints require explicit review before activation." });
  for (const approval of input.requiredApprovals ?? []) blockers.push({ code: "USER_APPROVAL_REQUIRED", message: `Required approval: ${approval}` });
  return { status: blockers.length ? "blocked" : "ready", blockers, checkedAt: new Date().toISOString(), provider: input.provider };
}

export async function compileLaunchPlan(workspaceId: string, actorId: string, input: { campaignId: string; accountId: string; provider: PaidMediaProviderName; masterplanVersionId: string; contextFingerprint: string; productIntakeVersionId: string }) {
  const [plan] = await db.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.id, input.masterplanVersionId), eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, input.campaignId), eq(masterplanVersionsTable.status, "approved"))).limit(1);
  if (!plan || plan.contextFingerprint !== input.contextFingerprint) throw new AppError(409, "Master Plan binding is stale or invalid.", "MASTERPLAN_FINGERPRINT_MISMATCH");
  const [campaign] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.id, input.campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, input.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.provider, input.provider))).limit(1);
  const [intake] = await db.select({ id: productIntakesTable.id, status: productIntakesTable.status, commercialProductId: productIntakesTable.commercialProductId }).from(productIntakesTable).where(and(eq(productIntakesTable.id, input.productIntakeVersionId), eq(productIntakesTable.workspaceId, workspaceId))).limit(1);
  if (!campaign || !account) throw new AppError(404, "Campaign or advertiser account not found in workspace.", "WORKSPACE_SCOPE_REJECTED");
  if (!campaign.commercialProductId || !campaign.commercialSubscriptionId || campaign.commercialProductId !== plan.commercialProductId || campaign.commercialSubscriptionId !== plan.commercialSubscriptionId) throw new AppError(409, "Campaign commercial binding does not match the approved Master Plan.", "COMMERCIAL_BINDING_MISMATCH");
  const [subscription] = await db.select({ id: commercialSubscriptionsTable.id, productId: commercialSubscriptionsTable.productId }).from(commercialSubscriptionsTable).where(and(eq(commercialSubscriptionsTable.id, campaign.commercialSubscriptionId), eq(commercialSubscriptionsTable.workspaceId, workspaceId), eq(commercialSubscriptionsTable.status, "active"))).limit(1);
  if (!subscription || subscription.productId !== campaign.commercialProductId) throw new AppError(409, "An active subscription for the campaign product is required.", "ACTIVE_SUBSCRIPTION_REQUIRED");
  if (campaign.productIntakeVersionId !== input.productIntakeVersionId || plan.productIntakeVersionId !== input.productIntakeVersionId) throw new AppError(409, "Canonical product intake binding does not match.", "INTAKE_BINDING_MISMATCH");
  if (!intake || !["approved", "locked"].includes(intake.status) || intake.commercialProductId !== campaign.commercialProductId) throw new AppError(409, "Canonical intake must be approved for the campaign product.", "INTAKE_PRODUCT_MISMATCH");
  const compiled = compileMasterplanTree(plan.snapshot, input.provider, account.providerAccountId);
  const readiness = buildLaunchReadiness({ masterplan: plan, account, intake: intake ?? null, tree: compiled.tree, provider: input.provider });
  const values = { workspaceId, commercialProductId: plan.commercialProductId, commercialSubscriptionId: plan.commercialSubscriptionId, campaignId: input.campaignId, masterplanVersionId: plan.id, contextFingerprint: plan.contextFingerprint, accountId: account.id, productIntakeVersionId: input.productIntakeVersionId, provider: input.provider, planHash: compiled.planHash, tree: compiled.tree, providerPayload: compiled.providerPayload, readiness, createdByUserId: actorId };
  const [created] = await db.insert(paidMediaLaunchPlansTable).values(values).onConflictDoNothing().returning();
  const result = created ?? (await db.select().from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.workspaceId, workspaceId), eq(paidMediaLaunchPlansTable.planHash, compiled.planHash))).limit(1))[0];
  if (!result) throw new AppError(409, "Unable to create idempotent launch plan.", "IDEMPOTENCY_CONFLICT");
  await db.insert(auditLogsTable).values({ workspaceId, campaignId: input.campaignId, action: "paid_media.launch_plan.compiled", actor: actorId, data: { planId: result.id, planHash: result.planHash, readiness: readiness.status } });
  return result;
}

export async function approveLaunchPlan(workspaceId: string, planId: string, userId: string) {
  const [plan] = await db.select().from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.id, planId), eq(paidMediaLaunchPlansTable.workspaceId, workspaceId))).limit(1);
  if (!plan) throw new NotFoundError("Paid media launch plan");
  if ((plan.readiness as Json)["status"] !== "ready") throw new AppError(428, "Launch readiness is blocked.", "LAUNCH_READINESS_BLOCKED", plan.readiness as object);
  const snapshot = { planHash: plan.planHash, tree: plan.tree, providerPayload: plan.providerPayload, readiness: plan.readiness, approvedAt: new Date().toISOString() };
  const [updated] = await db.update(paidMediaLaunchPlansTable).set({ launchStage: "approved", approvalSnapshot: snapshot, approvedByUserId: userId, approvedAt: new Date() }).where(and(eq(paidMediaLaunchPlansTable.id, planId), eq(paidMediaLaunchPlansTable.workspaceId, workspaceId), eq(paidMediaLaunchPlansTable.launchStage, "compiled"))).returning();
  return updated ?? plan;
}

export async function activateLaunchPlan(workspaceId: string, planId: string) {
  const [plan] = await db.select().from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.id, planId), eq(paidMediaLaunchPlansTable.workspaceId, workspaceId))).limit(1);
  if (!plan) throw new NotFoundError("Paid media launch plan");
  await enforceNoMandatoryPause(workspaceId, { campaignId: plan.campaignId, channel: "paid_media", action: "paid_media_execute" });
  if (!["approved", "failed", "activating"].includes(plan.launchStage)) throw new AppError(409, "Launch plan must be approved before activation.", "LAUNCH_APPROVAL_REQUIRED");
  const attemptKey = `launch:${plan.id}`;
  const owner = randomUUID();
  const [existingAttempt] = await db.select().from(paidMediaLaunchAttemptsTable).where(and(eq(paidMediaLaunchAttemptsTable.launchPlanId, plan.id), eq(paidMediaLaunchAttemptsTable.workspaceId, workspaceId), eq(paidMediaLaunchAttemptsTable.attemptKey, attemptKey))).limit(1);
  if (existingAttempt?.status === "succeeded") return plan;
  const now = new Date();
  if (plan.launchStage === "activating" && (!existingAttempt || !existingAttempt.leaseExpiresAt || existingAttempt.leaseExpiresAt > now)) throw new AppError(409, "Launch is already executing.", "LAUNCH_EXECUTION_IN_PROGRESS");
  const stale = plan.launchStage === "activating" && existingAttempt;
  const [claimed] = await db.update(paidMediaLaunchPlansTable).set({ launchStage: "activating" }).where(and(
    eq(paidMediaLaunchPlansTable.id, plan.id), eq(paidMediaLaunchPlansTable.workspaceId, workspaceId),
    stale ? and(eq(paidMediaLaunchPlansTable.launchStage, "activating"), eq(paidMediaLaunchPlansTable.id, plan.id)) : or(eq(paidMediaLaunchPlansTable.launchStage, "approved"), eq(paidMediaLaunchPlansTable.launchStage, "failed")),
  )).returning();
  if (!claimed) throw new AppError(409, "Launch was claimed by another request.", "LAUNCH_EXECUTION_CONFLICT");
  const leaseUntil = new Date(Date.now() + 60_000);
  const [attempt] = existingAttempt
    ? await db.update(paidMediaLaunchAttemptsTable).set({ status: "executing", leaseOwner: owner, leaseExpiresAt: leaseUntil, heartbeatAt: new Date() }).where(and(eq(paidMediaLaunchAttemptsTable.id, existingAttempt.id), stale ? eq(paidMediaLaunchAttemptsTable.leaseOwner, existingAttempt.leaseOwner!) : eq(paidMediaLaunchAttemptsTable.id, existingAttempt.id), stale ? eq(paidMediaLaunchAttemptsTable.leaseExpiresAt, existingAttempt.leaseExpiresAt!) : eq(paidMediaLaunchAttemptsTable.id, existingAttempt.id))).returning()
    : await db.insert(paidMediaLaunchAttemptsTable).values({ workspaceId, launchPlanId: plan.id, attemptKey, leaseOwner: owner, leaseExpiresAt: leaseUntil, heartbeatAt: new Date() }).returning();
  if (!attempt) throw new AppError(409, "Launch lease was reclaimed by another worker.", "LAUNCH_EXECUTION_CONFLICT");
  const adapter = (await import("./providers.js")).paidMediaProvider(plan.provider);
   if (!adapter.createLaunchEntity || !adapter.readLaunchEntity || !adapter.deleteEntity || !adapter.verifyLaunchEntityAbsence) throw new AppError(409, "Single-step launch execution is not enabled by the current provider adapter.", "PROVIDER_CAPABILITY_BLOCKED", { provider: plan.provider });
  try {
    const groups = Array.isArray((plan.tree as Json)["adGroups"]) ? (plan.tree as Json)["adGroups"] as Json[] : [];
    const pendingSteps = [{ key: "campaign", type: "campaign" as const }, ...groups.flatMap((group) => [
      { key: String(group["key"]), type: "ad_set" as const },
      ...((Array.isArray(group["ads"]) ? group["ads"] : []) as Json[]).flatMap((ad) => [
        { key: `${String(ad["key"])}:creative`, type: "creative" as const },
        { key: `${String(ad["key"])}:ad`, type: "ad" as const },
      ]),
    ])];
    for (const [sequence, step] of pendingSteps.entries()) await db.insert(paidMediaLaunchStepsTable).values({ workspaceId, attemptId: attempt!.id, stepKey: step.key, sequence, entityType: step.type }).onConflictDoNothing();
    const [selectedAccount] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, plan.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.isSelected, true))).limit(1);
    if (!selectedAccount) throw new AppError(409, "Selected advertiser account is no longer available.", "ACCOUNT_NOT_FOUND");
    const [integration] = await db.select({ id: workspaceIntegrationsTable.id, status: workspaceIntegrationsTable.status, metadata: workspaceIntegrationsTable.metadata }).from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id, selectedAccount.integrationId), eq(workspaceIntegrationsTable.workspaceId, workspaceId))).limit(1);
    if (!integration || integration.status !== "connected" || !isPaidMediaIntegration(integration.metadata as Record<string, unknown>)) throw new AppError(409, "Selected paid-media integration is not connected.", "PAID_MEDIA_AUTHORIZATION_REQUIRED");
    const tree = plan.tree as Json;
    const campaign = obj(tree["campaign"]);
    const providerPayload = obj(plan.providerPayload);
    const providerConfig = obj(providerPayload[plan.provider]);
    let actualAdSetBudgetMinorUnits = 0;
    const plannedAdSetBudgetMinorUnits = groups.reduce((sum, group) => sum + Number(group["budgetMinorUnits"] ?? 0), 0);
    if (!Number.isInteger(plannedAdSetBudgetMinorUnits) || plannedAdSetBudgetMinorUnits !== Number(campaign["authorizedMinorUnits"])) {
      throw new AppError(500, "Emitted ad-set budgets do not equal the authorized budget.", "BUDGET_ALLOCATION_INVALID");
    }
    const account = (await db.select().from(paidMediaAccountsTable).where(eq(paidMediaAccountsTable.id, plan.accountId)).limit(1))[0]!;
    const orderedSteps = await db.select().from(paidMediaLaunchStepsTable).where(eq(paidMediaLaunchStepsTable.attemptId, attempt!.id)).orderBy(paidMediaLaunchStepsTable.sequence);
    const stepsByKey = new Map(orderedSteps.map((step) => [step.stepKey, step]));
    for (const step of orderedSteps) {
      const heartbeatNow = new Date();
      const [heartbeat] = await db.update(paidMediaLaunchAttemptsTable).set({ heartbeatAt: heartbeatNow, leaseExpiresAt: new Date(heartbeatNow.getTime() + 60_000) }).where(and(
        eq(paidMediaLaunchAttemptsTable.id, attempt!.id),
        eq(paidMediaLaunchAttemptsTable.leaseOwner, owner),
        eq(paidMediaLaunchAttemptsTable.status, "executing"),
        gt(paidMediaLaunchAttemptsTable.leaseExpiresAt, heartbeatNow),
      )).returning();
      if (!heartbeat || heartbeat.leaseOwner !== owner) throw new AppError(409, "Launch lease was lost.", "LAUNCH_EXECUTION_CONFLICT");
      const group = groups.find((item) => String(item["key"]) === step.stepKey);
      const ad = groups.flatMap((item) => arr(item["ads"]).map((x) => ({ group: item, ad: obj(x) }))).find((item) => `${String(item.ad["key"])}:creative` === step.stepKey || `${String(item.ad["key"])}:ad` === step.stepKey);
      const campaignStep = stepsByKey.get("campaign");
      const adSetStep = ad ? stepsByKey.get(String(ad.group["key"])) : undefined;
      const creativeStep = ad ? stepsByKey.get(`${String(ad.ad["key"])}:creative`) : undefined;
      const dependencies = step.entityType === "ad_set"
        ? [campaignStep]
        : step.entityType === "ad"
          ? [adSetStep, creativeStep]
          : [];
      for (const dependency of dependencies) {
        if (!dependency?.providerEntityId || dependency.status !== "verified") {
          throw new AppError(409, "Verified launch dependency is missing.", "PROVIDER_READBACK_INVALID");
        }
        const dependencyReadback = await adapter.readLaunchEntity(workspaceId, plan.accountId, dependency.entityType, dependency.providerEntityId);
        validateLaunchReadback(dependency.entityType, dependency.providerEntityId, dependencyReadback.data, obj(dependency.readback));
      }
      const payload: Json = step.entityType === "campaign" ? obj(providerConfig["campaign"])
        : step.entityType === "ad_set" ? { name: step.stepKey, billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS", campaign_id: campaignStep?.providerEntityId, targeting: obj(group)?.["targeting"], ...(campaign["budgetKind"] === "daily" ? { daily_budget: Number(group?.["budgetMinorUnits"]) } : { lifetime_budget: Number(group?.["budgetMinorUnits"]), start_time: campaign["startTime"], end_time: campaign["endTime"] }) }
        : step.entityType === "creative" ? { name: ad?.ad?.["key"], object_story_spec: obj(ad?.ad?.["creative"])["object_story_spec"] }
        : { name: ad?.ad?.["key"], adset_id: adSetStep?.providerEntityId, creative: { creative_id: creativeStep?.providerEntityId } };
      if (step.providerEntityId) {
        const readback = await adapter.readLaunchEntity(workspaceId, plan.accountId, step.entityType, step.providerEntityId);
        validateLaunchReadback(step.entityType, step.providerEntityId, readback.data, payload);
        if (step.entityType === "ad_set") actualAdSetBudgetMinorUnits += Number(readback.data[campaign["budgetKind"] === "daily" ? "daily_budget" : "lifetime_budget"]);
        await db.update(paidMediaLaunchStepsTable).set({ status: "verified", readback: readback.data }).where(eq(paidMediaLaunchStepsTable.id, step.id));
        step.status = "verified";
        step.readback = readback.data;
        continue;
      }
      const result = await adapter.createLaunchEntity(workspaceId, plan.accountId, step.entityType, payload, `launch:${plan.id}:${step.sequence}`);
      await db.update(paidMediaLaunchStepsTable).set({ providerEntityId: result.providerEntityId, status: "created", providerResponse: result.evidence }).where(eq(paidMediaLaunchStepsTable.id, step.id));
      const readback = await adapter.readLaunchEntity(workspaceId, plan.accountId, step.entityType, result.providerEntityId);
      validateLaunchReadback(step.entityType, result.providerEntityId, readback.data, payload);
      if (step.entityType === "ad_set") actualAdSetBudgetMinorUnits += Number(readback.data[campaign["budgetKind"] === "daily" ? "daily_budget" : "lifetime_budget"]);
      await db.update(paidMediaLaunchStepsTable).set({ status: "verified", readback: readback.data }).where(eq(paidMediaLaunchStepsTable.id, step.id));
      step.providerEntityId = result.providerEntityId;
      step.status = "verified";
      step.providerResponse = result.evidence;
      step.readback = readback.data;
      await db.insert(paidMediaEntitiesTable).values({ workspaceId, accountId: plan.accountId, provider: plan.provider, providerEntityId: result.providerEntityId, entityType: result.entityType, parentProviderEntityId: result.parentProviderEntityId, currency: account.currency, timezone: account.timezone, providerData: result.evidence });
      await db.insert(executionEvidenceTable).values({ workspaceId, campaignId: plan.campaignId, masterplanVersionId: plan.masterplanVersionId, contextFingerprint: plan.contextFingerprint, subjectType: "paid_media_launch_plan", subjectId: plan.id, state: "provider_confirmed", details: { providerEntityId: result.providerEntityId, evidence: result.evidence } });
    }
    if (!Number.isFinite(actualAdSetBudgetMinorUnits) || actualAdSetBudgetMinorUnits !== Number(campaign["authorizedMinorUnits"])) throw new AppError(502, "Provider ad-set budgets do not equal the authorized budget.", "PROVIDER_BUDGET_MISMATCH");
    const active = await db.transaction(async (tx) => {
      const [completed] = await tx.update(paidMediaLaunchAttemptsTable).set({ status: "succeeded", updatedAt: new Date() }).where(and(eq(paidMediaLaunchAttemptsTable.id, attempt!.id), eq(paidMediaLaunchAttemptsTable.leaseOwner, owner), eq(paidMediaLaunchAttemptsTable.status, "executing"))).returning();
      if (!completed) throw new AppError(409, "Launch lease was lost before completion.", "LAUNCH_OWNERSHIP_LOST");
      const [activated] = await tx.update(paidMediaLaunchPlansTable).set({ launchStage: "active" }).where(and(eq(paidMediaLaunchPlansTable.id, plan.id), eq(paidMediaLaunchPlansTable.launchStage, "activating"))).returning();
      if (!activated) throw new AppError(409, "Launch lease was lost before completion.", "LAUNCH_OWNERSHIP_LOST");
      return activated;
    });
    return active;
  } catch (error) {
    if (error instanceof AppError && error.code === "LAUNCH_OWNERSHIP_LOST") throw error;
    const compensationStart = new Date();
    const [ownership] = await db.update(paidMediaLaunchAttemptsTable).set({
      heartbeatAt: compensationStart,
      leaseExpiresAt: new Date(compensationStart.getTime() + 60_000),
    }).where(and(
      eq(paidMediaLaunchAttemptsTable.id, attempt!.id),
      eq(paidMediaLaunchAttemptsTable.leaseOwner, owner),
      eq(paidMediaLaunchAttemptsTable.status, "executing"),
      gt(paidMediaLaunchAttemptsTable.leaseExpiresAt, compensationStart),
    )).returning({ id: paidMediaLaunchAttemptsTable.id });
    if (!ownership) throw new AppError(409, "Launch lease was lost; compensation delegated to current owner.", "LAUNCH_OWNERSHIP_LOST");
    let compensationFailed = false;
    const steps = await db.select().from(paidMediaLaunchStepsTable).where(and(eq(paidMediaLaunchStepsTable.attemptId, attempt!.id),)).orderBy(desc(paidMediaLaunchStepsTable.sequence));
    for (const step of steps) {
      if (!step.providerEntityId || step.status === "compensated") continue;
      const compensationHeartbeat = new Date();
      const [ownerCheck] = await db.update(paidMediaLaunchAttemptsTable).set({
        heartbeatAt: compensationHeartbeat,
        leaseExpiresAt: new Date(compensationHeartbeat.getTime() + 60_000),
      }).where(and(
        eq(paidMediaLaunchAttemptsTable.id, attempt!.id),
        eq(paidMediaLaunchAttemptsTable.leaseOwner, owner),
        eq(paidMediaLaunchAttemptsTable.status, "executing"),
        gt(paidMediaLaunchAttemptsTable.leaseExpiresAt, compensationHeartbeat),
      )).returning({ id: paidMediaLaunchAttemptsTable.id });
      if (!ownerCheck) throw new AppError(409, "Launch lease was lost; compensation delegated to current owner.", "LAUNCH_OWNERSHIP_LOST");
      try {
        const deleted = await adapter.deleteEntity!(workspaceId, plan.accountId, step.providerEntityId, `compensate:${plan.id}:${step.id}`);
        const absence = await adapter.verifyLaunchEntityAbsence!(workspaceId, plan.accountId, step.entityType, step.providerEntityId);
        if (!absence.absent) throw new Error("Provider deletion was not verified.");
        await db.update(paidMediaLaunchStepsTable).set({ status: "compensated", compensation: { delete: deleted.evidence, absence: absence.evidence } }).where(eq(paidMediaLaunchStepsTable.id, step.id));
      } catch (compensationError) {
        compensationFailed = true;
        await db.update(paidMediaLaunchStepsTable).set({ status: "compensation_failed", compensation: { error: compensationError instanceof Error ? compensationError.message : "delete/readback failed" } }).where(eq(paidMediaLaunchStepsTable.id, step.id));
      }
    }
    await db.transaction(async (tx) => {
      const [failedAttempt] = await tx.update(paidMediaLaunchAttemptsTable).set({ status: compensationFailed ? "compensation_failed" : "failed", error: error instanceof Error ? error.message : "provider failure", updatedAt: new Date() }).where(and(eq(paidMediaLaunchAttemptsTable.id, attempt!.id), eq(paidMediaLaunchAttemptsTable.leaseOwner, owner), eq(paidMediaLaunchAttemptsTable.status, "executing"))).returning();
      if (!failedAttempt) throw new AppError(409, "Launch lease was lost; compensation delegated to current owner.", "LAUNCH_OWNERSHIP_LOST");
      await tx.update(paidMediaLaunchPlansTable).set({ launchStage: compensationFailed ? "compensation_failed" : "failed" }).where(and(eq(paidMediaLaunchPlansTable.id, plan.id), eq(paidMediaLaunchPlansTable.launchStage, "activating")));
    });
    await db.insert(executionEvidenceTable).values({ workspaceId, campaignId: plan.campaignId, masterplanVersionId: plan.masterplanVersionId, contextFingerprint: plan.contextFingerprint, subjectType: "paid_media_launch_plan", subjectId: plan.id, state: "attempted", details: { error: error instanceof Error ? error.message : "provider failure" } });
    throw error;
  }
}