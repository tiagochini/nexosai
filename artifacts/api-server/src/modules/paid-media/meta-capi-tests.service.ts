import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import {
  db,
  metaCapiTestsTable as tests,
  paidMediaDatasetsTable as datasets,
  auditLogsTable,
} from "@workspace/db";
import {
  encryptIntegrationToken as encrypt,
  decryptIntegrationToken as decrypt,
} from "@workspace/db/token-crypto";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { deterministicHash } from "../masterplan/masterplan.service.js";
import { accountFor, authorizeMetaAsset } from "./meta-audience.service.js";
import {
  normalizeMetaCapiEvent,
  sendMetaTestConversion,
  metaAccountAssetRequest,
  type MetaCapiEvent,
} from "./providers.js";
import { requireAccountAssets } from "./meta-asset-preflight.js";

export const capiTestSchema = z
  .object({
    accountId: z.string().uuid(),
    datasetId: z.string().uuid(),
    testEventCode: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    eventSourceUrl: z
      .url()
      .max(2000)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }),
    eventName: z.enum([
      "PageView",
      "Lead",
      "CompleteRegistration",
      "Purchase",
      "AddToCart",
      "InitiateCheckout",
      "ViewContent",
      "Schedule",
      "Contact",
    ]),
    marketingConsent: z.literal(true),
    diagnosticSharingConfirmed: z.literal(true),
    matchKeys: z
      .object({
        email: z.email().optional(),
        phone: z
          .string()
          .regex(/^\+[1-9]\d{7,14}$/)
          .optional(),
        externalId: z.string().trim().min(1).max(200).optional(),
        firstName: z.string().max(200).optional(),
        lastName: z.string().max(200).optional(),
        city: z.string().max(200).optional(),
        state: z.string().max(200).optional(),
        postalCode: z.string().max(200).optional(),
        country: z
          .string()
          .regex(/^[A-Za-z]{2}$/)
          .optional(),
      })
      .strict(),
    value: z.number().finite().min(0).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.matchKeys.email ||
      value.matchKeys.phone ||
      value.matchKeys.externalId,
    "Informe ao menos um identificador consentido.",
  )
  .refine(
    (value) => (value.value == null) === (value.currency == null),
    "Informe valor e moeda juntos.",
  );
