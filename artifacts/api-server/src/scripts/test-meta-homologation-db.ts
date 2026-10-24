import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  workspacesTable,
  plansTable,
  workspaceIntegrationsTable,
  paidMediaAccountsTable,
  paidMediaPoliciesTable,
  paidMediaEntitiesTable,
  paidMediaDatasetsTable,
  paidMediaEventReceiptsTable,
  metaCapiTestsTable,
  launchSequencesTable,
  sequenceContactsTable,
  metaAudienceOperationsTable as audiences,
  metaCrmSyncsTable as syncs,
  metaCrmConsentsTable as consents,
  metaExperimentsTable as experiments,
} from "@workspace/db";
import { assertHomologationDatabase } from "./helpers/homologation-database.js";
import {
  prepareCapiTest,
  executeCapiTest,
} from "../modules/paid-media/meta-capi-tests.service.js";
import {
  prepareAudienceOperation,
  approveAudienceOperation,
  executeAudienceOperation,
} from "../modules/paid-media/meta-audience.service.js";
import {
  recordCrmConsent,
  prepareCrmSync,
  setCrmSyncEnabled,
  runCrmSync,
} from "../modules/paid-media/meta-crm-sync.service.js";
import {
  prepareExperiment,
  approveExperiment,
  executeExperiment,
  cancelExperiment,
  experimentPayload,
} from "../modules/paid-media/meta-experiments.service.js";

if (process.env.META_ADS_HOMOLOGATION_DB !== "true")
  throw new Error("Explicit META_ADS_HOMOLOGATION_DB=true required");
const connection = await pool.connect();
try {
  await assertHomologationDatabase(connection);
} finally {
  connection.release();
}
const original = {
  select: db.select,
  insert: db.insert,
  update: db.update,
  delete: db.delete,
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => {
  throw new Error("No HTTP delivery allowed in this PostgreSQL regression");
}) as typeof fetch;
const rolledBack = new Error("ROLLBACK_ALL_META_FIXTURES"),
  marker = `meta-db-${randomUUID()}`;
let workspaceId = "",
  assertionsCompleted = false;
