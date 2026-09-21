import { Router, type Response } from "express";
import { and, desc, eq, isNotNull, ne, or } from "drizzle-orm";
import {
  db,
  paidMediaAccountsTable,
  paidMediaDatasetsTable,
  paidMediaBudgetStrategiesTable,
  paidMediaPoliciesTable,
  paidMediaProposalsTable,
  paidMediaActionAttemptsTable,
  paidMediaSyncCursorsTable,
  workspaceIntegrationsTable,
  paidMediaLaunchPlansTable,
  executionEvidenceTable,
  paidMediaLaunchStepsTable,
  paidMediaLaunchAttemptsTable,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  PaidMediaProviderError,
  paidMediaProvider,
  paidMediaProviderCapabilities,
  type PaidMediaProviderName,
} from "./providers.js";
import { syncPaidMediaAccount } from "./sync.service.js";
import { decideProposal, executeProposal, rollbackAttempt } from "./actions.service.js";
import { generateProposal } from "./proposals.service.js";
import { approveLaunchPlan, activateLaunchPlan, compileLaunchPlan } from "./launch-plans.service.js";
import { isPaidMediaIntegration } from "../integrations/integration-purpose.js";
import { datasetDiagnostics, recordDatasetEvent, reconciliationSummary, upsertConversion, upsertTouchpoint } from "./attribution.service.js";