type Test = typeof tests.$inferSelect;
function blocked(message: string): never {
  throw new AppError(409, message, "CAPI_TEST_BLOCKED");
}
export function capiTestView(row: Test) {
  return {
    id: row.id,
    accountId: row.accountId,
    datasetId: row.datasetId,
    requestHash: row.requestHash,
    summary: row.summary,
    status: row.status,
    evidence: row.evidence,
    expiresAt: row.expiresAt,
  };
}
async function owned(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(tests)
    .where(and(eq(tests.workspaceId, workspaceId), eq(tests.id, id)))
    .limit(1);
  if (!row) throw new NotFoundError("Teste CAPI");
  return row;
}
async function datasetFor(
  workspaceId: string,
  accountId: string,
  datasetId: string,
) {
  const [dataset] = await db
    .select()
    .from(datasets)
    .where(
      and(
        eq(datasets.workspaceId, workspaceId),
        eq(datasets.accountId, accountId),
        eq(datasets.id, datasetId),
        eq(datasets.provider, "meta_ads"),
      ),
    )
    .limit(1);
  if (!dataset || !/^\d+$/.test(dataset.providerDatasetId))
    blocked("Selecione um pixel Meta desta conta e workspace.");
  return dataset;
}
async function audit(row: Test, actor: string, action: string) {
  await db.insert(auditLogsTable).values({
    workspaceId: row.workspaceId,
    actor,
    action,
    data: { testId: row.id, requestHash: row.requestHash, mode: "test" },
  });
}
export async function prepareCapiTest(
  workspaceId: string,
  actor: string,
  input: unknown,
) {
  const parsed = capiTestSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      "Revise pixel, código de Test Events e consentimento específico para o diagnóstico.",
      "CAPI_TEST_INVALID",
    );
  const form = parsed.data,
    account = await accountFor(workspaceId, form.accountId),
    dataset = await datasetFor(workspaceId, form.accountId, form.datasetId);
  const event = normalizeMetaCapiEvent({
    eventName: form.eventName,
    eventId: `nexos-test:${randomUUID()}`,
    occurredAt: new Date().toISOString(),
    matchKeys: form.matchKeys,
    payload: {
      eventSourceUrl: form.eventSourceUrl,
      ...(form.value != null
        ? { value: form.value, currency: form.currency }
        : {}),
    },
  });
  const scope = {
    workspaceId,
    accountId: account.id,
    integrationId: account.integrationId,
    providerAccountId: account.providerAccountId,
    datasetId: dataset.id,
    pixelId: dataset.providerDatasetId,
  };
  const request = {
    mode: "test",
    scope,
    event: { ...event, eventTime: event.eventTime.toISOString() },
    testEventCode: form.testEventCode,
  };
  const [row] = await db
    .insert(tests)
    .values({
      workspaceId,
      accountId: account.id,
      datasetId: dataset.id,
      requestHash: deterministicHash(request),
      encryptedRequest: encrypt(JSON.stringify(request)),
      summary: {
        mode: "test",
        eventName: event.eventName,
        eventSourceUrl: event.eventSourceUrl,
        eventId: event.eventId,
        pixelId: dataset.providerDatasetId,
        matchKeyNames: Object.keys(event.userData),
        value: form.value ?? null,
        currency: form.currency ?? null,
        marketingConsent: true,
        diagnosticSharingConfirmed: true,
      },
      expiresAt: new Date(Date.now() + 1800000),
    })
    .returning();
  await audit(row!, actor, "meta.capi_test.prepared");
  return capiTestView(row!);
}
export async function listCapiTests(workspaceId: string) {
  return (
    await db
      .select()
      .from(tests)
      .where(eq(tests.workspaceId, workspaceId))
      .orderBy(desc(tests.updatedAt))
      .limit(100)
  ).map(capiTestView);
}
export async function executeCapiTest(
  workspaceId: string,
  id: string,
  hash: string,
  actor: string,
  send = sendMetaTestConversion,
  read = metaAccountAssetRequest,
) {
  const row = await owned(workspaceId, id);
  if (row.requestHash !== hash) blocked("Confirme o resumo preparado.");
  if (row.status === "sent_test") return capiTestView(row);
  if (
    row.status !== "prepared" ||
    !row.encryptedRequest ||
    row.expiresAt <= new Date()
  )
    blocked("Teste expirado ou já enviado/interrompido. Não repita a chamada.");
  const request = JSON.parse(decrypt(row.encryptedRequest));
  const assertScope = async () => {
    const account = await authorizeMetaAsset(workspaceId, row.accountId),
      dataset = await datasetFor(workspaceId, row.accountId, row.datasetId);
    if (
      row.expiresAt <= new Date() ||
      request.mode !== "test" ||
      deterministicHash(request) !== hash ||
      request.scope.workspaceId !== workspaceId ||
      request.scope.accountId !== account.id ||
      request.scope.integrationId !== account.integrationId ||
      request.scope.providerAccountId !== account.providerAccountId ||
      request.scope.datasetId !== dataset.id ||
      request.scope.pixelId !== dataset.providerDatasetId ||
      typeof request.testEventCode !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(request.testEventCode)
    )
      blocked("A configuração, conta ou integração do teste mudou.");
    return account;
  };
  const account = await assertScope(),
    owner = randomUUID();
  const [claimed] = await db
    .update(tests)
    .set({ status: "executing", intent: { owner, stage: "preflight" } })
    .where(
      and(
        eq(tests.id, id),
        eq(tests.workspaceId, workspaceId),
        eq(tests.status, "prepared"),
      ),
    )
    .returning();
  if (!claimed) blocked("Este teste já tem outra execução.");
  const save = async (patch: Partial<typeof tests.$inferInsert>) => {
    const [saved] = await db
      .update(tests)
      .set(patch)
      .where(
        and(
          eq(tests.id, id),
          eq(tests.workspaceId, workspaceId),
          eq(tests.status, "executing"),
          sql`${tests.intent}->>'owner' = ${owner}`,
        ),
      )
      .returning();
    if (!saved) blocked("O teste perdeu a propriedade da execução.");
    return saved;
  };
  let started = false;
  try {
    await requireAccountAssets(
      (path, query) => read(workspaceId, row.accountId, path, { query }),
      account.providerAccountId,
      "adspixels",
      [request.scope.pixelId],
    );
    await assertScope();
    await save({
      intent: {
        owner,
        stage: "send_test",
        before: {
          mode: "test",
          pixelId: request.scope.pixelId,
          eventId: request.event.eventId,
          receipt: null,
        },
        at: new Date().toISOString(),
      },
    });
    started = true;
    const event: MetaCapiEvent = {
      ...request.event,
      eventTime: new Date(request.event.eventTime),
    };
    // Already hashed. Never normalize the persisted request a second time.
    const receipt = await send(
      workspaceId,
      row.accountId,
      request.scope.pixelId,
      event,
      request.testEventCode,
    );
    if (receipt.evidence.events_received !== 1)
      blocked("O provedor não confirmou um único evento de teste.");
    const complete = await save({
      status: "sent_test",
      encryptedRequest: null,
      evidence: {
        mode: "test",
        eventsReceived: 1,
        providerRequestId: receipt.providerRequestId ?? null,
        eventsManagerVerified: false,
        browserServerDeduplication: "not_verified",
        metaEventMatchQuality: null,
      },
    });
    await audit(complete, actor, "meta.capi_test.received");
    return capiTestView(complete);
  } catch {
    const stopped = await save({
      status: started ? "manual_recovery" : "failed",
      encryptedRequest: null,
      evidence: {
        mode: "test",
        errorCode: started
          ? "CAPI_TEST_AMBIGUOUS"
          : "CAPI_TEST_PREFLIGHT_FAILED",
      },
    });
    await audit(stopped, actor, "meta.capi_test.stopped");
    return capiTestView(stopped);
  }
}
export async function expireCapiTests() {
  await db
    .update(tests)
    .set({ status: "expired", encryptedRequest: null })
    .where(and(eq(tests.status, "prepared"), lt(tests.expiresAt, new Date())));
  await db
    .update(tests)
    .set({ status: "manual_recovery", encryptedRequest: null })
    .where(
      and(
        eq(tests.status, "executing"),
        lt(tests.updatedAt, new Date(Date.now() - 300000)),
      ),
    );
}
