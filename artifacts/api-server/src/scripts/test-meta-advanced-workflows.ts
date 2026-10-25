import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  db,
  paidMediaAccountsTable as accounts,
  paidMediaPoliciesTable as policies,
  mandatoryPausesTable as pauses,
  auditLogsTable as audits,
  metaAudienceOperationsTable as seeds,
  metaCrmConsentsTable as consents,
  metaCrmSyncsTable as syncs,
  sequenceContactsTable as contacts,
  launchSequencesTable as sequences,
  metaExperimentsTable as experiments,
  paidMediaEntitiesTable as entities,
} from "@workspace/db";
import { decryptIntegrationToken as decrypt } from "@workspace/db/token-crypto";
import {
  prepareAudienceOperation,
  approveAudienceOperation,
  executeAudienceOperation,
  rollbackAudienceOperation,
} from "../modules/paid-media/meta-audience.service.js";
import {
  compileAudienceRequest,
  assertAudienceReadback,
} from "../modules/paid-media/meta-audience.policy.js";
import {
  creativeAutomationSchema,
  assertLifecycle,
} from "../modules/paid-media/meta-automation.policy.js";
import {
  recordCrmConsent,
  prepareCrmSync,
  setCrmSyncEnabled,
  runCrmSync,
  contactKeys,
  planCrmSync,
} from "../modules/paid-media/meta-crm-sync.service.js";
import {
  prepareExperiment,
  approveExperiment,
  executeExperiment,
  cancelExperiment,
  verifyExperimentDeletion,
  recoverExperiment,
  experimentPayload,
  compareExperimentInsights,
  assertExperimentReadback,
} from "../modules/paid-media/meta-experiments.service.js";

const original = { select: db.select, insert: db.insert, update: db.update },
  previousKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);
const workspaceId = randomUUID(),
  accountId = randomUUID(),
  sequenceId = randomUUID(),
  seedId = randomUUID(),
  contactId = randomUUID();
const account = {
  id: accountId,
  workspaceId,
  integrationId: randomUUID(),
  provider: "meta_ads",
  providerAccountId: "act_9",
  isSelected: true,
};
const policy = {
  id: randomUUID(),
  workspaceId,
  accountId,
  provider: "meta_ads",
  enabled: true,
  acceptedAt: new Date(),
  acceptanceExpiresAt: null,
  mandatoryPause: false,
  autoExecute: true,
};
const contact = {
  id: contactId,
  workspaceId,
  sequenceId,
  email: "PERSON@example.test",
  phone: "+55 (65) 99999-8888",
  segment: "new",
};
const store = new Map<any, any[]>([
  [accounts, [account]],
  [policies, [policy]],
  [pauses, []],
  [audits, []],
  [consents, []],
  [syncs, []],
  [experiments, []],
  [contacts, [contact]],
  [sequences, [{ id: sequenceId, workspaceId }]],
  [
    seeds,
    [
      {
        id: seedId,
        requestHash: "a".repeat(64),
        workspaceId,
        accountId,
        status: "ready",
        providerAudienceId: "77",
        summary: {
          kind: "crm",
          syncSeed: true,
          name: "CRM seed",
          marker: "NexOS seed",
          binding: {
            providerAccountId: account.providerAccountId,
            integrationId: account.integrationId,
          },
        },
      },
    ],
  ],
  [
    entities,
    ["11", "12"].map((providerEntityId) => ({
      workspaceId,
      accountId,
      provider: "meta_ads",
      entityType: "ad",
      providerEntityId,
    })),
  ],
]);
const dialect = new PgDialect(),
  clone = <T>(value: T): T => structuredClone(value);
const property = (name: string) =>
  name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