const router = Router();
// This is deliberately before requireAuth: browser/server tags identify a
// dataset by a randomly generated opaque key, never by a workspace id or Ads
// credential. The lookup scopes every write to that dataset's workspace.
router.post("/events/ingest", async (req, res): Promise<void> => {
  const key = typeof req.header("x-paid-media-ingestion-key") === "string" ? req.header("x-paid-media-ingestion-key")! : "";
  const [dataset] = key ? await db.select({
    id: paidMediaDatasetsTable.id, workspaceId: paidMediaDatasetsTable.workspaceId,
    accountId: paidMediaDatasetsTable.accountId,
    provider: paidMediaDatasetsTable.provider, providerDatasetId: paidMediaDatasetsTable.providerDatasetId,
  }).from(paidMediaDatasetsTable).where(eq(paidMediaDatasetsTable.ingestionKey, key)).limit(1) : [];
  if (!dataset) { res.status(401).json({ error: "A valid dataset ingestion key is required.", code: "DATASET_AUTH_FAILED" }); return; }
  try {
    const source = req.body?.source;
    if (source !== "browser" && source !== "server") throw new Error("source must be browser or server.");
    res.status(202).json(await recordDatasetEvent(dataset, { ...req.body, source }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid event.", code: "VALIDATION_ERROR" });
  }
});
router.use(requireAuth);

// Approved-Masterplan paid-media launch contract. Organic social has no access
// to these endpoints or tables.
router.post("/launch-plans/compile", async (req, res): Promise<void> => {
  const body = req.body ?? {};
  if (!["meta_ads", "google_ads", "tiktok_ads"].includes(body.provider) || typeof body.campaignId !== "string" || typeof body.accountId !== "string" || typeof body.masterplanVersionId !== "string" || typeof body.contextFingerprint !== "string" || typeof body.productIntakeVersionId !== "string") {
    res.status(400).json({ error: "campaignId, accountId, provider, masterplanVersionId, contextFingerprint and productIntakeVersionId are required.", code: "VALIDATION_ERROR" }); return;
  }
  try { res.status(201).json({ launchPlan: await compileLaunchPlan(req.auth.workspaceId, req.auth.userId, body) }); }
  catch (error) { sendProviderError(res, error); }
});
router.get("/launch-plans", async (req, res): Promise<void> => {
  res.json({ launchPlans: await db.select().from(paidMediaLaunchPlansTable).where(eq(paidMediaLaunchPlansTable.workspaceId, req.auth.workspaceId)) });
});
router.get("/launch-plans/:planId", async (req, res): Promise<void> => {
  const [launchPlan] = await db.select().from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.id, req.params["planId"]), eq(paidMediaLaunchPlansTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!launchPlan) { res.status(404).json({ error: "Launch plan not found.", code: "LAUNCH_PLAN_NOT_FOUND" }); return; }
  res.json({ launchPlan });
});
router.get("/launch-plans/:planId/readiness", async (req, res): Promise<void> => {
  const [launchPlan] = await db.select({ readiness: paidMediaLaunchPlansTable.readiness }).from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.id, req.params["planId"]), eq(paidMediaLaunchPlansTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!launchPlan) { res.status(404).json({ error: "Launch plan not found.", code: "LAUNCH_PLAN_NOT_FOUND" }); return; }
  res.json({ readiness: launchPlan.readiness });
});
router.get("/launch-plans/:planId/evidence", async (req, res): Promise<void> => {
  const [launchPlan] = await db.select({ id: paidMediaLaunchPlansTable.id }).from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.id, req.params["planId"]), eq(paidMediaLaunchPlansTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!launchPlan) { res.status(404).json({ error: "Launch plan not found.", code: "LAUNCH_PLAN_NOT_FOUND" }); return; }
  const evidence = await db.select().from(executionEvidenceTable).where(and(eq(executionEvidenceTable.workspaceId, req.auth.workspaceId), eq(executionEvidenceTable.subjectType, "paid_media_launch_plan"), eq(executionEvidenceTable.subjectId, launchPlan.id)));
  res.json({ evidence: evidence.map((item) => ({ ...item, details: { ...(item.details as Record<string, unknown>), accessToken: undefined, refreshToken: undefined } })) });
});
router.post("/launch-plans/:planId/simulate", async (req, res): Promise<void> => {
  const [launchPlan] = await db.select().from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.id, req.params["planId"]), eq(paidMediaLaunchPlansTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!launchPlan) { res.status(404).json({ error: "Launch plan not found.", code: "LAUNCH_PLAN_NOT_FOUND" }); return; }
  // Simulation is intentionally read-only: no provider request and no state mutation.
  res.json({ simulation: { mode: "dry_run", planHash: launchPlan.planHash, tree: launchPlan.tree, providerPayload: launchPlan.providerPayload, readiness: launchPlan.readiness, mutations: [] } });
});
router.post("/launch-plans/:planId/approve", async (req, res): Promise<void> => {
  try { res.json({ launchPlan: await approveLaunchPlan(req.auth.workspaceId, req.params["planId"], req.auth.userId) }); } catch (error) { sendProviderError(res, error); }
});
router.post("/launch-plans/:planId/activate", async (req, res): Promise<void> => {
  try { res.json({ launchPlan: await activateLaunchPlan(req.auth.workspaceId, req.params["planId"]) }); } catch (error) { sendProviderError(res, error); }
});
router.post("/launch-plans/:planId/rollback", async (req, res): Promise<void> => {
  const [launchPlan] = await db.select().from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.id, req.params["planId"]), eq(paidMediaLaunchPlansTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!launchPlan || !["failed", "active", "compensation_failed"].includes(launchPlan.launchStage)) { res.status(409).json({ error: "Only failed or active launch plans can be compensated.", code: "ROLLBACK_NOT_AVAILABLE" }); return; }
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, launchPlan.accountId), eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId))).limit(1);
  const [latestAttempt] = await db.select({ id: paidMediaLaunchAttemptsTable.id }).from(paidMediaLaunchAttemptsTable).where(and(eq(paidMediaLaunchAttemptsTable.launchPlanId, launchPlan.id), or(eq(paidMediaLaunchAttemptsTable.status, "succeeded"), eq(paidMediaLaunchAttemptsTable.status, "compensation_failed")))).orderBy(desc(paidMediaLaunchAttemptsTable.updatedAt), desc(paidMediaLaunchAttemptsTable.id)).limit(1);
  const steps = latestAttempt ? await db.select().from(paidMediaLaunchStepsTable).where(and(eq(paidMediaLaunchStepsTable.workspaceId, req.auth.workspaceId), eq(paidMediaLaunchStepsTable.attemptId, latestAttempt.id), isNotNull(paidMediaLaunchStepsTable.providerEntityId), ne(paidMediaLaunchStepsTable.status, "compensated"))).orderBy(desc(paidMediaLaunchStepsTable.sequence)) : [];
  const adapter = paidMediaProvider(launchPlan.provider);
  const outcomes = [];
  if (!latestAttempt || !steps.length) { res.status(409).json({ error: "No created launch steps are available for rollback.", code: "ROLLBACK_NOT_AVAILABLE" }); return; }
  for (const step of steps) {
    try {
      if (!adapter.deleteEntity || !account) throw new Error("Provider deletion capability unavailable.");
       const absenceBefore = await adapter.verifyLaunchEntityAbsence?.(req.auth.workspaceId, account.id, step.entityType, step.providerEntityId!);
       if (absenceBefore?.absent) {
         await db.update(paidMediaLaunchStepsTable).set({ status: "compensated", compensation: { absence: absenceBefore.evidence, alreadyAbsent: true } }).where(eq(paidMediaLaunchStepsTable.id, step.id));
         outcomes.push({ stepId: step.id, compensated: true });
         continue;
       }
       const result = await adapter.deleteEntity(req.auth.workspaceId, account.id, step.providerEntityId!, `rollback:${launchPlan.id}:${step.id}`);
        const absence = await adapter.verifyLaunchEntityAbsence?.(req.auth.workspaceId, account.id, step.entityType, step.providerEntityId!);
       if (!absence?.absent) throw new Error("Provider deletion was not verified.");
       await db.update(paidMediaLaunchStepsTable).set({ status: "compensated", compensation: { delete: result.evidence, absence: absence.evidence } }).where(eq(paidMediaLaunchStepsTable.id, step.id));
      outcomes.push({ stepId: step.id, compensated: true });
    } catch (error) {
      await db.update(paidMediaLaunchStepsTable).set({ status: "compensation_failed", compensation: { error: error instanceof Error ? error.message : "delete failed" } }).where(eq(paidMediaLaunchStepsTable.id, step.id));
      outcomes.push({ stepId: step.id, compensated: false });
    }
  }
  const success = outcomes.length > 0 && outcomes.every((item) => item.compensated);
  const [updated] = await db.update(paidMediaLaunchPlansTable).set({ launchStage: success ? "rolled_back" : "compensation_failed" }).where(eq(paidMediaLaunchPlansTable.id, launchPlan.id)).returning();
  res.status(success ? 200 : 502).json({ launchPlan: updated, compensation: outcomes, code: success ? undefined : "COMPENSATION_FAILED" });
});

