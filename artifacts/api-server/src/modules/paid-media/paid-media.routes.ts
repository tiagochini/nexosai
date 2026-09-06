import { Router, type Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  paidMediaAccountsTable,
  paidMediaPoliciesTable,
  paidMediaProposalsTable,
  paidMediaActionAttemptsTable,
  paidMediaSyncCursorsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  PaidMediaProviderError,
  paidMediaProvider,
  type PaidMediaProviderName,
} from "./providers.js";
import { syncPaidMediaAccount } from "./sync.service.js";
import { decideProposal, executeProposal, rollbackAttempt } from "./actions.service.js";
import { generateProposal } from "./proposals.service.js";

const router = Router();
router.use(requireAuth);

function providerFrom(value: unknown): PaidMediaProviderName | undefined {
  return value === "meta_ads" || value === "tiktok_ads" ? value : undefined;
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
    const accounts = await paidMediaProvider(provider).listAccounts(req.auth.workspaceId);
    const [integration] = await db.select({ id: workspaceIntegrationsTable.id })
      .from(workspaceIntegrationsTable)
      .where(and(eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId), eq(workspaceIntegrationsTable.provider, provider)))
      .limit(1);
    if (!integration) {
      res.status(409).json({ error: "Provider integration is not connected.", code: "INTEGRATION_NOT_CONNECTED" });
      return;
    }
    for (const account of accounts) {
      const [existing] = await db.select({ id: paidMediaAccountsTable.id })
        .from(paidMediaAccountsTable)
        .where(and(eq(paidMediaAccountsTable.workspaceId, req.auth.workspaceId), eq(paidMediaAccountsTable.provider, provider), eq(paidMediaAccountsTable.providerAccountId, account.providerAccountId)))
        .limit(1);
      if (existing) {
        await db.update(paidMediaAccountsTable).set({ accountName: account.name, currency: account.currency, timezone: account.timezone })
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
  if (!["pause", "resume", "update_daily_budget", "update_bid"].includes(actionType) || typeof req.body?.accountId !== "string" || typeof req.body?.entityId !== "string" || !req.body?.proposedChange) {
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