// Evaluate the predicates exercised here, including status/owner/lease fences.
function matches(row: any, condition: any) {
  const { sql, params } = dialect.sqlToQuery(condition);
  for (const match of sql.matchAll(/"\w+"\."(\w+)" (=|<=|>) \$(\d+)/g)) {
    const key = property(match[1]!),
      expected: any = params[Number(match[3]) - 1],
      actual = row[key];
    const comparable = actual instanceof Date ? new Date(expected) : expected;
    if (key === "leaseExpiresAt" && sql.includes(" or ")) continue;
    if (
      (match[2] === "=" && actual !== expected) ||
      (match[2] === "<=" && !(actual <= comparable)) ||
      (match[2] === ">" && !(actual > comparable))
    )
      return false;
  }
  if (sql.includes("->>'owner'")) {
    const match = sql.match(/->>'owner' = \$(\d+)/)!;
    if (row.intent?.owner !== params[Number(match[1]) - 1]) return false;
  }
  for (const match of sql.matchAll(/"\w+"\."(\w+)" is null/g)) {
    const key = property(match[1]!);
    if (key === "provider" || key === "accountId") continue; // Scoped OR in authorization.
    if (key === "leaseOwner" && sql.includes(" or ")) {
      if (row.leaseOwner != null && !(row.leaseExpiresAt <= new Date()))
        return false;
    } else if (row[key] != null) return false;
  }
  return true;
}
let graphCalls = 0,
  posts = 0,
  deletes = 0;