function providerFrom(value: unknown): PaidMediaProviderName | undefined {
  return value === "meta_ads" || value === "tiktok_ads" || value === "google_ads" ? value : undefined;
}

function sendProviderError(res: Response, error: unknown): void {
  if (error instanceof PaidMediaProviderError) {
    res.status(error.status ?? (error.code === "PRECONDITION_FAILED" ? 409 : error.code === "RATE_LIMITED" ? 429 : 502))
      .json({ error: error.message, code: error.code });
    return;
  }
  res.status(500).json({ error: "Unable to complete paid-media provider request.", code: "PAID_MEDIA_ERROR" });
}

// Discovery never chooses among multiple advertisers. It records the complete
// provider result and clients must call the explicit selection endpoint.
router.get("/accounts/:provider/discover", async (req, res): Promise<void> => {
  const provider = providerFrom(req.params["provider"]);
  if (!provider) {
    res.status(400).json({ error: "Unsupported paid-media provider.", code: "UNSUPPORTED_PROVIDER" });
    return;
  }
  try {
     const integrations = await db.select({ id: workspaceIntegrationsTable.id, metadata: workspaceIntegrationsTable.metadata })
      .from(workspaceIntegrationsTable)
       .where(and(eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId), eq(workspaceIntegrationsTable.provider, provider), eq(workspaceIntegrationsTable.status, "connected")))
       .limit(20);
      const integration = integrations.find((row) => isPaidMediaIntegration(row.metadata as Record<string, unknown>));
     if (!integration) {
      res.status(409).json({ error: "Provider integration is not connected.", code: "INTEGRATION_NOT_CONNECTED" });
      return;
    }
     const adapter = paidMediaProvider(provider);
     const accounts = adapter.listAccountsForIntegration
       ? await adapter.listAccountsForIntegration(req.auth.workspaceId, integration.id)
       : await adapter.listAccounts(req.auth.workspaceId);
    for (const account of accounts) {
      const [existing] = await db.select({ id: paidMediaAccountsTable.id })
        .from(paidMediaAccountsTable)
        .where(and(eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId), eq(paidMediaAccountsTable.provider, provider), eq(paidMediaAccountsTable.providerAccountId, account.providerAccountId)))
        .limit(1);
      if (existing) {
         await db.update(paidMediaAccountsTable).set({ integrationId: integration.id, accountName: account.name, currency: account.currency, timezone: account.timezone })
          .where(eq(paidMediaAccountsTable.id, existing.id));
      } else {
        await db.insert(paidMediaAccountsTable).values({
          workspaceId: req.auth.workspaceId, integrationId: integration.id, provider,
          providerAccountId: account.providerAccountId, accountName: account.name,
          currency: account.currency, timezone: account.timezone,
        });
      }
    }
    res.json({ accounts, selectionRequired: accounts.length !== 1 });
  } catch (error) {
    sendProviderError(res, error);
  }
});

