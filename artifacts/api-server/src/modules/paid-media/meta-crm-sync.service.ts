import { randomUUID, createHash } from "node:crypto";
import { z } from "zod/v4";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import {
  db,
  metaCrmConsentsTable as consents,
  metaCrmSyncsTable as syncs,
  metaAudienceOperationsTable as operations,
  sequenceContactsTable as contacts,
  launchSequencesTable as sequences,
  paidMediaPoliciesTable,
  auditLogsTable,
} from "@workspace/db";
import {
  encryptIntegrationToken as encrypt,
  decryptIntegrationToken as decrypt,
} from "@workspace/db/token-crypto";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { deterministicHash } from "../masterplan/masterplan.service.js";
import { accountFor, authorizeMetaAsset } from "./meta-audience.service.js";
import { metaAccountAssetRequest } from "./providers.js";
type Sync = typeof syncs.$inferSelect;
function blocked(message: string): never {
  throw new AppError(409, message, "CRM_SYNC_BLOCKED");
}
export const crmConsentSchema = z
  .object({
    contactId: z.string().uuid(),
    granted: z.boolean(),
    consentedAt: z.iso.datetime().optional(),
    consentReference: z.string().trim().min(1).max(300).optional(),
    metaAudienceSharingConfirmed: z.literal(true),
  })
  .strict();
