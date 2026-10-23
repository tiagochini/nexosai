import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  db,
  campaignsTable,
  pagesTable,
  domainsTable,
  paidMediaDatasetsTable,
  contentPiecesTable,
  landingRevisionsTable,
  landingDeploymentsTable,
  auditLogsTable,
  masterplanVersionsTable,
} from "@workspace/db";
import {
  prepareLandingUpgrade,
  publishLandingUpgrade,
} from "../modules/landing-publication/landing-upgrade.service.js";

// Real transaction service, in-memory Drizzle seam; no DB, DNS or provider calls.
const original = db.transaction;
const dialect = new PgDialect();
const source = {
  pageTitle: "Landing",
  metaTitle: "Landing",
  metaDescription: "Description",
  sections: [
    {
      headline: "Title",
      bodyContent: "Approved content",
      cta: { text: "Open" },
    },
  ],
};
const setup = {
  desiredDomain: "example.test",
  scheduledAt: new Date(Date.now() - 60_000).toISOString(),
  status: "ready_for_implementation",
};
const campaign = {
  id: "campaign",
  workspaceId: "workspace",
  landingSetupData: setup,
};
const page: any = {
  id: "page",
  workspaceId: "workspace",
  campaignId: "campaign",
  domainId: "domain",
  status: "published",
  html: "legacy-html",
  publishedUrl: "https://example.test/",
  metadata: {},
  leadCaptureSequenceId: null,
};
const revisions: any[] = [],
  deployments: any[] = [],
  audits: any[] = [];
const dataset = {
  id: "dataset",
  workspaceId: "workspace",
  provider: "meta_ads",
  providerDatasetId: "12345",
};
const domain = {
  id: "domain",
  workspaceId: "workspace",
  domain: "example.test",
  dnsVerified: true,
};
let approved = true,
  locks = 0;
const input = {
  source,
  setup,
  implementation: {
    ctas: [
      {
        key: "hero",
        label: "Open",
        action: "url" as const,
        target: "https://example.test/info",
      },
    ],
    tracking: {
      metaDatasetId: "dataset",
      metaPixelId: "12345",
      metaLeadEventName: "Lead" as const,
    },
  },
};
function selected(table: unknown, condition: any) {
  const { params, sql } = dialect.sqlToQuery(condition);
  if (
    [
      campaignsTable,
      pagesTable,
      domainsTable,
      paidMediaDatasetsTable,
      contentPiecesTable,
      masterplanVersionsTable,
    ].includes(table as any)
  ) {
    assert.match(sql, /workspace_id/, "owned reads must be workspace scoped");
    if (!params.includes("workspace")) return [];
  }
  if (table === campaignsTable) return [campaign];
  if (table === pagesTable) return [page];
  if (table === domainsTable) return [domain];
  if (table === paidMediaDatasetsTable) return [dataset];
  if (table === contentPiecesTable)
    return approved ? [{ content: source }] : [];
  if (table === masterplanVersionsTable) return [];
  if (table === landingRevisionsTable)
    return revisions
      .filter((row) =>
        sql.includes('"id" =')
          ? params.includes(row.id)
          : params.includes(row.pageId),
      )
      .sort((a, b) => b.revision - a.revision);
  throw new Error("Unexpected table");
}
const tx = {
  select: () => ({
    from: (table: unknown) => {
      let condition: any,
        limit = Infinity;
      const chain: any = {
        where(value: any) {
          condition = value;
          return chain;
        },
        orderBy() {
          return chain;
        },
        limit(value: number) {
          limit = value;
          return chain;
        },
        for(mode: string) {
          assert.equal(mode, "update");
          locks++;
          return chain;
        },
        then(resolve: (value: unknown) => void) {
          resolve(selected(table, condition).slice(0, limit));
        },
      };
      return chain;
    },
  }),
  insert: (table: unknown) => ({
    values: (value: any) => {
      const execute = () => {
        const rows =
          table === landingRevisionsTable
            ? revisions
            : table === landingDeploymentsTable
              ? deployments
              : table === auditLogsTable
                ? audits
                : undefined;
        assert.ok(rows);
        const row = { ...structuredClone(value), id: `row-${rows.length}` };
        rows.push(row);
        return [row];
      };
      return {
        returning: async () => execute(),
        then: (resolve: (value: unknown) => void) => resolve(execute()),
      };
    },
  }),
  update: (table: unknown) => ({
    set: (patch: any) => ({
      where: async (condition: any) => {
        const { params, sql } = dialect.sqlToQuery(condition);
        if (table === pagesTable) Object.assign(page, patch);
        else if (table === campaignsTable) Object.assign(campaign, patch);
        else if (table === landingRevisionsTable)
          revisions
            .filter((row) =>
              sql.includes('"id" =')
                ? params.includes(row.id)
                : params.includes(row.pageId) && params.includes(row.status),
            )
            .forEach((row) => Object.assign(row, patch));
        else throw new Error("Unexpected update");
      },
    }),
  }),
};
try {
  db.transaction = (async (callback: any) => callback(tx)) as any;
  const preview = await prepareLandingUpgrade(
    "workspace",
    "campaign",
    input,
    "reviewer",
  );
  assert.equal(
    page.html,
    "legacy-html",
    "preparing revision cannot replace live page",
  );
  assert.equal(deployments.length, 0);
  assert.equal(revisions[0].status, "validated");
  assert.ok(preview.html.includes('"pageId":"page"'));
  await assert.rejects(
    publishLandingUpgrade("other-workspace", "campaign", preview, "reviewer"),
  );
  await assert.rejects(
    publishLandingUpgrade(
      "workspace",
      "campaign",
      { ...preview, contentHash: "wrong-hash" },
      "reviewer",
    ),
  );
  campaign.landingSetupData = { ...setup, status: "changed" };
  await assert.rejects(
    publishLandingUpgrade("workspace", "campaign", preview, "reviewer"),
  );
  campaign.landingSetupData = setup;
  domain.dnsVerified = false;
  await assert.rejects(
    publishLandingUpgrade("workspace", "campaign", preview, "reviewer"),
  );
  domain.dnsVerified = true;
  approved = false;
  await assert.rejects(
    publishLandingUpgrade("workspace", "campaign", preview, "reviewer"),
  );
  approved = true;
  dataset.providerDatasetId = "changed";
  await assert.rejects(
    publishLandingUpgrade("workspace", "campaign", preview, "reviewer"),
  );
  dataset.providerDatasetId = "12345";
  assert.equal(deployments.length, 0);
  assert.equal(page.html, "legacy-html");
  const published = await publishLandingUpgrade(
    "workspace",
    "campaign",
    preview,
    "reviewer",
  );
  assert.equal(published.url, "https://example.test/");
  assert.equal(published.pageId, "page");
  assert.equal(page.html, preview.html);
  assert.ok(page.metadata.implementation.tracking.metaEventKey);
  assert.equal(revisions[0].status, "published");
  assert.equal(deployments.length, 1);
  await publishLandingUpgrade("workspace", "campaign", preview, "reviewer");
  assert.equal(
    deployments.length,
    1,
    "repeated explicit publication is idempotent",
  );
  assert.ok(locks >= 4);
  assert.equal(audits.at(-1).actor, "reviewer");
  console.log(
    "PASS landing upgrade: immutable preview, no early live mutation, workspace/approval/DNS/dataset/setup/hash guards, same URL, publication idempotency",
  );
} finally {
  db.transaction = original;
}
