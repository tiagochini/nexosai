import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  db,
  auditLogsTable,
  mandatoryPausesTable,
  metaAudienceOperationsTable as operations,
  paidMediaAccountsTable,
  paidMediaPoliciesTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import {
  prepareAudienceOperation,
  approveAudienceOperation,
  executeAudienceOperation,
  rollbackAudienceOperation,
  recoverAudienceOperation,
  cancelAudienceOperation,
  verifyAudienceRollback,
} from "../modules/paid-media/meta-audience.service.js";
import { metaAccountAssetRequest } from "../modules/paid-media/providers.js";
import { env } from "../lib/env.js";

const original = { select: db.select, insert: db.insert, update: db.update },
  oldKey = process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"];
const originalFetch = globalThis.fetch,
  originalInstagram = env.INSTAGRAM_APP_ID,
  originalE2e = env.META_E2E_TEST_MODE;
process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = Buffer.alloc(32, 8).toString(
  "base64",
);
const workspaceId = randomUUID(),
  accountId = randomUUID();
const account: any = {
  id: accountId,
  workspaceId,
  integrationId: randomUUID(),
  provider: "meta_ads",
  providerAccountId: "act_9",
  isSelected: true,
};
const policy: any = {
  accountId,
  enabled: true,
  acceptedAt: new Date(),
  acceptanceExpiresAt: null,
  mandatoryPause: false,
};
let credentialPurpose = "paid_media";
const stored: any[] = [],
  audits: any[] = [];
const dialect = new PgDialect();
let mandatory = false,
  calls = 0,
  creates = 0,
  uploads = 0;