try {
  db.select = (() => ({
    from(table: any) {
      let condition: any,
        limit = Infinity,
        joined = false;
      const execute = () => {
        assert.ok(store.has(table), "Unexpected table");
        const selected = store
          .get(table)!
          .filter((row) => matches(row, condition))
          .slice(0, limit);
        return clone(
          joined
            ? selected.map((contact) => ({
                contact,
                consent:
                  store
                    .get(consents)!
                    .find(
                      (proof) =>
                        proof.workspaceId === contact.workspaceId &&
                        proof.contactId === contact.id,
                    ) ?? null,
              }))
            : selected,
        );
      };
      const chain: any = {
        where(value: any) {
          condition = value;
          return chain;
        },
        limit(value: number) {
          limit = value;
          return chain;
        },
        orderBy() {
          return chain;
        },
        leftJoin() {
          joined = true;
          return chain;
        },
        then(resolve: any) {
          resolve(execute());
        },
      };
      return chain;
    },
  })) as any;
  db.insert = ((table: any) => ({
    values(value: any) {
      let upsert: any;
      const execute = () => {
        if (table === consents) {
          const existing = store
            .get(table)!
            .find(
              (row) =>
                row.workspaceId === value.workspaceId &&
                row.contactId === value.contactId,
            );
          if (existing) {
            Object.assign(existing, clone(upsert));
            return [];
          }
        }
        const row = {
          id: randomUUID(),
          status: "draft",
          enabled: false,
          intent: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          nextRunAt: new Date(),
          providerStudyId: null,
          evidence: {},
          errorCode: null,
          updatedAt: new Date(),
          ...clone(value),
        };
        store.get(table)!.push(row);
        return [clone(row)];
      };
      const chain: any = {
        onConflictDoNothing() {
          return chain;
        },
        onConflictDoUpdate(options: any) {
          upsert = options.set;
          return chain;
        },
        returning: async () => execute(),
        then(resolve: any) {
          resolve(execute());
        },
      };
      return chain;
    },
  })) as any;
  db.update = ((table: any) => ({
    set(patch: any) {
      return {
        where(condition: any) {
          const execute = () => {
            const rows = store
              .get(table)!
              .filter((row) => matches(row, condition));
            rows.forEach((row) =>
              Object.assign(row, clone(patch), { updatedAt: new Date() }),
            );
            return clone(rows);
          };
          return {
            returning: async () => execute(),
            then(resolve: any) {
              resolve(execute());
            },
          };
        },
      };
    },
  })) as any;

  const common = {
    accountId,
    idempotencyKey: "advanced-policy",
    name: "approved",
    dataRightsConfirmed: true,
  };
  for (const platform of ["facebook", "instagram"] as const) {
    const compiled = compileAudienceRequest({
      ...common,
      kind: "engagement",
      platform,
      sourceId: "123",
      retentionDays: 30,
    });
    assert.equal(compiled.request.payload.subtype, "ENGAGEMENT");
    assert.equal(
      JSON.parse(String(compiled.request.payload.rule)).inclusions.rules[0]
        .event_sources[0].type,
      platform === "facebook" ? "page" : "ig_business",
    );
    assertAudienceReadback(
      { ...compiled.request.payload, id: "88", account_id: "9" },
      "act_9",
      compiled.request.payload,
      "88",
    );
  }
  const member = {
    email: "person@example.test",
    marketingConsent: true,
    consentedAt: new Date(Date.now() - 1000).toISOString(),
    consentReference: "record-1",
    value: 10,
  };
  const valued = compileAudienceRequest({
    ...common,
    kind: "crm",
    valueBased: true,
    currency: "BRL",
    members: [member, { ...member, email: "other@example.test", value: 100 }],
  });
  assert.deepEqual(valued.request.memberSchema, [
    "EMAIL",
    "PHONE",
    "LOOKALIKE_VALUE",
  ]);
  assert.equal(valued.request.members[0]![2], "10");
  assert.ok(!JSON.stringify(valued.request).includes(member.email));
  assert.throws(() =>
    compileAudienceRequest({
      ...common,
      kind: "crm",
      valueBased: true,
      currency: "BRL",
      members: [member, { ...member, value: 100 }],
    }),
  );
  assert.throws(() =>
    assertAudienceReadback(
      {
        ...valued.request.payload,
        id: "88",
        account_id: "9",
        is_value_based: false,
      },
      "9",
      valued.request.payload,
      "88",
    ),
  );
  assert.throws(() =>
    compileAudienceRequest({ ...common, kind: "crm", members: [] }),
  );
  assert.equal(
    compileAudienceRequest({
      ...common,
      kind: "crm",
      members: [],
      syncSeed: true,
    }).request.members.length,
    0,
  );
  assert.equal(
    creativeAutomationSchema.safeParse({
      creative_features_spec: { image_touchups: { enroll_status: "OPT_IN" } },
    }).success,
    true,
  );
  assert.equal(
    creativeAutomationSchema.safeParse({
      creative_features_spec: { unknown_feature: { enroll_status: "OPT_IN" } },
    }).success,
    false,
  );
  assertLifecycle(
    { mode: "acquisition", customerAudienceIds: ["77"] },
    { excluded_custom_audiences: [{ id: "77" }] },
  );
  assert.throws(() =>
    assertLifecycle(
      { mode: "retention", customerAudienceIds: ["77"] },
      {
        custom_audiences: [{ id: "77" }],
        targeting_automation: { advantage_audience: 1 },
      },
    ),
  );
  assertLifecycle(
    { mode: "retention", customerAudienceIds: ["77"] },
    {
      custom_audiences: [{ id: "77" }],
      targeting_automation: { advantage_audience: 0 },
    },
  );

  for (const scenario of [
    "engagement",
    "value-list",
    "value-origin-block",
  ] as const) {
    const payload =
      scenario === "engagement"
        ? {
            kind: "engagement",
            platform: "facebook",
            sourceId: "123",
            retentionDays: 30,
          }
        : scenario === "value-list"
          ? {
              kind: "crm",
              valueBased: true,
              currency: "BRL",
              members: [
                member,
                { ...member, email: "second@example.test", value: 100 },
              ],
            }
          : {
              kind: "lookalike",
              originAudienceId: "55",
              country: "BR",
              ratio: 0.01,
              valueBased: true,
            };
    const operation = await prepareAudienceOperation(workspaceId, "actor", {
      ...common,
      ...payload,
      idempotencyKey: `scenario-${scenario}`,
    });
    await approveAudienceOperation(
      workspaceId,
      operation.id,
      operation.requestHash,
      "actor",
    );
    let createdPayload: any,
      upload = false;
    const transport: any = async (
      _ws: string,
      _acct: string,
      path: string,
      opts: any = {},
    ) => {
      if (path === "act_9/promote_pages") return { data: [{ id: "123" }] };
      if (path === "act_9/customaudiences") return { data: [{ id: "55" }] };
      if (path === "55") return { id: "55", is_value_based: false };
      if (path === "account/customaudiences") {
        createdPayload = opts.payload;
        return { id: "88" };
      }
      if (path === "88/users") {
        upload = true;
        assert.deepEqual(opts.payload.payload.schema, [
          "EMAIL",
          "PHONE",
          "LOOKALIKE_VALUE",
        ]);
        return { audience_id: "88", num_received: 2, num_invalid_entries: 0 };
      }
      assert.equal(path, "88");
      return { ...createdPayload, id: "88", account_id: "9" };
    };
    const result = await executeAudienceOperation(
      workspaceId,
      operation.id,
      operation.requestHash,
      "actor",
      transport,
    );
    assert.equal(
      result.status,
      scenario === "value-origin-block" ? "failed" : "ready",
    );
    assert.equal(upload, scenario === "value-list");
    if (scenario === "value-origin-block")
      assert.equal(
        createdPayload,
        undefined,
        "Reject an unvalued origin before creating a Lookalike",
      );
  }

  const consentInput = {
    contactId,
    granted: true,
    consentedAt: member.consentedAt,
    consentReference: "specific-meta-consent",
    metaAudienceSharingConfirmed: true,
  };
  await assert.rejects(recordCrmConsent(randomUUID(), "actor", consentInput));
  await recordCrmConsent(workspaceId, "actor", consentInput);
  const proof = store.get(consents)![0]!;
  assert.ok(!proof.encryptedProof.includes(contact.email));
  assert.equal(JSON.parse(decrypt(proof.encryptedProof)).contactId, contactId);
  const prepared = await prepareCrmSync(workspaceId, "actor", {
    accountId,
    sequenceId,
    seedOperationId: seedId,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(prepared.enabled, false);
  assert.equal(graphCalls, 0);
  const sync = store.get(syncs)![0]!;
  const crmCalls: Array<{ method: string; data: string[][] }> = [];
  const crmTransport: any = async (
    ws: string,
    acct: string,
    path: string,
    options: any = {},
  ) => {
    assert.equal(ws, workspaceId);
    assert.equal(acct, accountId);
    graphCalls++;
    if (path === "77")
      return {
        id: "77",
        name: "CRM seed",
        description: "NexOS seed",
        account_id: "9",
        subtype: "CUSTOM",
        is_value_based: false,
      };
    assert.equal(path, "77/users");
    assert.ok(sync.intent);
    assert.ok(sync.leaseOwner);
    assert.deepEqual(options.payload.payload.schema, ["EMAIL", "PHONE"]);
    const data = options.payload.payload.data;
    assert.ok(
      data.every((row: string[]) =>
        row.every((value) => value === "" || /^[a-f0-9]{64}$/.test(value)),
      ),
    );
    crmCalls.push({ method: options.method, data: clone(data) });
    return {
      audience_id: "77",
      num_received: data.length,
      num_invalid_entries: 0,
    };
  };
  await runCrmSync(sync.id, workspaceId, crmTransport);
  assert.equal(graphCalls, 0);
  policy.autoExecute = false;
  await assert.rejects(
    setCrmSyncEnabled(
      workspaceId,
      sync.id,
      sync.configurationHash,
      true,
      "actor",
    ),
  );
  policy.autoExecute = true;
  await setCrmSyncEnabled(
    workspaceId,
    sync.id,
    sync.configurationHash,
    true,
    "actor",
  );
  await Promise.all([
    runCrmSync(sync.id, workspaceId, crmTransport),
    runCrmSync(sync.id, workspaceId, crmTransport),
  ]);
  await assert.rejects(
    rollbackAudienceOperation(
      workspaceId,
      seedId,
      store.get(seeds)![0].requestHash,
      "actor",
      crmTransport,
    ),
    /Pause a sincronização/,
  );
  assert.equal(crmCalls.length, 1, "Only one worker may send the addition");
  assert.deepEqual(crmCalls[0]!.data, [contactKeys(contact)]);
  const due = () => {
    sync.nextRunAt = new Date(0);
  };
  contact.email = "changed@example.test";
  due();
  await runCrmSync(sync.id, workspaceId, crmTransport);
  assert.equal(
    crmCalls[1]!.method,
    "DELETE",
    "Changed identifier removes old consented hashes",
  );
  await recordCrmConsent(workspaceId, "actor", consentInput);
  due();
  await runCrmSync(sync.id, workspaceId, crmTransport);
  assert.equal(crmCalls[2]!.method, "POST");
  await recordCrmConsent(workspaceId, "actor", {
    contactId,
    granted: false,
    metaAudienceSharingConfirmed: true,
  });
  due();
  await runCrmSync(sync.id, workspaceId, crmTransport);
  assert.equal(crmCalls[3]!.method, "DELETE");
  assert.equal(proof.encryptedProof, null);
  assert.deepEqual(
    planCrmSync(
      [
        ["a", ""],
        ["a", ""],
      ],
      [["b", ""]],
    ),
    { remove: [["a", ""]], add: [["b", ""]], desired: [["b", ""]] },
  );
  await recordCrmConsent(workspaceId, "actor", consentInput);
  due();
  await runCrmSync(sync.id, workspaceId, (async (
    ws: string,
    acct: string,
    path: string,
    opts: any,
  ) => {
    if (opts?.method === "POST") {
      assert.ok(sync.intent);
      throw new Error("network response lost");
    }
    return crmTransport(ws, acct, path, opts);
  }) as any);
  assert.equal(sync.status, "blocked");
  assert.ok(sync.intent);
  assert.equal(sync.enabled, false);
  await assert.rejects(
    setCrmSyncEnabled(
      workspaceId,
      sync.id,
      sync.configurationHash,
      true,
      "actor",
    ),
  );
  const beforeBlocked = graphCalls;
  await runCrmSync(sync.id, workspaceId, crmTransport);
  assert.equal(graphCalls, beforeBlocked);

  const input = {
    accountId,
    businessId: "33",
    name: "Approved A/B",
    adA: "11",
    adB: "12",
    startAt: new Date(Date.now() + 3600000).toISOString(),
    endAt: new Date(Date.now() + 86400000).toISOString(),
  };
const comparison = compareExperimentInsights([
  { ad_id: "11", impressions: "1000", clicks: "50", spend: "100", actions: [{ action_type: "purchase", value: "25" }], action_values: [{ action_type: "purchase", value: "500" }] },
  { ad_id: "12", impressions: "1000", clicks: "40", spend: "100", actions: [{ action_type: "purchase", value: "12" }], action_values: [{ action_type: "purchase", value: "300" }] },
], "11", "12");
assert.equal(comparison.A.ctr, 5);
assert.equal(comparison.A.cpa, 4);
assert.equal(comparison.B.roas, 3);
assert.equal(comparison.winner, null, "descriptive metrics must not imply statistical winner");
assert.equal(comparison.conclusion, "insufficient_sample");
  const experiment = await prepareExperiment(workspaceId, "actor", input),
    row = store.get(experiments)![0]!;
  const remoteStudy = (id: string) => ({
    id,
    ...experimentPayload(row.configuration),
    business: { id: "33" },
    cells: [
      { name: "A", ad_ids: ["11"], treatment_percentage: 50 },
      { name: "B", ad_ids: ["12"], treatment_percentage: 50 },
    ],
  });
  const expTransport: any = async (
    ws: string,
    acct: string,
    path: string,
    options: any = {},
  ) => {
    assert.equal(ws, workspaceId);
    assert.equal(acct, accountId);
    graphCalls++;
    if (path === "account") return { id: "act_9", business: { id: "33" } };
    if (["11", "12"].includes(path)) {
      assert.ok(!options.method, "Ads must never be mutated");
      return { id: path, account_id: "9", status: "PAUSED" };
    }
    if (options.method === "POST") {
      assert.equal(path, "33/ad_studies");
      assert.equal(row.intent.stage, "create");
      assert.equal(row.intent.before.length, 2);
      posts++;
      return { id: "99" };
    }
    if (options.method === "DELETE") {
      assert.equal(path, "99");
      assert.equal(row.intent.stage, "delete");
      assert.ok(row.intent.before);
      deletes++;
      return { success: true };
    }
    if (path === "33/ad_studies") return { data: [] };
    assert.equal(path, "99");
    assert.equal(row.providerStudyId, "99", "Persist ID before readback");
    return remoteStudy("99");
  };
  await assert.rejects(
    executeExperiment(
      workspaceId,
      experiment.id,
      experiment.configurationHash,
      "actor",
      expTransport,
    ),
  );
  await assert.rejects(
    approveExperiment(
      randomUUID(),
      experiment.id,
      experiment.configurationHash,
      "actor",
    ),
  );
  await approveExperiment(
    workspaceId,
    experiment.id,
    experiment.configurationHash,
    "actor",
  );
  await assert.rejects(
    executeExperiment(
      workspaceId,
      experiment.id,
      "bad-hash",
      "actor",
      expTransport,
    ),
  );
  const result = await executeExperiment(
    workspaceId,
    experiment.id,
    experiment.configurationHash,
    "actor",
    expTransport,
  );
  assert.equal(result.status, "ready");
  assert.equal((result.evidence as any).winner, null);
  assert.equal(posts, 1);
  await executeExperiment(
    workspaceId,
    experiment.id,
    experiment.configurationHash,
    "actor",
    expTransport,
  );
  assert.equal(posts, 1);
  assert.throws(() =>
    assertExperimentReadback(
      { ...remoteStudy("99"), business: { id: "foreign" } },
      row.configuration,
      "99",
    ),
  );
  assert.throws(() =>
    assertExperimentReadback(
      {
        ...remoteStudy("99"),
        cells: [
          { name: "A", ad_ids: ["12"], treatment_percentage: 50 },
          { name: "B", ad_ids: ["11"], treatment_percentage: 50 },
        ],
      },
      row.configuration,
      "99",
    ),
  );
  await cancelExperiment(
    workspaceId,
    row.id,
    row.configurationHash,
    "actor",
    expTransport,
  );
  assert.equal(deletes, 1);
  assert.equal(row.status, "cancelled");
  // A lost delete receipt must permit absence readback, never another DELETE.
  row.status = "ready";
  row.intent = null;
  const lostDelete: any = async (
    ws: string,
    acct: string,
    path: string,
    opts: any,
  ) => {
    if (opts?.method === "DELETE") {
      deletes++;
      throw new Error("response lost");
    }
    return expTransport(ws, acct, path, opts);
  };
  await assert.rejects(
    cancelExperiment(
      workspaceId,
      row.id,
      row.configurationHash,
      "actor",
      lostDelete,
    ),
  );
  assert.equal(row.status, "manual_recovery");
  await assert.rejects(
    cancelExperiment(
      workspaceId,
      row.id,
      row.configurationHash,
      "actor",
      lostDelete,
    ),
  );
  assert.equal(deletes, 2);
  await verifyExperimentDeletion(
    workspaceId,
    row.id,
    row.configurationHash,
    "actor",
    expTransport,
  );
  assert.equal(row.status, "cancelled");
  // A lost create receipt similarly cannot be replayed; recovery checks the marker and full design.
  row.status = "approved";
  row.providerStudyId = null;
  row.intent = null;
  const lostCreate: any = async (
    ws: string,
    acct: string,
    path: string,
    opts: any,
  ) => {
    if (opts?.method === "POST") {
      posts++;
      throw new Error("response lost");
    }
    return expTransport(ws, acct, path, opts);
  };
  await executeExperiment(
    workspaceId,
    row.id,
    row.configurationHash,
    "actor",
    lostCreate,
  );
  assert.equal(row.status, "manual_recovery");
  await assert.rejects(
    executeExperiment(
      workspaceId,
      row.id,
      row.configurationHash,
      "actor",
      lostCreate,
    ),
  );
  assert.equal(posts, 2);
  await recoverExperiment(
    workspaceId,
    row.id,
    row.configurationHash,
    "99",
    "actor",
    (async () => remoteStudy("99")) as any,
  );
  assert.equal(row.status, "ready");
  const serializedAudit = JSON.stringify(store.get(audits));
  assert.ok(!serializedAudit.includes(contact.email));
  assert.ok(!serializedAudit.includes("specific-meta-consent"));
  console.log(
    "PASS Meta advanced workflows: engagement/value policies, explicit lifecycle, consent scope/revocation, recurring authorization, concurrent lease, hashing, ambiguity fences, A/B ownership/approval/readback, create/delete recovery; no live Graph or database",
  );
} finally {
  Object.assign(db, original);
  if (previousKey === undefined)
    delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = previousKey;
}
