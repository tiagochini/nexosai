import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  db,
  auditLogsTable,
  metaAudienceOperationsTable as operations,
  paidMediaAccountsTable,
  paidMediaPoliciesTable,
} from "@workspace/db";
import {
  encryptIntegrationToken,
  decryptIntegrationToken,
} from "@workspace/db/token-crypto";
import { deterministicHash } from "../masterplan/masterplan.service.js";
import { enforceNoMandatoryPause } from "../autonomy/autonomy.service.js";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { metaAccountAssetRequest } from "./providers.js";
import {
  compileAudienceRequest,
  assertAudienceReadback,
} from "./meta-audience.policy.js";
import { requireAccountAssets } from "./meta-asset-preflight.js";

type Operation = typeof operations.$inferSelect;
type Account = typeof paidMediaAccountsTable.$inferSelect;
type Request = ReturnType<typeof compileAudienceRequest>["request"] & {
  scope: {
    workspaceId: string;
    accountId: string;
    integrationId: string | null;
    providerAccountId: string;
  };
};
const fields =
  "id,name,description,account_id,subtype,rule,lookalike_spec,seed_audience,customer_file_source,delivery_status,operation_status";
function conflict(message: string): never {
  throw new AppError(409, message, "AUDIENCE_OPERATION_BLOCKED");
}
function assertRetainedScope(row: Operation, account: Account) {
  const binding = (
    row.summary as {
      binding?: { providerAccountId: string; integrationId: string | null };
    }
  ).binding;
  if (
    binding?.providerAccountId !== account.providerAccountId ||
    binding?.integrationId !== account.integrationId
  )
    conflict(
      "A conta ou integração mudou desde a preparação. Confira o vínculo antes de recuperar o público.",
    );
}
export function audienceOperationView(row: Operation) {
  return {
    id: row.id,
    accountId: row.accountId,
    requestHash: row.requestHash,
    summary: row.summary,
    status: row.status,
    providerAudienceId: row.providerAudienceId,
    evidence: row.evidence,
    errorCode: row.errorCode,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}
async function getOperation(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(operations)
    .where(and(eq(operations.id, id), eq(operations.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new NotFoundError("Operação de público");
  return row;
}
async function accountFor(workspaceId: string, accountId: string) {
  const [account] = await db
    .select()
    .from(paidMediaAccountsTable)
    .where(
      and(
        eq(paidMediaAccountsTable.id, accountId),
        eq(paidMediaAccountsTable.workspaceId, workspaceId),
        eq(paidMediaAccountsTable.provider, "meta_ads"),
        eq(paidMediaAccountsTable.isSelected, true),
      ),
    )
    .limit(1);
  if (!account)
    conflict("Selecione uma conta Meta autorizada deste workspace.");
  return account;
}
function decode(row: Operation, account: Account): Request {
  if (!row.encryptedRequest || row.expiresAt <= new Date())
    conflict("A preparação expirou. Prepare e aprove uma nova operação.");
  const request: Request = JSON.parse(
    decryptIntegrationToken(row.encryptedRequest),
  );
  if (
    deterministicHash(request) !== row.requestHash ||
    request.scope.workspaceId !== row.workspaceId ||
    request.scope.accountId !== account.id ||
    request.scope.integrationId !== account.integrationId ||
    request.scope.providerAccountId !== account.providerAccountId
  )
    conflict(
      "A conta ou o conteúdo mudou desde a preparação. Revise uma nova operação.",
    );
  return request;
}
async function authorize(workspaceId: string, accountId: string) {
  await enforceNoMandatoryPause(workspaceId, {
    channel: "paid_media",
    action: "paid_media_execute",
  });
  await enforceNoMandatoryPause(workspaceId, {
    channel: "meta_ads",
    action: "paid_media_execute",
  });
  const account = await accountFor(workspaceId, accountId);
  const policies = await db
    .select()
    .from(paidMediaPoliciesTable)
    .where(
      and(
        eq(paidMediaPoliciesTable.workspaceId, workspaceId),
        or(
          eq(paidMediaPoliciesTable.provider, "meta_ads"),
          isNull(paidMediaPoliciesTable.provider),
        ),
        or(
          eq(paidMediaPoliciesTable.accountId, accountId),
          isNull(paidMediaPoliciesTable.accountId),
        ),
      ),
    );
  if (
    policies.some((policy) => policy.mandatoryPause) ||
    !policies.some(
      (policy) =>
        policy.accountId === accountId &&
        policy.enabled &&
        policy.acceptedAt &&
        (!policy.acceptanceExpiresAt ||
          policy.acceptanceExpiresAt > new Date()),
    )
  )
    conflict(
      "Aceite uma política vigente para esta conta em Mídia paga → Políticas e resolva as pausas obrigatórias.",
    );
  return account;
}
async function audit(
  row: Operation,
  actor: string,
  action: string,
  data: Record<string, unknown> = {},
) {
  await db
    .insert(auditLogsTable)
    .values({
      workspaceId: row.workspaceId,
      action,
      actor,
      data: {
        operationId: row.id,
        accountId: row.accountId,
        requestHash: row.requestHash,
        ...data,
      },
    });
}
export async function listAudienceOperations(workspaceId: string) {
  return (
    await db
      .select()
      .from(operations)
      .where(eq(operations.workspaceId, workspaceId))
      .orderBy(desc(operations.createdAt))
      .limit(100)
  ).map(audienceOperationView);
}
export async function prepareAudienceOperation(
  workspaceId: string,
  actor: string,
  input: unknown,
) {
  const compiled = compileAudienceRequest(input),
    account = await accountFor(workspaceId, compiled.form.accountId);
  const marker = `NexOS:${deterministicHash({ workspaceId, key: compiled.form.idempotencyKey })}`;
  compiled.request.payload.description = marker;
  const request: Request = {
    ...compiled.request,
    scope: {
      workspaceId,
      accountId: account.id,
      integrationId: account.integrationId,
      providerAccountId: account.providerAccountId,
    },
  };
  const requestHash = deterministicHash(request);
  const [created] = await db
    .insert(operations)
    .values({
      workspaceId,
      accountId: account.id,
      idempotencyKey: compiled.form.idempotencyKey,
      requestHash,
      encryptedRequest: encryptIntegrationToken(JSON.stringify(request)),
      summary: {
        ...compiled.summary,
        marker,
        binding: {
          providerAccountId: account.providerAccountId,
          integrationId: account.integrationId,
        },
      },
      expiresAt: new Date(Date.now() + 86400000),
    })
    .onConflictDoNothing()
    .returning();
  const row =
    created ??
    (
      await db
        .select()
        .from(operations)
        .where(
          and(
            eq(operations.workspaceId, workspaceId),
            eq(operations.idempotencyKey, compiled.form.idempotencyKey),
          ),
        )
        .limit(1)
    )[0];
  if (!row || row.requestHash !== requestHash)
    conflict("A chave de preparação já foi usada com outro conteúdo.");
  if (created) await audit(row, actor, "meta.audience.prepared");
  return audienceOperationView(row);
}
export async function approveAudienceOperation(
  workspaceId: string,
  id: string,
  requestHash: string,
  actor: string,
) {
  const row = await getOperation(workspaceId, id),
    account = await accountFor(workspaceId, row.accountId);
  decode(row, account);
  if (row.requestHash !== requestHash)
    conflict("A aprovação precisa corresponder ao resumo preparado.");
  if (row.status === "approved") return audienceOperationView(row);
  const [approved] = await db
    .update(operations)
    .set({ status: "approved", approvedBy: actor, approvedAt: new Date() })
    .where(
      and(
        eq(operations.id, id),
        eq(operations.workspaceId, workspaceId),
        eq(operations.status, "draft"),
        eq(operations.requestHash, requestHash),
      ),
    )
    .returning();
  if (!approved) conflict("Esta operação não está disponível para aprovação.");
  await audit(approved, actor, "meta.audience.approved");
  return audienceOperationView(approved);
}
export async function executeAudienceOperation(
  workspaceId: string,
  id: string,
  requestHash: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await getOperation(workspaceId, id);
  if (row.requestHash !== requestHash)
    conflict("O resumo mudou. Revise a operação.");
  if (row.status === "ready") return audienceOperationView(row);
  const account = await authorize(workspaceId, row.accountId),
    request = decode(row, account),
    owner = randomUUID();
  const [claimed] = await db
    .update(operations)
    .set({
      status: "executing",
      intent: { owner, stage: "preflight", at: new Date().toISOString() },
    })
    .where(
      and(
        eq(operations.id, id),
        eq(operations.workspaceId, workspaceId),
        eq(operations.status, "approved"),
        gt(operations.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!claimed)
    conflict(
      "A operação não está aprovada ou exige recuperação. Uma chamada ambígua nunca é repetida automaticamente.",
    );
  const send = (
    path: string,
    options: Parameters<typeof metaAccountAssetRequest>[3] = {},
  ) => transport(workspaceId, row.accountId, path, options);
  const save = async (patch: Partial<typeof operations.$inferInsert>) => {
    const [saved] = await db
      .update(operations)
      .set(patch)
      .where(
        and(
          eq(operations.id, id),
          eq(operations.workspaceId, workspaceId),
          eq(operations.status, "executing"),
          sql`${operations.intent}->>'owner' = ${owner}`,
        ),
      )
      .returning();
    if (!saved)
      conflict(
        "A execução perdeu a propriedade. Verifique a recuperação antes de continuar.",
      );
    return saved;
  };
  let mutationStarted = false;
  try {
    if (request.kind === "website")
      await requireAccountAssets(
        (path, query) => send(path, { query }),
        account.providerAccountId,
        "adspixels",
        [request.pixelId!],
      );
    if (request.kind === "lookalike")
      await requireAccountAssets(
        (path, query) => send(path, { query }),
        account.providerAccountId,
        "customaudiences",
        [request.originAudienceId!],
      );
    decode(row, await authorize(workspaceId, row.accountId));
    await save({
      intent: {
        owner,
        stage: "create",
        at: new Date().toISOString(),
        before: { audienceId: null },
        requestHash,
      },
    });
    mutationStarted = true;
    const created = await send("account/customaudiences", {
      method: "POST",
      payload: request.payload,
      idempotencyKey: `audience:${id}:create`,
    });
    const providerAudienceId = String(created.id ?? "");
    if (!/^\d+$/.test(providerAudienceId))
      throw new AppError(
        502,
        "A Meta não retornou o ID do público.",
        "AUDIENCE_CREATE_AMBIGUOUS",
      );
    await save({ providerAudienceId }); // Persist the ID before independent readback or upload.
    const readback = await send(providerAudienceId, { query: { fields } });
    assertAudienceReadback(
      readback,
      account.providerAccountId,
      request.payload,
      providerAudienceId,
    );
    let upload: Record<string, unknown> | undefined;
    if (request.kind === "crm") {
      decode(row, await authorize(workspaceId, row.accountId));
      await save({
        intent: {
          owner,
          stage: "upload",
          at: new Date().toISOString(),
          before: {
            id: providerAudienceId,
            name: readback.name,
            subtype: readback.subtype,
            accountId: readback.account_id,
            newlyCreatedByOperation: true,
          },
          requestHash,
        },
      });
      const receipt = await send(`${providerAudienceId}/users`, {
        method: "POST",
        idempotencyKey: `audience:${id}:users`,
        payload: {
          payload: { schema: ["EMAIL", "PHONE"], data: request.members },
        },
      });
      if (
        String(receipt.audience_id) !== providerAudienceId ||
        receipt.num_received !== request.members.length ||
        Number(receipt.num_invalid_entries ?? 0) !== 0
      )
        throw new AppError(
          502,
          "A Meta não confirmou a aceitação de todas as linhas aprovadas.",
          "AUDIENCE_UPLOAD_UNCONFIRMED",
        );
      upload = {
        received: receipt.num_received,
        invalid: Number(receipt.num_invalid_entries ?? 0),
        matchedPeople: null,
      };
      assertAudienceReadback(
        await send(providerAudienceId, { query: { fields } }),
        account.providerAccountId,
        request.payload,
        providerAudienceId,
      );
    }
    const completed = await save({
      status: "ready",
      encryptedRequest: null,
      evidence: {
        audienceId: providerAudienceId,
        subtype: readback.subtype,
        deliveryStatus: readback.delivery_status ?? null,
        operationStatus: readback.operation_status ?? null,
        ...(upload ? { upload } : {}),
      },
      errorCode: null,
    });
    await audit(completed, actor, "meta.audience.provider_confirmed", {
      providerAudienceId,
    });
    return audienceOperationView(completed);
  } catch (error) {
    const failed = await save({
      status: mutationStarted ? "manual_recovery" : "failed",
      errorCode: error instanceof AppError ? error.code : "META_ASSET_ERROR",
    });
    await audit(failed, actor, "meta.audience.execution_stopped");
    return audienceOperationView(failed);
  }
}
export async function rollbackAudienceOperation(
  workspaceId: string,
  id: string,
  requestHash: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await getOperation(workspaceId, id);
  if (row.requestHash !== requestHash)
    conflict("A confirmação não corresponde à operação.");
  if (row.status === "rolled_back") return audienceOperationView(row);
  if (
    !row.providerAudienceId ||
    !["ready", "manual_recovery", "failed"].includes(row.status)
  )
    conflict(
      "É necessário um ID confirmado e uma execução encerrada para excluir somente o público criado por esta operação.",
    );
  const account = await authorize(workspaceId, row.accountId),
    summary = row.summary as { name: string; kind: string; marker: string };
  assertRetainedScope(row, account);
  const [claimed] = await db
    .update(operations)
    .set({
      status: "rolling_back",
      intent: {
        stage: "delete",
        before: { audienceId: row.providerAudienceId },
        at: new Date().toISOString(),
      },
    })
    .where(
      and(
        eq(operations.id, id),
        eq(operations.workspaceId, workspaceId),
        eq(operations.status, row.status),
      ),
    )
    .returning();
  if (!claimed) conflict("A operação já está em recuperação.");
  const send = (
    path: string,
    options: Parameters<typeof metaAccountAssetRequest>[3] = {},
  ) => transport(workspaceId, row.accountId, path, options);
  try {
    const current = await send(row.providerAudienceId, {
      query: { fields: "id,name,description,account_id,subtype" },
    });
    assertAudienceReadback(
      current,
      account.providerAccountId,
      {
        name: summary.name,
        description: summary.marker,
        subtype:
          summary.kind === "crm"
            ? "CUSTOM"
            : summary.kind === "website"
              ? "WEBSITE"
              : "LOOKALIKE",
      },
      row.providerAudienceId,
    );
    await authorize(workspaceId, row.accountId);
    const [intent] = await db
      .update(operations)
      .set({
        intent: {
          stage: "delete",
          before: current,
          at: new Date().toISOString(),
          actor,
        },
      })
      .where(
        and(
          eq(operations.id, id),
          eq(operations.workspaceId, workspaceId),
          eq(operations.status, "rolling_back"),
        ),
      )
      .returning();
    if (!intent) conflict("A exclusão perdeu a propriedade antes do envio.");
    const result = await send(row.providerAudienceId, {
      method: "DELETE",
      idempotencyKey: `audience:${id}:delete`,
    });
    if (result.success !== true) throw new Error("Unconfirmed deletion");
    let after = "",
      absent = false;
    for (let page = 0; page < 100; page++) {
      const listed = await send("account/customaudiences", {
        query: { fields: "id", limit: "500", ...(after ? { after } : {}) },
      });
      if (!Array.isArray(listed.data))
        throw new Error("Invalid absence response");
      if (
        (listed.data as Array<{ id: string }> | undefined)?.some(
          (item) => item.id === row.providerAudienceId,
        )
      )
        throw new Error("Audience remains visible");
      if (!listed.paging || !(listed.paging as any).next) {
        absent = true;
        break;
      }
      const next = (listed.paging as any)?.cursors?.after;
      if (!next || next === after) break;
      after = next;
    }
    if (!absent) throw new Error("Absence not verified");
    const [completed] = await db
      .update(operations)
      .set({
        status: "rolled_back",
        encryptedRequest: null,
        evidence: {
          ...(row.evidence as object),
          rollback: { deleted: true, absenceVerified: true, actor },
        },
      })
      .where(
        and(
          eq(operations.id, id),
          eq(operations.workspaceId, workspaceId),
          eq(operations.status, "rolling_back"),
        ),
      )
      .returning();
    if (!completed) conflict("A recuperação perdeu a propriedade.");
    await audit(completed, actor, "meta.audience.rolled_back");
    return audienceOperationView(completed);
  } catch {
    await db
      .update(operations)
      .set({
        status: "manual_recovery",
        errorCode: "AUDIENCE_ROLLBACK_UNCONFIRMED",
      })
      .where(
        and(
          eq(operations.id, id),
          eq(operations.workspaceId, workspaceId),
          eq(operations.status, "rolling_back"),
        ),
      );
    conflict(
      "A exclusão não foi confirmada. Verifique o público na Meta antes de tentar outra operação.",
    );
  }
}
export async function expireAudienceOperations() {
  const now = new Date();
  await db
    .update(operations)
    .set({ encryptedRequest: null, status: "expired" })
    .where(
      and(
        inArray(operations.status, ["draft", "approved", "failed"]),
        lt(operations.expiresAt, now),
      ),
    );
  await db
    .update(operations)
    .set({ encryptedRequest: null })
    .where(
      and(
        eq(operations.status, "manual_recovery"),
        lt(operations.expiresAt, now),
      ),
    );
  await db
    .update(operations)
    .set({
      status: "manual_recovery",
      errorCode: "AUDIENCE_EXECUTION_INTERRUPTED",
    })
    .where(
      and(
        inArray(operations.status, ["executing", "rolling_back"]),
        lt(operations.updatedAt, new Date(Date.now() - 300_000)),
      ),
    );
}

/** Recovery binds only an operator-supplied ID whose account, marker and full specification match. It never repeats creation or upload. */
export async function recoverAudienceOperation(
  workspaceId: string,
  id: string,
  requestHash: string,
  providerAudienceId: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await getOperation(workspaceId, id);
  if (
    row.status !== "manual_recovery" ||
    row.requestHash !== requestHash ||
    !/^\d+$/.test(providerAudienceId)
  )
    conflict(
      "A recuperação precisa de uma operação interrompida e do ID observado na Meta.",
    );
  const account = await authorize(workspaceId, row.accountId),
    request = decode(row, account);
  const readback = await transport(
    workspaceId,
    row.accountId,
    providerAudienceId,
    { query: { fields } },
  );
  assertAudienceReadback(
    readback,
    account.providerAccountId,
    request.payload,
    providerAudienceId,
  );
  if (row.providerAudienceId && row.providerAudienceId !== providerAudienceId)
    conflict("Esta operação já tem outro ID confirmado.");
  const [recovered] = await db
    .update(operations)
    .set({
      providerAudienceId,
      evidence: {
        ...(row.evidence as object),
        recoveredBy: actor,
        recoveredAudienceId: providerAudienceId,
      },
    })
    .where(
      and(
        eq(operations.id, id),
        eq(operations.workspaceId, workspaceId),
        eq(operations.status, "manual_recovery"),
      ),
    )
    .returning();
  if (!recovered) conflict("A recuperação mudou durante a conferência.");
  await audit(recovered, actor, "meta.audience.recovery_bound", {
    providerAudienceId,
  });
  return audienceOperationView(recovered);
}

export async function cancelAudienceOperation(
  workspaceId: string,
  id: string,
  requestHash: string,
  actor: string,
) {
  const [cancelled] = await db
    .update(operations)
    .set({
      status: "expired",
      encryptedRequest: null,
      errorCode: "CANCELLED_BY_USER",
    })
    .where(
      and(
        eq(operations.id, id),
        eq(operations.workspaceId, workspaceId),
        eq(operations.requestHash, requestHash),
        inArray(operations.status, ["draft", "approved"]),
      ),
    )
    .returning();
  if (!cancelled)
    conflict(
      "Só é possível cancelar preparações que ainda não iniciaram a execução.",
    );
  await audit(cancelled, actor, "meta.audience.cancelled");
  return audienceOperationView(cancelled);
}

/** Reconcile delayed deletion with reads only. A lost DELETE response is never replayed. */
export async function verifyAudienceRollback(
  workspaceId: string,
  id: string,
  requestHash: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await getOperation(workspaceId, id);
  if (row.status === "rolled_back" && row.requestHash === requestHash)
    return audienceOperationView(row);
  if (
    row.status !== "manual_recovery" ||
    row.requestHash !== requestHash ||
    !row.providerAudienceId ||
    (row.intent as { stage?: string } | null)?.stage !== "delete"
  )
    conflict(
      "Só é possível conferir exclusões já solicitadas por esta operação.",
    );
  assertRetainedScope(row, await accountFor(workspaceId, row.accountId));
  let after = "",
    absent = false;
  for (let page = 0; page < 100; page++) {
    const listed = await transport(
      workspaceId,
      row.accountId,
      "account/customaudiences",
      { query: { fields: "id", limit: "500", ...(after ? { after } : {}) } },
    );
    if (
      !Array.isArray(listed.data) ||
      listed.data.some(
        (item: { id: string }) => item.id === row.providerAudienceId,
      )
    )
      conflict("A ausência do público ainda não foi confirmada na conta.");
    const paging = listed.paging as any;
    if (!paging?.next) {
      absent = true;
      break;
    }
    if (!paging.cursors?.after || paging.cursors.after === after) break;
    after = paging.cursors.after;
  }
  if (!absent) conflict("A consulta não concluiu a verificação de ausência.");
  const [verified] = await db
    .update(operations)
    .set({
      status: "rolled_back",
      encryptedRequest: null,
      errorCode: null,
      evidence: {
        ...(row.evidence as object),
        rollback: { absenceVerified: true, reconciled: true, actor },
      },
    })
    .where(
      and(
        eq(operations.id, id),
        eq(operations.workspaceId, workspaceId),
        eq(operations.status, "manual_recovery"),
      ),
    )
    .returning();
  if (!verified) conflict("A operação mudou durante a conferência.");
  await audit(verified, actor, "meta.audience.rollback_reconciled");
  return audienceOperationView(verified);
}