const values = (condition: any) => dialect.sqlToQuery(condition);
function matching(condition: any) {
  const { params, sql } = values(condition);
  const statuses = [
    "draft",
    "approved",
    "executing",
    "ready",
    "failed",
    "manual_recovery",
    "rolling_back",
    "rolled_back",
    "expired",
  ];
  const expected = params.find((value) => statuses.includes(String(value)));
  return stored.filter((row) => {
    if (!params.includes(row.workspaceId)) return false;
    if (/"id" =/.test(sql) && !params.includes(row.id)) return false;
    if (/"idempotency_key" =/.test(sql) && !params.includes(row.idempotencyKey))
      return false;
    if (/"request_hash" =/.test(sql) && !params.includes(row.requestHash))
      return false;
    if (/"status" =/.test(sql) && expected && row.status !== expected)
      return false;
    if (sql.includes("->>'owner'") && !params.includes(row.intent?.owner))
      return false;
    return true;
  });
}
try {
  db.select = (() => ({
    from: (table: unknown) => {
      let condition: any,
        limit = Infinity;
      const execute = () => {
        const { params, sql } = values(condition);
        if (table === operations)
          return structuredClone(matching(condition).slice(0, limit));
        assert.match(sql, /workspace_id/);
        if (!params.includes(workspaceId)) return [];
        if (table === paidMediaAccountsTable)
          return account.isSelected && params.includes(accountId)
            ? [structuredClone(account)]
            : [];
        if (table === mandatoryPausesTable)
          return mandatory ? [{ id: "pause", status: "active" }] : [];
        if (table === paidMediaPoliciesTable) return [structuredClone(policy)];
        if (table === workspaceIntegrationsTable)
          return [
            {
              integrationId: "organic",
              accessToken: "organic-secret",
              metadata: { integrationPurpose: "organic_social" },
            },
            {
              integrationId: account.integrationId,
              accessToken: "paid-secret",
              metadata: { integrationPurpose: credentialPurpose },
            },
          ];
        throw new Error("Unexpected select");
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
        then(resolve: (value: unknown) => void) {
          resolve(execute());
        },
      };
      return chain;
    },
  })) as any;
  db.insert = ((table: unknown) => ({
    values: (value: any) => {
      const execute = () => {
        if (table === auditLogsTable) {
          audits.push(structuredClone(value));
          return [];
        }
        assert.equal(table, operations);
        if (
          stored.some(
            (row) =>
              row.workspaceId === value.workspaceId &&
              row.idempotencyKey === value.idempotencyKey,
          )
        )
          return [];
        const row = {
          id: randomUUID(),
          status: "draft",
          intent: null,
          providerAudienceId: null,
          evidence: {},
          errorCode: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...structuredClone(value),
        };
        stored.push(row);
        return [structuredClone(row)];
      };
      const chain: any = {
        onConflictDoNothing() {
          return chain;
        },
        returning: async () => execute(),
        then: (resolve: (value: unknown) => void) => resolve(execute()),
      };
      return chain;
    },
  })) as any;
  db.update = ((table: unknown) => ({
    set: (patch: any) => ({
      where: (condition: any) => {
        assert.equal(table, operations);
        const execute = () => {
          const rows = matching(condition);
          rows.forEach((row) =>
            Object.assign(row, structuredClone(patch), {
              updatedAt: new Date(),
            }),
          );
          return structuredClone(rows);
        };
        return {
          returning: async () => execute(),
          then: (resolve: (value: unknown) => void) => resolve(execute()),
        };
      },
    }),
  })) as any;
  const member = {
    email: "private@example.test",
    phone: "+5511999999999",
    marketingConsent: true,
    consentedAt: new Date(Date.now() - 1000).toISOString(),
    consentReference: "private-consent",
  };
  const input = {
    accountId,
    kind: "crm",
    name: "Consented CRM",
    dataRightsConfirmed: true,
    members: [member],
    idempotencyKey: "operation-one",
  };
  const draft = await prepareAudienceOperation(workspaceId, "reviewer", input);
  assert.equal(calls, 0);
  assert.equal(
    (await prepareAudienceOperation(workspaceId, "reviewer", input)).id,
    draft.id,
  );
  await assert.rejects(
    prepareAudienceOperation(workspaceId, "reviewer", {
      ...input,
      name: "Changed",
    }),
  );
  for (const secret of [member.email, member.phone, member.consentReference])
    assert.equal(JSON.stringify(stored).includes(secret), false);
  assert.equal("encryptedRequest" in draft, false);
  await assert.rejects(
    approveAudienceOperation(
      randomUUID(),
      draft.id,
      draft.requestHash,
      "reviewer",
    ),
  );
  await assert.rejects(
    approveAudienceOperation(workspaceId, draft.id, "wrong", "reviewer"),
  );
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      draft.id,
      draft.requestHash,
      "reviewer",
    ),
  );
  await approveAudienceOperation(
    workspaceId,
    draft.id,
    draft.requestHash,
    "reviewer",
  );
  mandatory = true;
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      draft.id,
      draft.requestHash,
      "reviewer",
    ),
  );
  mandatory = false;
  policy.enabled = false;
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      draft.id,
      draft.requestHash,
      "reviewer",
    ),
  );
  policy.enabled = true;
  account.isSelected = false;
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      draft.id,
      draft.requestHash,
      "reviewer",
    ),
  );
  account.isSelected = true;
  const integration = account.integrationId;
  account.integrationId = randomUUID();
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      draft.id,
      draft.requestHash,
      "reviewer",
    ),
  );
  account.integrationId = integration;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const send: typeof metaAccountAssetRequest = async (
    workspace,
    selected,
    path,
    options = {},
  ) => {
    calls++;
    assert.equal(workspace, workspaceId);
    assert.equal(selected, accountId);
    const row = stored.find((item) => item.id === draft.id);
    if (options.method === "POST" && path === "account/customaudiences") {
      creates++;
      assert.equal(
        row.intent.stage,
        "create",
        "durable intent precedes provider creation",
      );
      await gate;
      return { id: "555" };
    }
    if (options.method === "POST" && path === "555/users") {
      uploads++;
      assert.equal(
        row.providerAudienceId,
        "555",
        "provider ID persisted before any upload",
      );
      assert.equal(row.intent.stage, "upload");
      assert.equal(
        JSON.stringify(options.payload).includes(member.email),
        false,
      );
      return { audience_id: "555", num_received: 1, num_invalid_entries: 0 };
    }
    assert.equal(path, "555");
    assert.equal(row.providerAudienceId, "555");
    return {
      id: "555",
      name: input.name,
      account_id: "9",
      subtype: "CUSTOM",
      description: row.summary.marker,
      customer_file_source: "USER_PROVIDED_ONLY",
    };
  };
  const first = executeAudienceOperation(
    workspaceId,
    draft.id,
    draft.requestHash,
    "reviewer",
    send,
  );
  const second = executeAudienceOperation(
    workspaceId,
    draft.id,
    draft.requestHash,
    "reviewer",
    send,
  );
  const completion = Promise.allSettled([first, second]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(creates, 1);
  release!();
  const results = await completion;
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  const ready = stored.find((row) => row.id === draft.id);
  assert.equal(ready.status, "ready");
  assert.equal(ready.encryptedRequest, null);
  assert.equal(uploads, 1);
  const beforeDuplicate = calls;
  await executeAudienceOperation(
    workspaceId,
    draft.id,
    draft.requestHash,
    "reviewer",
    send,
  );
  assert.equal(calls, beforeDuplicate);
  const rollback: typeof metaAccountAssetRequest = async (
    _workspace,
    _account,
    path,
    options = {},
  ) => {
    if (options.method === "DELETE") {
      assert.equal(ready.intent.stage, "delete");
      return { success: true };
    }
    if (path === "account/customaudiences") return { data: [] };
    return {
      id: "555",
      name: input.name,
      account_id: "9",
      subtype: "CUSTOM",
      description: ready.summary.marker,
    };
  };
  await rollbackAudienceOperation(
    workspaceId,
    draft.id,
    draft.requestHash,
    "reviewer",
    rollback,
  );
  assert.equal(ready.status, "rolled_back");
  assert.equal(ready.evidence.rollback.absenceVerified, true);
  // A delayed/lost deletion is reconciled by reads, without another DELETE.
  ready.status = "manual_recovery";
  ready.intent = { stage: "delete" };
  let reconciliationReads = 0;
  let wrongAccountReads = 0;
  account.providerAccountId = "act_10";
  await assert.rejects(
    verifyAudienceRollback(
      workspaceId,
      draft.id,
      draft.requestHash,
      "reviewer",
      async () => {
        wrongAccountReads++;
        return { data: [] };
      },
    ),
  );
  assert.equal(wrongAccountReads, 0, "scope changes block the read before querying a different account");
  account.providerAccountId = "act_9";
  await verifyAudienceRollback(
    workspaceId,
    draft.id,
    draft.requestHash,
    "reviewer",
    async (_workspace, _account, _path, options = {}) => {
      assert.equal(options.method, undefined);
      reconciliationReads++;
      return { data: [] };
    },
  );
  assert.equal(reconciliationReads, 1);
  assert.equal(ready.status, "rolled_back");
  const ambiguous = await prepareAudienceOperation(workspaceId, "reviewer", {
    ...input,
    idempotencyKey: "ambiguous",
  });
  await approveAudienceOperation(
    workspaceId,
    ambiguous.id,
    ambiguous.requestHash,
    "reviewer",
  );
  let ambiguousCalls = 0;
  const failed = await executeAudienceOperation(
    workspaceId,
    ambiguous.id,
    ambiguous.requestHash,
    "reviewer",
    async () => {
      ambiguousCalls++;
      throw new Error("upstream echoed private@example.test token=secret");
    },
  );
  assert.equal(failed.status, "manual_recovery");
  assert.equal(ambiguousCalls, 1);
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      ambiguous.id,
      ambiguous.requestHash,
      "reviewer",
      async () => {
        ambiguousCalls++;
        return { id: "666" };
      },
    ),
  );
  assert.equal(ambiguousCalls, 1, "ambiguous creation cannot be replayed");
  assert.equal(JSON.stringify(stored).includes("token=secret"), false);
  const row = stored.find((item) => item.id === ambiguous.id);
  await assert.rejects(
    recoverAudienceOperation(
      workspaceId,
      ambiguous.id,
      ambiguous.requestHash,
      "666",
      "reviewer",
      async () => ({
        id: "666",
        name: input.name,
        account_id: "8",
        subtype: "CUSTOM",
        description: row.summary.marker,
        customer_file_source: "USER_PROVIDED_ONLY",
      }),
    ),
  );
  await recoverAudienceOperation(
    workspaceId,
    ambiguous.id,
    ambiguous.requestHash,
    "666",
    "reviewer",
    async () => ({
      id: "666",
      name: input.name,
      account_id: "9",
      subtype: "CUSTOM",
      description: row.summary.marker,
      customer_file_source: "USER_PROVIDED_ONLY",
    }),
  );
  assert.equal(row.providerAudienceId, "666");
  assert.equal(
    row.status,
    "manual_recovery",
    "recovery never repeats upload or claims completion",
  );
  const fenced = await prepareAudienceOperation(workspaceId, "reviewer", {
    ...input,
    idempotencyKey: "fenced-execution",
  });
  await approveAudienceOperation(
    workspaceId,
    fenced.id,
    fenced.requestHash,
    "reviewer",
  );
  let fencedCalls = 0;
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      fenced.id,
      fenced.requestHash,
      "reviewer",
      async () => {
        fencedCalls++;
        stored.find((item) => item.id === fenced.id).status = "manual_recovery";
        return { id: "777" };
      },
    ),
  );
  assert.equal(
    fencedCalls,
    1,
    "lost ownership prevents readback, upload and completion",
  );
  assert.equal(
    stored.find((item) => item.id === fenced.id).status,
    "manual_recovery",
  );
  const cancel = await prepareAudienceOperation(workspaceId, "reviewer", {
    ...input,
    idempotencyKey: "cancelled",
  });
  await cancelAudienceOperation(
    workspaceId,
    cancel.id,
    cancel.requestHash,
    "reviewer",
  );
  assert.equal(
    stored.find((row) => row.id === cancel.id).encryptedRequest,
    null,
  );
  await assert.rejects(
    executeAudienceOperation(
      workspaceId,
      cancel.id,
      cancel.requestHash,
      "reviewer",
      send,
    ),
  );
  const expired = await prepareAudienceOperation(workspaceId, "reviewer", {
    ...input,
    idempotencyKey: "expired-operation",
  });
  stored.find((row) => row.id === expired.id).expiresAt = new Date(
    Date.now() - 1,
  );
  await assert.rejects(
    approveAudienceOperation(
      workspaceId,
      expired.id,
      expired.requestHash,
      "reviewer",
    ),
  );
  assert.ok(
    audits.some((row) => row.action === "meta.audience.provider_confirmed"),
  );
  assert.ok(audits.some((row) => row.action === "meta.audience.rolled_back"));
  (env as any).INSTAGRAM_APP_ID = undefined;
  (env as any).META_E2E_TEST_MODE = false;
  let networkCalls = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    networkCalls++;
    const parsed = new URL(String(url));
    assert.equal(parsed.hostname, "graph.facebook.com");
    assert.equal(parsed.pathname, "/v26.0/act_9/customaudiences");
    assert.equal(
      parsed.searchParams.get("access_token"),
      "paid-secret",
      "exact selected paid integration is used",
    );
    return new Response(
      JSON.stringify({
        error: { message: "private@example.test token=secret" },
      }),
      { status: 429 },
    );
  }) as typeof fetch;
  await assert.rejects(
    metaAccountAssetRequest(workspaceId, accountId, "account/customaudiences", {
      method: "POST",
      payload: { name: "Safe" },
    }),
    (error) => {
      assert.equal(String(error).includes(member.email), false);
      assert.equal(String(error).includes("token=secret"), false);
      return true;
    },
  );
  assert.equal(
    networkCalls,
    1,
    "non-idempotent audience requests never retry HTTP 429",
  );
  credentialPurpose = "organic_social";
  await assert.rejects(
    metaAccountAssetRequest(workspaceId, accountId, "account/customaudiences"),
  );
  assert.equal(
    networkCalls,
    1,
    "organic credentials cannot cross the paid boundary",
  );
  console.log(
    "PASS audience operations: encrypted preparation, consent minimization, hash/scope/policy/pause/approval guards, concurrent claim, intent/ID persistence, explicit CRM upload, ambiguity fencing, recovery, verified rollback, cancel and expiry",
  );
} finally {
  Object.assign(db, original);
  globalThis.fetch = originalFetch;
  (env as any).INSTAGRAM_APP_ID = originalInstagram;
  (env as any).META_E2E_TEST_MODE = originalE2e;
  if (oldKey === undefined)
    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"];
  else process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = oldKey;
}