try {
  await db.transaction(async (tx) => {
    // Exercise real services/SQL in one transaction, including their global db seam.
    // Roll back fixtures, consent proofs, approvals and audit rows even on success.
    db.select = tx.select.bind(tx) as typeof db.select;
    db.insert = tx.insert.bind(tx) as typeof db.insert;
    db.update = tx.update.bind(tx) as typeof db.update;
    db.delete = tx.delete.bind(tx) as typeof db.delete;
    try {
      await tx.execute(sql`set local statement_timeout = '15s'`);
      const [plan] = await tx
        .select({ id: plansTable.id })
        .from(plansTable)
        .limit(1);
      assert.ok(
        plan,
        "An existing homologation plan is required; this test does not seed commercial plans",
      );
      const [user] = await tx
        .insert(usersTable)
        .values({
          email: `${marker}@example.test`,
          name: marker,
          passwordHash: "disabled-test-account",
        })
        .returning();
      const [workspace] = await tx
        .insert(workspacesTable)
        .values({
          ownerId: user!.id,
          planId: plan.id,
          name: marker,
          slug: marker,
        })
        .returning();
      workspaceId = workspace!.id;
      const [foreign] = await tx
        .insert(workspacesTable)
        .values({
          ownerId: user!.id,
          planId: plan.id,
          name: `${marker}-foreign`,
          slug: `${marker}-foreign`,
        })
        .returning();
      const [integration] = await tx
        .insert(workspaceIntegrationsTable)
        .values({
          workspaceId,
          provider: "meta_ads",
          status: "connected",
          accessToken: "fake-no-provider-token",
          metadata: { integrationPurpose: "paid_media" },
        })
        .returning();
      const [account] = await tx
        .insert(paidMediaAccountsTable)
        .values({
          workspaceId,
          integrationId: integration!.id,
          provider: "meta_ads",
          providerAccountId: "act_990000000001",
          currency: "BRL",
          timezone: "America/Cuiaba",
          isSelected: true,
        })
        .returning();
      const accountId = account!.id;
      await tx.insert(paidMediaPoliciesTable).values({
        workspaceId,
        accountId,
        provider: "meta_ads",
        enabled: true,
        autoExecute: true,
        acceptedAt: new Date(),
        acceptedBy: user!.id,
      });
      const [sequence] = await tx
        .insert(launchSequencesTable)
        .values({ workspaceId, name: marker })
        .returning();
      const [contact] = await tx
        .insert(sequenceContactsTable)
        .values({
          workspaceId,
          sequenceId: sequence!.id,
          email: `${marker}@example.test`,
          segment: "cold",
        })
        .returning();
      const seed = await prepareAudienceOperation(workspaceId, user!.id, {
        accountId,
        kind: "crm",
        syncSeed: true,
        members: [],
        name: marker,
        idempotencyKey: marker,
        dataRightsConfirmed: true,
      });
      await approveAudienceOperation(
        workspaceId,
        seed.id,
        seed.requestHash,
        user!.id,
      );
      const [prepared] = await tx
        .select()
        .from(audiences)
        .where(eq(audiences.id, seed.id));
      let audiencePosts = 0;
      const audienceTransport: any = async (
        _ws: string,
        _account: string,
        path: string,
        options: any = {},
      ) => {
        assert.equal(_ws, workspaceId);
        assert.equal(_account, accountId);
        if (options.method === "POST") {
          audiencePosts++;
          assert.equal(path, "account/customaudiences");
          return { id: "990000000002" };
        }
        return {
          id: "990000000002",
          account_id: "990000000001",
          name: marker,
          description: (prepared!.summary as any).marker,
          subtype: "CUSTOM",
          customer_file_source: "USER_PROVIDED_ONLY",
          is_value_based: false,
        };
      };
      assert.equal(
        (
          await executeAudienceOperation(
            workspaceId,
            seed.id,
            seed.requestHash,
            user!.id,
            audienceTransport,
          )
        ).status,
        "ready",
      );
      assert.equal(audiencePosts, 1);
      const proofInput = {
        contactId: contact!.id,
        granted: true,
        consentedAt: new Date(Date.now() - 1000).toISOString(),
        consentReference: marker,
        metaAudienceSharingConfirmed: true,
      };
      await assert.rejects(recordCrmConsent(foreign!.id, user!.id, proofInput));
      await recordCrmConsent(workspaceId, user!.id, proofInput);
      const program = await prepareCrmSync(workspaceId, user!.id, {
        accountId,
        sequenceId: sequence!.id,
        seedOperationId: seed.id,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      assert.equal(program.enabled, false);
      // A unique seed has only one program. Use a savepoint for the expected SQL conflict.
      await tx
        .transaction(async (savepoint) => {
          await assert.rejects(
            savepoint.insert(syncs).values({
              workspaceId,
              accountId,
              sequenceId: sequence!.id,
              seedOperationId: seed.id,
              audienceId: "990000000002",
              configuration: {},
              configurationHash: "duplicate",
              expiresAt: new Date(Date.now() + 3600000),
            }),
            (error: any) => error.cause?.code === "23505",
          );
          savepoint.rollback();
        })
        .catch((error) => {
          if (error?.message !== "Rollback") throw error;
        });
      await setCrmSyncEnabled(
        workspaceId,
        program.id,
        program.configurationHash,
        true,
        user!.id,
      );
      let mutations: string[] = [];
      const crmTransport: any = async (
        ws: string,
        acct: string,
        path: string,
        options: any = {},
      ) => {
        assert.equal(ws, workspaceId);
        assert.equal(acct, accountId);
        if (!options.method) return audienceTransport(ws, acct, path, options);
        const [state] = await tx
          .select()
          .from(syncs)
          .where(eq(syncs.id, program.id));
        assert.ok(state!.intent);
        assert.ok(state!.leaseOwner);
        mutations.push(options.method);
        assert.ok(
          options.payload.payload.data.every((row: string[]) =>
            row.every((value) => !value || /^[a-f0-9]{64}$/.test(value)),
          ),
        );
        return {
          audience_id: "990000000002",
          num_received: options.payload.payload.data.length,
          num_invalid_entries: 0,
        };
      };
      await Promise.all([
        runCrmSync(program.id, workspaceId, crmTransport),
        runCrmSync(program.id, workspaceId, crmTransport),
      ]);
      assert.deepEqual(mutations, ["POST"]);
      await recordCrmConsent(workspaceId, user!.id, {
        contactId: contact!.id,
        granted: false,
        metaAudienceSharingConfirmed: true,
      });
      await tx
        .update(syncs)
        .set({ nextRunAt: new Date(0) })
        .where(eq(syncs.id, program.id));
      await runCrmSync(program.id, workspaceId, crmTransport);
      assert.deepEqual(mutations, ["POST", "DELETE"]);
      assert.equal(
        (
          await tx
            .select()
            .from(consents)
            .where(eq(consents.contactId, contact!.id))
        )[0]!.encryptedProof,
        null,
      );
      await recordCrmConsent(workspaceId, user!.id, proofInput);
      await tx
        .update(syncs)
        .set({ nextRunAt: new Date(0) })
        .where(eq(syncs.id, program.id));
      await runCrmSync(program.id, workspaceId, (async (
        ws: string,
        acct: string,
        path: string,
        options: any,
      ) => {
        if (options?.method) throw new Error("simulated lost response");
        return crmTransport(ws, acct, path, options);
      }) as any);
      const [blocked] = await tx
        .select()
        .from(syncs)
        .where(eq(syncs.id, program.id));
      assert.equal(blocked!.status, "blocked");
      assert.ok(blocked!.intent);
      await assert.rejects(
        setCrmSyncEnabled(
          workspaceId,
          program.id,
          program.configurationHash,
          true,
          user!.id,
        ),
      );
      await tx.insert(paidMediaEntitiesTable).values(
        ["990000000003", "990000000004"].map((providerEntityId) => ({
          workspaceId,
          accountId,
          provider: "meta_ads" as const,
          providerEntityId,
          entityType: "ad" as const,
          currency: "BRL",
          timezone: "America/Cuiaba",
          status: "PAUSED",
        })),
      );
      const experiment = await prepareExperiment(workspaceId, user!.id, {
        accountId,
        businessId: "990000000005",
        name: marker,
        adA: "990000000003",
        adB: "990000000004",
        startAt: new Date(Date.now() + 3600000).toISOString(),
        endAt: new Date(Date.now() + 7200000).toISOString(),
      });
      await approveExperiment(
        workspaceId,
        experiment.id,
        experiment.configurationHash,
        user!.id,
      );
      const config = experiment.configuration as any;
      const experimentTransport: any = async (
        ws: string,
        acct: string,
        path: string,
        options: any = {},
      ) => {
        assert.equal(ws, workspaceId);
        assert.equal(acct, accountId);
        if (path === "account")
          return {
            id: account!.providerAccountId,
            business: { id: config.businessId },
          };
        if ([config.adA, config.adB].includes(path)) {
          assert.equal(options.method, undefined);
          return { id: path, account_id: "990000000001", status: "PAUSED" };
        }
        if (options.method === "POST") return { id: "990000000006" };
        if (options.method === "DELETE") return { success: true };
        if (path.endsWith("/ad_studies")) return { data: [] };
        const [state] = await tx
          .select()
          .from(experiments)
          .where(eq(experiments.id, experiment.id));
        assert.equal(state!.providerStudyId, "990000000006");
        return {
          id: "990000000006",
          ...experimentPayload(config),
          business: { id: config.businessId },
          cells: [
            { name: "A", ad_ids: [config.adA], treatment_percentage: 50 },
            { name: "B", ad_ids: [config.adB], treatment_percentage: 50 },
          ],
        };
      };
      assert.equal(
        (
          await executeExperiment(
            workspaceId,
            experiment.id,
            experiment.configurationHash,
            user!.id,
            experimentTransport,
          )
        ).status,
        "ready",
      );
      assert.equal(
        (
          await cancelExperiment(
            workspaceId,
            experiment.id,
            experiment.configurationHash,
            user!.id,
            experimentTransport,
          )
        ).status,
        "cancelled",
      );
      const [dataset] = await tx
        .insert(paidMediaDatasetsTable)
        .values({
          workspaceId,
          accountId,
          provider: "meta_ads",
          providerDatasetId: "990000000007",
          ingestionKey: randomUUID(),
        })
        .returning();
      const diagnostic = await prepareCapiTest(workspaceId, user!.id, {
        accountId,
        datasetId: dataset!.id,
        eventName: "Lead",
        testEventCode: "TEST_DB_FIXTURE",
        eventSourceUrl: "https://example.test/diagnostic?private=discard",
        marketingConsent: true,
        diagnosticSharingConfirmed: true,
        matchKeys: {
          email: `${marker}@example.test`,
          firstName: "Fixture",
          country: "BR",
        },
      });
      let testCalls = 0;
      const sendTest: any = async (
        ws: string,
        acct: string,
        pixel: string,
        event: any,
        code: string,
      ) => {
        assert.equal(ws, workspaceId);
        assert.equal(acct, accountId);
        assert.equal(pixel, dataset!.providerDatasetId);
        assert.equal(code, "TEST_DB_FIXTURE");
        assert.equal(event.userData.fn.length, 64);
        assert.ok(event.eventTime instanceof Date);
        assert.equal(event.eventSourceUrl, "https://example.test/diagnostic");
        const [state] = await tx
          .select()
          .from(metaCapiTestsTable)
          .where(eq(metaCapiTestsTable.id, diagnostic.id));
        assert.equal((state!.intent as any).stage, "send_test");
        testCalls++;
        return { evidence: { events_received: 1 } };
      };
      const readPixel: any = async (ws: string, acct: string, path: string) => {
        assert.equal(ws, workspaceId);
        assert.equal(acct, accountId);
        assert.equal(path, `${account!.providerAccountId}/adspixels`);
        return { data: [{ id: dataset!.providerDatasetId }] };
      };
      await assert.rejects(
        executeCapiTest(
          foreign!.id,
          diagnostic.id,
          diagnostic.requestHash,
          user!.id,
          sendTest,
          readPixel,
        ),
      );
      const attempts = await Promise.allSettled([
        executeCapiTest(
          workspaceId,
          diagnostic.id,
          diagnostic.requestHash,
          user!.id,
          sendTest,
          readPixel,
        ),
        executeCapiTest(
          workspaceId,
          diagnostic.id,
          diagnostic.requestHash,
          user!.id,
          sendTest,
          readPixel,
        ),
      ]);
      assert.ok(attempts.some((result) => result.status === "fulfilled"));
      assert.equal(testCalls, 1);
      const [sentTest] = await tx
        .select()
        .from(metaCapiTestsTable)
        .where(eq(metaCapiTestsTable.id, diagnostic.id));
      assert.equal(sentTest!.status, "sent_test");
      assert.equal(sentTest!.encryptedRequest, null);
      assert.deepEqual(
        await tx
          .select()
          .from(paidMediaEventReceiptsTable)
          .where(eq(paidMediaEventReceiptsTable.workspaceId, workspaceId)),
        [],
        "Diagnostics never insert production receipts",
      );
      assertionsCompleted = true;
      throw rolledBack;
    } finally {
      Object.assign(db, original);
    }
  });
} catch (error) {
  if (error !== rolledBack) throw error;
} finally {
  Object.assign(db, original);
  globalThis.fetch = originalFetch;
  try {
    if (assertionsCompleted)
      assert.equal(
        (
          await pool.query("select id from workspaces where id=$1", [
            workspaceId,
          ])
        ).rowCount,
        0,
      );
  } finally {
    await pool.end();
  }
}
assert.ok(assertionsCompleted);
console.log(
  "PASS actual homologation PostgreSQL: RLS/runtime role, consent/upsert/revocation, exclusive seed, SQL claim interleaving, durable intent, ambiguity stop, A/B readback/cancellation, isolated CAPI Test Events; entire fixture transaction rolled back; provider HTTP disabled. Cross-connection contention is not certified by this single-transaction test.",
);
