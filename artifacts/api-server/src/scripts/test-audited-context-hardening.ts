import { strict as assert } from "node:assert";
import { test } from "node:test";
import { selectExactCampaignReport } from "../modules/market-intel/market-intel.service.js";
import {
  fingerprintCampaignPerformanceFeedback,
  fingerprintMarketReport,
} from "../modules/agents/campaign-action-context.js";
import { assertAlignedMarketIntel } from "../modules/social-presence/social-presence.service.js";
import { isWorkspaceScopedFeedbackRecord } from "../modules/campaign-brain/traffic-feedback.service.js";

const date = (value: string) => new Date(value);

test("market context selects exact campaign only and never workspace fallback", () => {
  const reports = [
    { campaignId: "other", status: "ready", updatedAt: date("2025-01-03T00:00:00Z"), createdAt: date("2025-01-03T00:00:00Z") },
    { campaignId: null, status: "ready", updatedAt: date("2025-01-04T00:00:00Z"), createdAt: date("2025-01-04T00:00:00Z") },
    { campaignId: "target", status: "failed", updatedAt: date("2025-01-05T00:00:00Z"), createdAt: date("2025-01-05T00:00:00Z") },
  ];
  assert.equal(selectExactCampaignReport(reports, null), null);
  assert.equal(selectExactCampaignReport(reports, "missing"), null);
  assert.equal(selectExactCampaignReport(reports, "target"), null);
});

test("market provenance fingerprint changes when report evidence changes", () => {
  const base = { id: "report-1", source: "intake", updatedAt: date("2025-01-01T00:00:00Z"), output: { gap: "A" } };
  const same = fingerprintMarketReport(base);
  assert.equal(same, fingerprintMarketReport({ ...base, output: { gap: "A" } }));
  assert.notEqual(same, fingerprintMarketReport({ ...base, output: { gap: "B" } }));
  assert.notEqual(same, fingerprintMarketReport({ ...base, updatedAt: date("2025-01-02T00:00:00Z") }));
});

test("observed performance feedback changes the next canonical context version", () => {
  const base = fingerprintCampaignPerformanceFeedback({
    winningHooks: ["prova concreta"],
    lastUpdatedAt: "2025-01-01T00:00:00Z",
  });
  assert.ok(base);
  assert.equal(base, fingerprintCampaignPerformanceFeedback({
    lastUpdatedAt: "2025-01-01T00:00:00Z",
    winningHooks: ["prova concreta"],
  }));
  assert.notEqual(base, fingerprintCampaignPerformanceFeedback({
    winningHooks: ["demonstração visual"],
    lastUpdatedAt: "2025-01-02T00:00:00Z",
  }));
  assert.equal(fingerprintCampaignPerformanceFeedback(null), undefined);
});

test("aligned presence fails closed without exact ready market context", () => {
  assert.throws(
    () => assertAlignedMarketIntel("campaign-1", null),
    /relatório de inteligência de mercado pronto/,
  );
  assert.doesNotThrow(() => assertAlignedMarketIntel(undefined, null));
  assert.doesNotThrow(() => assertAlignedMarketIntel("campaign-1", "exact report"));
});

test("feedback ownership requires both campaign and workspace identity", () => {
  const record = { campaignId: "campaign-1", workspaceId: "workspace-1" };
  assert.equal(isWorkspaceScopedFeedbackRecord(record, "campaign-1", "workspace-1"), true);
  assert.equal(isWorkspaceScopedFeedbackRecord(record, "campaign-1", "workspace-2"), false);
  assert.equal(isWorkspaceScopedFeedbackRecord(record, "campaign-2", "workspace-1"), false);
});