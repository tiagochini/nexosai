import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  db,
  metaCapiTestsTable as tests,
  paidMediaDatasetsTable as datasets,
  paidMediaAccountsTable as accounts,
  paidMediaPoliciesTable as policies,
  mandatoryPausesTable as pauses,
  auditLogsTable as audits,
} from "@workspace/db";
import {
  normalizeMetaCapiEvent,
  sendMetaCapiRequest,
  sendMetaCapiTestRequest,
} from "../modules/paid-media/providers.js";
import {
  prepareCapiTest,
  executeCapiTest,
  expireCapiTests,
} from "../modules/paid-media/meta-capi-tests.service.js";
import { decryptIntegrationToken as decrypt } from "@workspace/db/token-crypto";

const original = { select: db.select, insert: db.insert, update: db.update },
  oldKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
  "base64",
);
const workspaceId = randomUUID(),
  accountId = randomUUID(),
  datasetId = randomUUID();
const account: any = {
  id: accountId,
  workspaceId,
  integrationId: randomUUID(),
  providerAccountId: "act_9",
  provider: "meta_ads",
  isSelected: true,
};
const dataset: any = {
  id: datasetId,
  workspaceId,
  accountId,
  provider: "meta_ads",
  providerDatasetId: "55",
};
const policy: any = {
  workspaceId,
  accountId,
  provider: "meta_ads",
  enabled: true,
  acceptedAt: new Date(),
  mandatoryPause: false,
};
const store = new Map<any, any[]>([
  [tests, []],
  [datasets, [dataset]],
  [accounts, [account]],
  [policies, [policy]],
  [pauses, []],
  [audits, []],
]);
const dialect = new PgDialect();
const camel = (key: string) =>
  key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