router.get("/accounts/:provider", async (req, res): Promise<void> => {
  const provider = providerFrom(req.params["provider"]);
  if (!provider) {
    res.status(400).json({ error: "Unsupported paid-media provider.", code: "UNSUPPORTED_PROVIDER" });
    return;
  }
  const accounts = await db.select({
    id: paidMediaAccountsTable.id, providerAccountId: paidMediaAccountsTable.providerAccountId,
    accountName: paidMediaAccountsTable.accountName, currency: paidMediaAccountsTable.currency,
    timezone: paidMediaAccountsTable.timezone, isSelected: paidMediaAccountsTable.isSelected,
  }).from(paidMediaAccountsTable).where(and(
    eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId),
    eq(paidMediaAccountsTable.provider, provider),
  ));
  res.json({ accounts });
});

router.get("/providers/capabilities", (_req, res): void => {
  res.json({ providers: ["meta_ads", "tiktok_ads", "google_ads"].map((provider) => ({ provider, capabilities: paidMediaProviderCapabilities(provider as PaidMediaProviderName) })) });
});
// Readiness is deliberately a live, read-only provider call. A connected OAuth
// row is never reported production-ready merely because it has token fields.
router.get("/setup/:provider/status", async (req, res): Promise<void> => {
  const provider = providerFrom(req.params["provider"]);
  if (!provider) { res.status(400).json({ error: "Unsupported paid-media provider.", code: "UNSUPPORTED_PROVIDER" }); return; }
  try {
    const accounts = await paidMediaProvider(provider).listAccounts(req.auth.workspaceId);
    const selected = await db.select({ providerAccountId: paidMediaAccountsTable.providerAccountId, isSelected: paidMediaAccountsTable.isSelected })
      .from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId), eq(paidMediaAccountsTable.provider, provider)));
    const selectedId = selected.find((account) => account.isSelected)?.providerAccountId;
    const selectedAccount = accounts.find((account) => account.providerAccountId === selectedId);
    res.json({
      provider, verifiedAt: new Date().toISOString(), oauth: "verified", advertiserAuthorization: "verified",
      accountSelectionRequired: accounts.length !== 1 && !selectedId,
      accounts: accounts.map(({ providerAccountId, name, currency, timezone, testAccount }) => ({ providerAccountId, name, currency, timezone, environment: testAccount ? "test" : "production" })),
      selectedAccountId: selectedId ?? null,
      productionReady: !!selectedAccount && selectedAccount.testAccount !== true,
      capabilities: paidMediaProviderCapabilities(provider),
    });
  } catch (error) { sendProviderError(res, error); }
});
router.get("/budget-strategies", async (req, res): Promise<void> => {
  res.json({ strategies: await db.select().from(paidMediaBudgetStrategiesTable).where(eq(paidMediaBudgetStrategiesTable.workspaceId, req.auth.workspaceId)) });
});

router.get("/datasets", async (req, res): Promise<void> => {
  // Do not re-disclose browser ingestion keys in ordinary diagnostics/listing.
  res.json({ datasets: await db.select({
    id: paidMediaDatasetsTable.id, workspaceId: paidMediaDatasetsTable.workspaceId,
    accountId: paidMediaDatasetsTable.accountId, provider: paidMediaDatasetsTable.provider,
    providerDatasetId: paidMediaDatasetsTable.providerDatasetId, name: paidMediaDatasetsTable.name,
    lastEventAt: paidMediaDatasetsTable.lastEventAt, lastDiagnosticAt: paidMediaDatasetsTable.lastDiagnosticAt,
    createdAt: paidMediaDatasetsTable.createdAt, updatedAt: paidMediaDatasetsTable.updatedAt,
  }).from(paidMediaDatasetsTable).where(eq(paidMediaDatasetsTable.workspaceId, req.auth.workspaceId)) });
});
router.post("/datasets", async (req, res): Promise<void> => {
  const provider = providerFrom(req.body?.provider);
  if (!provider || typeof req.body?.accountId !== "string" || typeof req.body?.providerDatasetId !== "string" || !req.body.providerDatasetId) {
    res.status(400).json({ error: "provider, accountId and providerDatasetId are required.", code: "VALIDATION_ERROR" }); return;
  }
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, req.body.accountId), eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId), eq(paidMediaAccountsTable.provider, provider))).limit(1);
  if (!account) { res.status(404).json({ error: "Provider account not found in this workspace.", code: "ACCOUNT_NOT_FOUND" }); return; }
  const [dataset] = await db.insert(paidMediaDatasetsTable).values({ workspaceId: req.auth.workspaceId, accountId: account.id, provider, providerDatasetId: req.body.providerDatasetId, name: typeof req.body.name === "string" ? req.body.name : null, ingestionKey: randomUUID() }).onConflictDoNothing().returning();
  if (!dataset) { res.status(409).json({ error: "Dataset is already registered.", code: "DATASET_EXISTS" }); return; }
  res.status(201).json({ dataset });
});
router.get("/datasets/:datasetId/diagnostics", async (req, res): Promise<void> => {
  try { res.json(await datasetDiagnostics(req.auth.workspaceId, req.params["datasetId"])); } catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : "Dataset not found.", code: "DATASET_NOT_FOUND" }); }
});

