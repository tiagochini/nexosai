import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, paidMediaDatasetsTable, paidMediaEventReceiptsTable } from "@workspace/db";
import { datasetDiagnostics } from "../modules/paid-media/attribution.service.js";

const original = { select: db.select, update: db.update };
const dialect = new PgDialect();
const workspaceId = "11111111-1111-4111-8111-111111111111";
const datasetId = "22222222-2222-4222-8222-222222222222";
let selectCount = 0;
let diagnosticUpdate = false;
const keyCounts = {
  events: 4,
  matched: 3,
  email: 2,
  phone: 1,
  externalId: 1,
  firstName: 2,
  lastName: 1,
  city: 1,
  state: 1,
  postalCode: 1,
  country: 2,
  fbp: 1,
  fbc: 1,
  sent: 2,
  blocked: 1,
  queued: 1,
  consentWithheld: 1,
  failed: 0,
};

try {
  db.select = ((fields?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      assert.ok(table === paidMediaDatasetsTable || table === paidMediaEventReceiptsTable);
      return {
        where: (condition: unknown) => {
          const query = dialect.sqlToQuery(condition as never);
          if (table === paidMediaDatasetsTable) {
            assert.ok(query.params.includes(workspaceId), "dataset lookup must be workspace scoped");
            if (!query.params.includes(datasetId)) {
              return { limit: async () => [] };
            }
            return {
              limit: async () => [{ id: datasetId, workspaceId, lastEventAt: new Date("2026-10-24T12:00:00Z") }],
            };
          }
          assert.ok(query.params.includes(datasetId), "receipt aggregate must be dataset scoped");
          assert.deepEqual(
            Object.keys(fields ?? {}).sort(),
            Object.keys(keyCounts).sort(),
            "only aggregate counts, not receipt data or identifiers, may be selected",
          );
          selectCount++;
          return { then: (resolve: (value: unknown) => void) => resolve([keyCounts]) };
        },
      };
    },
  })) as unknown as typeof db.select;
  db.update = ((table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: (condition: unknown) => {
        assert.equal(table, paidMediaDatasetsTable);
        assert.ok(values.lastDiagnosticAt instanceof Date);
        const query = dialect.sqlToQuery(condition as never);
        assert.ok(query.params.includes(datasetId));
        diagnosticUpdate = true;
        return { then: (resolve: (value: unknown) => void) => resolve([]) };
      },
    }),
  })) as typeof db.update;

  const report = await datasetDiagnostics(workspaceId, datasetId);
  assert.equal(selectCount, 1);
  assert.equal(diagnosticUpdate, true);
  assert.equal(report.eventCount, 4);
  assert.equal(report.matchKeyEventCount, 3);
  assert.equal(report.localMatchKeyCoverage, 0.75);
  assert.equal(report.keyCoverage.find((item) => item.key === "email")?.rate, 0.5);
  assert.equal(report.keyCoverage.find((item) => item.key === "phone")?.eventCount, 1);
  assert.deepEqual(report.providerDelivery, {
    queued: 1,
    sent: 2,
    capabilityBlocked: 1,
    consentWithheld: 1,
    failed: 0,
  });
  assert.equal(report.metaEventMatchQuality, null);
  assert.equal(report.browserServerDeduplication, "not_verified");
  assert.equal(JSON.stringify(report).includes("person@example"), false);

  const emptyStats = { ...keyCounts, events: 0, matched: 0 };
  db.select = ((fields?: Record<string, unknown>) => ({
    from: (table: unknown) => ({
      where: (condition: unknown) => table === paidMediaDatasetsTable
        ? { limit: async () => dialect.sqlToQuery(condition as never).params.includes(datasetId) ? [{ id: datasetId, workspaceId, lastEventAt: null }] : [] }
        : { then: (resolve: (value: unknown) => void) => resolve([emptyStats]) },
    }),
  })) as unknown as typeof db.select;
  const empty = await datasetDiagnostics(workspaceId, datasetId);
  assert.equal(empty.status, "no_events");
  assert.equal(empty.localMatchKeyCoverage, 0);
  assert.ok(empty.keyCoverage.every((item) => item.rate === 0));

  await assert.rejects(
    () => datasetDiagnostics(workspaceId, "33333333-3333-4333-8333-333333333333"),
    /Dataset not found/,
  );
  console.log("Meta CAPI local diagnostics: PASS (workspace scope, aggregate-only query, key coverage, delivery states, no EMQ claim, empty dataset)");
} finally {
  Object.assign(db, original);
}