function matches(row: any, condition: any) {
  const { sql, params } = dialect.sqlToQuery(condition);
  for (const match of sql.matchAll(/"\w+"\."(\w+)" (=|<) \$(\d+)/g)) {
    const key = camel(match[1]!),
      actual = row[key],
      expected = params[Number(match[3]) - 1];
    if (match[2] === "=" && actual !== expected) return false;
    if (
      match[2] === "<" &&
      !(
        actual <
        (actual instanceof Date
          ? new Date(expected as string)
          : (expected as any))
      )
    )
      return false;
  }
  if (sql.includes("->>'owner'")) {
    const match = sql.match(/->>'owner' = \$(\d+)/)!;
    if (row.intent?.owner !== params[Number(match[1]) - 1]) return false;
  }
  return true;
}
try {
  db.select = (() => ({
    from(table: any) {
      let condition: any,
        limit = Infinity;
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
        then(resolve: any) {
          assert.ok(store.has(table));
          resolve(
            structuredClone(
              store
                .get(table)!
                .filter((row) => matches(row, condition))
                .slice(0, limit),
            ),
          );
        },
      };
      return chain;
    },
  })) as any;
  db.insert = ((table: any) => ({
    values(value: any) {
      const execute = () => {
        assert.ok(store.has(table));
        const row = {
          id: randomUUID(),
          status: "prepared",
          updatedAt: new Date(),
          intent: null,
          evidence: {},
          ...structuredClone(value),
        };
        store.get(table)!.push(row);
        return [structuredClone(row)];
      };
      return {
        returning: async () => execute(),
        then(resolve: any) {
          resolve(execute());
        },
      };
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
              Object.assign(row, structuredClone(patch), {
                updatedAt: new Date(),
              }),
            );
            return structuredClone(rows);
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
  const sha = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const normalized = normalizeMetaCapiEvent({
    eventName: "Lead",
    eventId: "normal",
    occurredAt: new Date().toISOString(),
    matchKeys: {
      firstName: " Ana ",
      lastName: " Silva ",
      city: "Sao Paulo 01.",
      state: " SP ",
      postalCode: "12345-6789",
      country: "BR",
    },
  });
  assert.deepEqual(normalized.userData, {
    fn: sha("ana"),
    ln: sha("silva"),
    ct: sha("saopaulo"),
    st: sha("sp"),
    zp: sha("12345"),
    country: sha("br"),
  });
  assert.equal(
    normalizeMetaCapiEvent({
      eventName: "Lead",
      eventId: "invalid",
      occurredAt: new Date().toISOString(),
      matchKeys: { country: "Brazil", city: " . 123 " },
    }).userData.country,
    undefined,
  );
  let network = 0;
  const fakeHttp = async (_url: string, init: RequestInit) => {
    network++;
    const body = JSON.parse(String(init.body));
    assert.equal(body.test_event_code, "TEST123");
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].event_id, normalized.eventId);
    return new Response(JSON.stringify({ events_received: 1 }), {
      status: 200,
    });
  };
  await sendMetaCapiTestRequest(
    "55",
    "fake-token",
    normalized,
    "TEST123",
    fakeHttp,
  );
  await assert.rejects(
    sendMetaCapiTestRequest("55", "fake-token", normalized, "", fakeHttp),
  );
  for (const invalidCode of [undefined, null, 0, false, {}, ["TEST123"]])
    await assert.rejects(
      sendMetaCapiTestRequest(
        "55",
        "fake-token",
        normalized,
        invalidCode as any,
        fakeHttp,
      ),
    );
  assert.equal(network, 1);
  await assert.rejects(
    sendMetaCapiRequest(
      "55",
      "fake-token",
      { ...normalized, mode: "test" } as any,
      fakeHttp,
    ),
  );
  await assert.rejects(
    sendMetaCapiRequest(
      "55",
      "fake-token",
      { ...normalized, test_event_code: "TEST123" } as any,
      fakeHttp,
    ),
  );
  assert.equal(
    network,
    1,
    "Diagnostic markers cannot fall through to production",
  );
  await sendMetaCapiRequest(
    "55",
    "fake-token",
    normalized,
    async (_url, init) => {
      assert.equal(JSON.parse(String(init.body)).test_event_code, undefined);
      return new Response(JSON.stringify({ events_received: 1 }), {
        status: 200,
      });
    },
  );
  assert.throws(() =>
    normalizeMetaCapiEvent({
      eventName: "Lead",
      eventId: "public",
      occurredAt: new Date().toISOString(),
      payload: { test_event_code: "TEST123" },
    }),
  );
  const input = {
    accountId,
    datasetId,
    eventName: "Lead",
    testEventCode: "TEST123",
    eventSourceUrl: "https://example.test/test?private=value#fragment",
    marketingConsent: true,
    diagnosticSharingConfirmed: true,
    matchKeys: {
      email: "person@example.test",
      firstName: "Ana",
      city: "Cuiaba",
      country: "BR",
    },
  };
  await assert.rejects(
    prepareCapiTest(workspaceId, "actor", {
      ...input,
      marketingConsent: false,
    }),
  );
  await assert.rejects(prepareCapiTest(randomUUID(), "actor", input));
  for (const eventSourceUrl of [
    "invalid-url",
    "http://example.test/",
    "https://private:password@example.test/",
  ])
    await assert.rejects(
      prepareCapiTest(workspaceId, "actor", { ...input, eventSourceUrl }),
      (error: any) => error.code === "CAPI_TEST_INVALID",
    );
  await assert.rejects(
    prepareCapiTest(workspaceId, "actor", {
      ...input,
      testEventCode: undefined,
    }),
  );
  await assert.rejects(
    prepareCapiTest(workspaceId, "actor", {
      ...input,
      matchKeys: { firstName: "Ana" },
    }),
  );
  const prepared = await prepareCapiTest(workspaceId, "actor", input),
    row = store.get(tests)![0]!;
  assert.equal(network, 1, "Preparing never sends an event");
  assert.ok(!JSON.stringify(prepared).includes("TEST123"));
  assert.ok(!JSON.stringify(prepared).includes(input.matchKeys.email));
  const saved = JSON.parse(decrypt(row.encryptedRequest));
  assert.equal(saved.event.userData.em, sha(input.matchKeys.email));
  assert.equal(saved.mode, "test");
  assert.equal(saved.event.eventSourceUrl, "https://example.test/test");
  const read: any = async (ws: string, acct: string, path: string) => {
    assert.equal(ws, workspaceId);
    assert.equal(acct, accountId);
    assert.equal(path, "act_9/adspixels");
    return { data: [{ id: "55" }] };
  };
  let sends = 0;
  const send: any = async (
    ws: string,
    acct: string,
    pixel: string,
    event: any,
    code: string,
  ) => {
    assert.equal(ws, workspaceId);
    assert.equal(acct, accountId);
    assert.equal(pixel, "55");
    assert.equal(code, "TEST123");
    assert.equal(event.userData.em, sha(input.matchKeys.email));
    assert.ok(event.eventTime instanceof Date);
    assert.equal(row.intent.stage, "send_test");
    sends++;
    return { evidence: { events_received: 1 } };
  };
  await assert.rejects(
    executeCapiTest(workspaceId, row.id, "wrong", "actor", send, read),
  );
  policy.enabled = false;
  await assert.rejects(
    executeCapiTest(workspaceId, row.id, row.requestHash, "actor", send, read),
  );
  policy.enabled = true;
  const originalIntegration = account.integrationId;
  account.integrationId = randomUUID();
  await assert.rejects(
    executeCapiTest(workspaceId, row.id, row.requestHash, "actor", send, read),
  );
  account.integrationId = originalIntegration;
  const results = await Promise.allSettled([
    executeCapiTest(workspaceId, row.id, row.requestHash, "actor", send, read),
    executeCapiTest(workspaceId, row.id, row.requestHash, "actor", send, read),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(sends, 1);
  assert.equal(row.status, "sent_test");
  assert.equal(row.encryptedRequest, null);
  assert.equal(row.evidence.eventsManagerVerified, false);
  await executeCapiTest(
    workspaceId,
    row.id,
    row.requestHash,
    "actor",
    send,
    read,
  );
  assert.equal(sends, 1);
  const ambiguous = await prepareCapiTest(workspaceId, "actor", input),
    ambiguousRow = store.get(tests)!.find((item) => item.id === ambiguous.id)!;
  const lost: any = async () => {
    sends++;
    throw new Error("private provider response must not persist");
  };
  assert.equal(
    (
      await executeCapiTest(
        workspaceId,
        ambiguous.id,
        ambiguous.requestHash,
        "actor",
        lost,
        read,
      )
    ).status,
    "manual_recovery",
  );
  await assert.rejects(
    executeCapiTest(
      workspaceId,
      ambiguous.id,
      ambiguous.requestHash,
      "actor",
      lost,
      read,
    ),
  );
  assert.equal(sends, 2);
  assert.equal(ambiguousRow.encryptedRequest, null);
  const expired = await prepareCapiTest(workspaceId, "actor", input),
    expiredRow = store.get(tests)!.find((item) => item.id === expired.id)!;
  expiredRow.expiresAt = new Date(0);
  await assert.rejects(
    executeCapiTest(
      workspaceId,
      expired.id,
      expired.requestHash,
      "actor",
      send,
      read,
    ),
  );
  await expireCapiTests();
  assert.equal(expiredRow.status, "expired");
  assert.equal(expiredRow.encryptedRequest, null);
  const preflight = await prepareCapiTest(workspaceId, "actor", input);
  assert.equal(
    (
      await executeCapiTest(
        workspaceId,
        preflight.id,
        preflight.requestHash,
        "actor",
        send,
        (async () => ({ data: [] })) as any,
      )
    ).status,
    "failed",
  );
  assert.equal(sends, 2);
  assert.ok(!JSON.stringify(store.get(audits)).includes("TEST123"));
  assert.ok(!JSON.stringify(store.get(audits)).includes(input.matchKeys.email));
  console.log(
    "PASS CAPI diagnostics: normalized extra keys, separate test transport, production rejection, consent/scope/hash/policy, encrypted preparation, concurrent claim, intent, no replay, TTL cleanup and sanitized evidence; no live Meta calls",
  );
} finally {
  Object.assign(db, original);
  if (oldKey === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = oldKey;
}