router.post("/attribution/touchpoints", async (req, res): Promise<void> => {
  try { res.status(201).json({ touchpoint: await upsertTouchpoint(req.auth.workspaceId, req.body ?? {}) }); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid touchpoint.", code: "VALIDATION_ERROR" }); }
});
router.post("/attribution/conversions", async (req, res): Promise<void> => {
  try { res.status(201).json({ conversion: await upsertConversion(req.auth.workspaceId, req.body ?? {}) }); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid conversion.", code: "VALIDATION_ERROR" }); }
});
router.get("/attribution/reconciliation", async (req, res): Promise<void> => {
  try { res.json(await reconciliationSummary(req.auth.workspaceId, String(req.query["since"] ?? ""), String(req.query["until"] ?? ""))); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid reconciliation range.", code: "VALIDATION_ERROR" }); }
});

router.post("/accounts/:provider/:accountId/select", async (req, res): Promise<void> => {
  const provider = providerFrom(req.params["provider"]);
  if (!provider) {
    res.status(400).json({ error: "Unsupported paid-media provider.", code: "UNSUPPORTED_PROVIDER" });
    return;
  }
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(
    eq(paidMediaAccountsTable.id, req.params["accountId"]),
    eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId),
    eq(paidMediaAccountsTable.provider, provider),
  )).limit(1);
  if (!account) {
    res.status(404).json({ error: "Advertiser account not found in this workspace.", code: "ACCOUNT_NOT_FOUND" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(paidMediaAccountsTable).set({ isSelected: false })
      .where(and(eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId), eq(paidMediaAccountsTable.provider, provider)));
    await tx.update(paidMediaAccountsTable).set({ isSelected: true, selectedAt: new Date() })
      .where(eq(paidMediaAccountsTable.id, account.id));
    await tx.update(workspaceIntegrationsTable).set({ accountId: account.providerAccountId, accountName: account.accountName })
      .where(eq(workspaceIntegrationsTable.id, account.integrationId));
  });
  res.json({ accountId: account.id, providerAccountId: account.providerAccountId, selected: true });
});

router.post("/accounts/:accountId/sync", async (req, res): Promise<void> => {
  const since = typeof req.body?.since === "string" ? req.body.since : new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const until = typeof req.body?.until === "string" ? req.body.until : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    res.status(400).json({ error: "since and until must be YYYY-MM-DD.", code: "VALIDATION_ERROR" }); return;
  }
  try {
    res.json(await syncPaidMediaAccount(req.auth.workspaceId, req.params["accountId"], since, until));
  } catch (error) {
    sendProviderError(res, error);
  }
});

router.post("/proposals/:proposalId/approve", async (req, res): Promise<void> => {
  try { res.json(await decideProposal(req.auth.workspaceId, req.auth.userId, req.params["proposalId"], true, req.body?.evidence ?? {}, req.body?.comment)); } catch (error) { sendProviderError(res, error); }
});
router.post("/proposals/:proposalId/reject", async (req, res): Promise<void> => {
  try { res.json(await decideProposal(req.auth.workspaceId, req.auth.userId, req.params["proposalId"], false, req.body?.evidence ?? {}, req.body?.comment)); } catch (error) { sendProviderError(res, error); }
});
router.post("/proposals/:proposalId/execute", async (req, res): Promise<void> => {
  try { res.json(await executeProposal(req.auth.workspaceId, req.params["proposalId"])); } catch (error) { sendProviderError(res, error); }
});
router.post("/attempts/:attemptId/rollback", async (req, res): Promise<void> => {
  try { res.json(await rollbackAttempt(req.auth.workspaceId, req.params["attemptId"])); } catch (error) { sendProviderError(res, error); }
});