export const crmSyncSchema = z
  .object({
    accountId: z.string().uuid(),
    sequenceId: z.string().uuid(),
    seedOperationId: z.string().uuid(),
    expiresAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    (value) =>
      Date.parse(value.expiresAt) > Date.now() &&
      Date.parse(value.expiresAt) <= Date.now() + 30 * 86400000,
    "Autorize um período futuro de até 30 dias.",
  );
export function syncView(row: Sync) {
  return {
    id: row.id,
    accountId: row.accountId,
    sequenceId: row.sequenceId,
    audienceId: row.audienceId,
    configurationHash: row.configurationHash,
    enabled: row.enabled,
    status: row.status,
    expiresAt: row.expiresAt,
    nextRunAt: row.nextRunAt,
    evidence: row.evidence,
    errorCode: row.errorCode,
  };
}
export function contactKeys(contact: {
  email: string | null;
  phone: string | null;
}) {
  const email = contact.email?.trim().toLowerCase(),
    phone = contact.phone?.replace(/[ ()-]/g, "");
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const em = email && z.email().safeParse(email).success ? hash(email) : "";
  const ph =
    phone && /^\+[1-9]\d{7,14}$/.test(phone) ? hash(phone.slice(1)) : "";
  if (!em && !ph)
    blocked(
      "O contato precisa de e-mail válido ou telefone E.164 antes de registrar o consentimento.",
    );
  return [em, ph];
}
export function planCrmSync(previous: string[][], desired: string[][]) {
  const unique = (rows: string[][]) =>
    new Map(rows.map((row) => [JSON.stringify(row), row]));
  const before = unique(previous),
    after = unique(desired);
  return {
    remove: [...before]
      .filter(([key]) => !after.has(key))
      .map(([, row]) => row),
    add: [...after].filter(([key]) => !before.has(key)).map(([, row]) => row),
    desired: [...after.values()],
  };
}
export async function recordCrmConsent(
  workspaceId: string,
  actor: string,
  input: unknown,
) {
  const parsed = crmConsentSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      "Informe contato e confirmação específica para públicos Meta.",
      "CRM_CONSENT_INVALID",
    );
  const form = parsed.data;
  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, form.contactId),
        eq(contacts.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!contact) throw new NotFoundError("Contato");
  if (
    form.granted &&
    (!form.consentedAt ||
      Date.parse(form.consentedAt) > Date.now() ||
      !form.consentReference)
  )
    blocked("Consentimento exige data não futura e referência documental.");
  const encryptedProof = form.granted
    ? encrypt(
        JSON.stringify({
          workspaceId,
          contactId: contact.id,
          keys: contactKeys(contact),
          consentedAt: form.consentedAt,
          referenceHash: deterministicHash(form.consentReference),
          purpose: "meta_audience",
          actor,
        }),
      )
    : null;
  await db
    .insert(consents)
    .values({
      workspaceId,
      contactId: contact.id,
      encryptedProof,
      revokedAt: form.granted ? null : new Date(),
      actor,
    })
    .onConflictDoUpdate({
      target: [consents.workspaceId, consents.contactId],
      set: {
        encryptedProof,
        revokedAt: form.granted ? null : new Date(),
        actor,
      },
    });
  await db.insert(auditLogsTable).values({
    workspaceId,
    actor,
    action: form.granted
      ? "meta.crm.consent_granted"
      : "meta.crm.consent_revoked",
    data: { contactId: contact.id, purpose: "meta_audience" },
  });
  return {
    contactId: contact.id,
    granted: form.granted,
    removal: form.granted ? null : "next_authorized_sync",
  };
}
export async function prepareCrmSync(
  workspaceId: string,
  actor: string,
  input: unknown,
) {
  const parsed = crmSyncSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      "Revise conta, sequência, semente e autorização de até 30 dias.",
      "CRM_SYNC_INVALID",
    );
  const form = parsed.data,
    account = await accountFor(workspaceId, form.accountId);
  const [sequence] = await db
    .select({ id: sequences.id })
    .from(sequences)
    .where(
      and(
        eq(sequences.id, form.sequenceId),
        eq(sequences.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const [seed] = await db
    .select()
    .from(operations)
    .where(
      and(
        eq(operations.id, form.seedOperationId),
        eq(operations.workspaceId, workspaceId),
        eq(operations.accountId, form.accountId),
        eq(operations.status, "ready"),
      ),
    )
    .limit(1);
  const summary = seed?.summary as any;
  if (
    !sequence ||
    !seed?.providerAudienceId ||
    summary?.kind !== "crm" ||
    summary?.syncSeed !== true ||
    summary.binding?.providerAccountId !== account.providerAccountId ||
    summary.binding?.integrationId !== account.integrationId
  )
    blocked(
      "Use uma sequência deste workspace e um público CRM vazio, criado como semente de sincronização nesta conta.",
    );
  const configuration = {
    workspaceId,
    ...form,
    providerAccountId: account.providerAccountId,
    integrationId: account.integrationId,
    audienceId: seed.providerAudienceId,
    marker: summary.marker,
    name: summary.name,
  };
  const [row] = await db
    .insert(syncs)
    .values({
      workspaceId,
      accountId: form.accountId,
      sequenceId: form.sequenceId,
      seedOperationId: form.seedOperationId,
      audienceId: seed.providerAudienceId,
      configuration,
      configurationHash: deterministicHash(configuration),
      expiresAt: new Date(form.expiresAt),
      stateCipher: encrypt("[]"),
    })
    .onConflictDoNothing()
    .returning();
  if (!row)
    blocked(
      "A semente já pertence a outra sincronização. Não reutilize públicos com membros desconhecidos.",
    );
  await db.insert(auditLogsTable).values({
    workspaceId,
    actor,
    action: "meta.crm.sync_prepared",
    data: { syncId: row.id, configurationHash: row.configurationHash },
  });
  return syncView(row);
}
async function syncFor(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(syncs)
    .where(and(eq(syncs.id, id), eq(syncs.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new NotFoundError("Sincronização CRM");
  return row;
}
async function assertAuthorization(row: Sync, automatic = true) {
  const account = await authorizeMetaAsset(row.workspaceId, row.accountId),
    configuration = row.configuration as any;
  const [seed] = await db
    .select()
    .from(operations)
    .where(
      and(
        eq(operations.id, row.seedOperationId),
        eq(operations.workspaceId, row.workspaceId),
        eq(operations.accountId, row.accountId),
        eq(operations.status, "ready"),
      ),
    )
    .limit(1);
  if (!seed || seed.providerAudienceId !== row.audienceId)
    blocked(
      "A semente foi removida ou entrou em recuperação; pause os envios.",
    );
  if (
    row.expiresAt <= new Date() ||
    configuration.workspaceId !== row.workspaceId ||
    configuration.accountId !== row.accountId ||
    configuration.sequenceId !== row.sequenceId ||
    configuration.audienceId !== row.audienceId ||
    deterministicHash(configuration) !== row.configurationHash ||
    configuration.providerAccountId !== account.providerAccountId ||
    configuration.integrationId !== account.integrationId
  )
    blocked("A autorização ou o vínculo da sincronização mudou/expirou.");
  if (automatic) {
    const [policy] = await db
      .select()
      .from(paidMediaPoliciesTable)
      .where(
        and(
          eq(paidMediaPoliciesTable.workspaceId, row.workspaceId),
          eq(paidMediaPoliciesTable.accountId, row.accountId),
          eq(paidMediaPoliciesTable.autoExecute, true),
          eq(paidMediaPoliciesTable.enabled, true),
        ),
      )
      .limit(1);
    if (!policy)
      blocked(
        "Sincronização recorrente exige execução automática habilitada na política desta conta.",
      );
  }
}
export async function setCrmSyncEnabled(
  workspaceId: string,
  id: string,
  configurationHash: string,
  enabled: boolean,
  actor: string,
) {
  const row = await syncFor(workspaceId, id);
  if (row.configurationHash !== configurationHash)
    blocked("Confirme o hash da preparação.");
  if (enabled) {
    if (row.status === "blocked" || row.intent)
      blocked(
        "Uma chamada ambígua exige recuperação manual; não reative esta sincronização.",
      );
    await assertAuthorization(row);
  }
  const [updated] = await db
    .update(syncs)
    .set({
      enabled,
      status: enabled ? "active" : "paused",
      ...(enabled ? { approvedBy: actor, nextRunAt: new Date() } : {}),
    })
    .where(
      and(
        eq(syncs.id, id),
        eq(syncs.workspaceId, workspaceId),
        eq(syncs.configurationHash, configurationHash),
        isNull(syncs.leaseOwner),
      ),
    )
    .returning();
  if (!updated)
    blocked(
      "A sincronização está em execução; aguarde o ciclo atual antes de mudar a autorização.",
    );
  await db.insert(auditLogsTable).values({
    workspaceId,
    actor,
    action: enabled ? "meta.crm.sync_authorized" : "meta.crm.sync_paused",
    data: { syncId: id, configurationHash },
  });
  return syncView(updated);
}
export async function listCrmSyncs(workspaceId: string) {
  return (
    await db
      .select()
      .from(syncs)
      .where(eq(syncs.workspaceId, workspaceId))
      .limit(100)
  ).map(syncView);
}
async function desiredMembers(row: Sync) {
  const rows = await db
    .select({ contact: contacts, consent: consents })
    .from(contacts)
    .leftJoin(
      consents,
      and(
        eq(consents.contactId, contacts.id),
        eq(consents.workspaceId, contacts.workspaceId),
      ),
    )
    .where(
      and(
        eq(contacts.workspaceId, row.workspaceId),
        eq(contacts.sequenceId, row.sequenceId),
      ),
    )
    .limit(1001);
  if (rows.length > 1000)
    blocked(
      "A sequência ultrapassa 1.000 contatos; nenhuma lista parcial será usada para remover membros.",
    );
  const desired: string[][] = [];
  for (const { contact, consent } of rows) {
    if (
      contact.segment === "unsubscribed" ||
      !consent?.encryptedProof ||
      consent.revokedAt
    )
      continue;
    const proof = JSON.parse(decrypt(consent.encryptedProof));
    if (
      proof.workspaceId !== row.workspaceId ||
      proof.contactId !== contact.id ||
      proof.purpose !== "meta_audience" ||
      !proof.referenceHash ||
      !proof.consentedAt ||
      Date.parse(proof.consentedAt) > Date.now()
    )
      continue;
    let keys: string[];
    try {
      keys = contactKeys(contact);
    } catch {
      continue;
    }
    if (JSON.stringify(keys) === JSON.stringify(proof.keys)) desired.push(keys); // Changed identifiers require fresh consent.
  }
  return desired;
}
export async function runCrmSync(
  id: string,
  workspaceId: string,
  transport = metaAccountAssetRequest,
) {
  let row = await syncFor(workspaceId, id);
  const owner = randomUUID(),
    now = new Date();
  if (!row.enabled || row.status !== "active" || row.nextRunAt > now) return;
  await assertAuthorization(row);
  const [claimed] = await db
    .update(syncs)
    .set({
      leaseOwner: owner,
      leaseExpiresAt: new Date(now.getTime() + 300000),
    })
    .where(
      and(
        eq(syncs.id, id),
        eq(syncs.workspaceId, workspaceId),
        eq(syncs.enabled, true),
        eq(syncs.status, "active"),
        lte(syncs.nextRunAt, now),
        isNull(syncs.intent),
        or(isNull(syncs.leaseOwner), lte(syncs.leaseExpiresAt, now)),
      ),
    )
    .returning();
  if (!claimed) return;
  row = claimed;
  const save = async (patch: Partial<typeof syncs.$inferInsert>) => {
    const [saved] = await db
      .update(syncs)
      .set(patch)
      .where(
        and(
          eq(syncs.id, id),
          eq(syncs.workspaceId, workspaceId),
          eq(syncs.leaseOwner, owner),
          gt(syncs.leaseExpiresAt, new Date()),
        ),
      )
      .returning();
    if (!saved) blocked("A execução perdeu o lease; interrompa os envios.");
    return saved;
  };
  let mutationStarted = false;
  try {
    if (!row.stateCipher || row.intent)
      blocked(
        "O estado anterior não está disponível para uma diferença segura.",
      );
    const before: string[][] = JSON.parse(decrypt(row.stateCipher)),
      desired = await desiredMembers(row),
      plan = planCrmSync(before, desired),
      configuration = row.configuration as any;
    const remote = await transport(workspaceId, row.accountId, row.audienceId, {
      query: {
        fields: "id,name,description,account_id,subtype,is_value_based",
      },
    });
    if (
      remote.id !== row.audienceId ||
      remote.name !== configuration.name ||
      remote.description !== configuration.marker ||
      String(remote.account_id).replace(/^act_/, "") !==
        configuration.providerAccountId.replace(/^act_/, "") ||
      remote.subtype !== "CUSTOM" ||
      remote.is_value_based === true
    )
      blocked("O público remoto não corresponde à semente autorizada.");
    let baseline = before;
    for (const [action, members] of [
      ["remove", plan.remove],
      ["add", plan.add],
    ] as const) {
      if (!members.length) continue;
      await assertAuthorization(row);
      if (
        deterministicHash(await desiredMembers(row)) !==
        deterministicHash(desired)
      )
        blocked(
          "Os consentimentos mudaram durante o ciclo. Revise o próximo ciclo.",
        );
      await save({
        intent: {
          owner,
          action,
          count: members.length,
          at: new Date().toISOString(),
          beforeHash: deterministicHash(baseline),
          desiredHash: deterministicHash(plan.desired),
        },
      });
      mutationStarted = true;
      const receipt = await transport(
        workspaceId,
        row.accountId,
        `${row.audienceId}/users`,
        {
          method: action === "remove" ? "DELETE" : "POST",
          idempotencyKey: `crm-sync:${id}:${owner}:${action}`,
          payload: { payload: { schema: ["EMAIL", "PHONE"], data: members } },
        },
      );
      if (
        String(receipt.audience_id) !== row.audienceId ||
        receipt.num_received !== members.length ||
        Number(receipt.num_invalid_entries ?? 0) !== 0
      )
        blocked("A Meta não confirmou todas as linhas do lote.");
      baseline =
        action === "remove"
          ? before.filter(
              (member) =>
                !plan.remove.some(
                  (removed) =>
                    JSON.stringify(removed) === JSON.stringify(member),
                ),
            )
          : plan.desired;
      await save({
        stateCipher: encrypt(JSON.stringify(baseline)),
        intent: null,
      });
      mutationStarted = false;
    }
    const finished = await save({
      stateCipher: encrypt(JSON.stringify(plan.desired)),
      intent: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      nextRunAt: new Date(Date.now() + 300000),
      errorCode: null,
      evidence: {
        added: plan.add.length,
        removed: plan.remove.length,
        retained: plan.desired.length,
        providerAcceptedAt: new Date().toISOString(),
        matchedPeople: null,
      },
    });
    await db.insert(auditLogsTable).values({
      workspaceId,
      actor: "crm-sync-worker",
      action: "meta.crm.sync_confirmed",
      data: { syncId: id, evidence: finished.evidence },
    });
  } catch {
    await save({
      enabled: false,
      status: mutationStarted ? "blocked" : "paused",
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCode: mutationStarted
        ? "CRM_SYNC_AMBIGUOUS"
        : "CRM_SYNC_REVIEW_REQUIRED",
      ...(!mutationStarted ? { intent: null } : {}),
    });
  }
}
export async function crmSyncTick() {
  const now = new Date();
  // Interrupted intents are never retried. No Graph calls occur in cleanup.
  await db
    .update(syncs)
    .set({
      enabled: false,
      status: "blocked",
      errorCode: "CRM_SYNC_INTERRUPTED",
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(and(isNotNullIntent(), lte(syncs.leaseExpiresAt, now)));
  await db
    .update(syncs)
    .set({ enabled: false, status: "expired" })
    .where(lte(syncs.expiresAt, now));
  const due = await db
    .select()
    .from(syncs)
    .where(
      and(
        eq(syncs.enabled, true),
        eq(syncs.status, "active"),
        lte(syncs.nextRunAt, now),
      ),
    )
    .limit(20);
  for (const row of due)
    try {
      await runCrmSync(row.id, row.workspaceId);
    } catch {
      await db
        .update(syncs)
        .set({
          enabled: false,
          status: "paused",
          errorCode: "CRM_SYNC_AUTHORIZATION_REQUIRED",
        })
        .where(and(eq(syncs.id, row.id), isNull(syncs.leaseOwner)));
    }
}
const isNotNullIntent = () => sql`${syncs.intent} is not null`;