router.get("/policies", async (req, res): Promise<void> => {
  const policies = await db.select().from(paidMediaPoliciesTable).where(eq(paidMediaPoliciesTable.workspaceId, req.auth.workspaceId));
  res.json({ policies });
});
router.put("/policies/:policyId", async (req, res): Promise<void> => {
  const [policy] = await db.update(paidMediaPoliciesTable).set({
    enabled: !!req.body?.enabled, mandatoryPause: !!req.body?.mandatoryPause,
    mandatoryPauseReason: typeof req.body?.mandatoryPauseReason === "string" ? req.body.mandatoryPauseReason : null,
    minimumSampleSize: Math.max(0, Number(req.body?.minimumSampleSize ?? 0)),
    minimumDataQualityScore: String(Math.max(0, Math.min(1, Number(req.body?.minimumDataQualityScore ?? 0)))),
    maxDailyBudgetChangePercent: req.body?.maxDailyBudgetChangePercent == null ? null : String(Math.max(0, Number(req.body.maxDailyBudgetChangePercent))),
    maxDailyBudgetChangeAbsolute: req.body?.maxDailyBudgetChangeAbsolute == null ? null : String(Math.max(0, Number(req.body.maxDailyBudgetChangeAbsolute))),
    maxBidChangePercent: req.body?.maxBidChangePercent == null ? null : String(Math.max(0, Number(req.body.maxBidChangePercent))),
    acceptedAt: req.body?.enabled ? new Date() : null, acceptedBy: req.body?.enabled ? req.auth.userId : null,
    acceptanceExpiresAt: req.body?.acceptanceExpiresAt ? new Date(req.body.acceptanceExpiresAt) : null,
  }).where(and(eq(paidMediaPoliciesTable.id, req.params["policyId"]), eq(paidMediaPoliciesTable.workspaceId, req.auth.workspaceId))).returning();
  if (!policy) { res.status(404).json({ error: "Policy not found.", code: "POLICY_NOT_FOUND" }); return; }
  res.json({ policy });
});
router.get("/proposals", async (req, res): Promise<void> => {
  res.json({ proposals: await db.select().from(paidMediaProposalsTable).where(eq(paidMediaProposalsTable.workspaceId, req.auth.workspaceId)) });
});
router.post("/proposals/generate", async (req, res): Promise<void> => {
  const actionType = req.body?.actionType;
  if (!["pause", "resume", "update_daily_budget", "update_bid", "update_creative_status"].includes(actionType) || typeof req.body?.accountId !== "string" || typeof req.body?.entityId !== "string" || !req.body?.proposedChange) {
    res.status(400).json({ error: "accountId, entityId, actionType and proposedChange are required.", code: "VALIDATION_ERROR" }); return;
  }
  try { res.status(201).json({ proposal: await generateProposal(req.auth.workspaceId, req.body) }); } catch (error) { sendProviderError(res, error); }
});
router.get("/proposals/:proposalId", async (req, res): Promise<void> => {
  const [proposal] = await db.select().from(paidMediaProposalsTable).where(and(eq(paidMediaProposalsTable.id, req.params["proposalId"]), eq(paidMediaProposalsTable.workspaceId, req.auth.workspaceId))).limit(1);
  if (!proposal) { res.status(404).json({ error: "Proposal not found.", code: "PROPOSAL_NOT_FOUND" }); return; } res.json({ proposal });
});
router.get("/attempts", async (req, res): Promise<void> => {
  res.json({ attempts: await db.select().from(paidMediaActionAttemptsTable).where(eq(paidMediaActionAttemptsTable.workspaceId, req.auth.workspaceId)) });
});
router.get("/attempts/:attemptId", async (req, res): Promise<void> => {
  const [attempt] = await db.select().from(paidMediaActionAttemptsTable).where(and(
    eq(paidMediaActionAttemptsTable.id, req.params["attemptId"]),
    eq(paidMediaActionAttemptsTable.workspaceId, req.auth.workspaceId),
  )).limit(1);
  if (!attempt) {
    res.status(404).json({ error: "Action attempt not found.", code: "ATTEMPT_NOT_FOUND" });
    return;
  }
  res.json({ attempt });
});
router.get("/sync-status", async (req, res): Promise<void> => {
  res.json({ cursors: await db.select().from(paidMediaSyncCursorsTable).where(eq(paidMediaSyncCursorsTable.workspaceId, req.auth.workspaceId)) });
});

export default router;