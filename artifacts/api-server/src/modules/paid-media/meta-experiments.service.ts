import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  metaExperimentsTable as experiments,
  paidMediaEntitiesTable,
  auditLogsTable,
} from "@workspace/db";
import { accountFor, authorizeMetaAsset } from "./meta-audience.service.js";
import { metaAccountAssetRequest } from "./providers.js";
import { deterministicHash } from "../masterplan/masterplan.service.js";
import { AppError, NotFoundError } from "../../lib/errors.js";
type Experiment = typeof experiments.$inferSelect;
const id = z.string().regex(/^\d+$/);
export const experimentSchema = z
  .object({
    accountId: z.string().uuid(),
    businessId: id,
    name: z.string().trim().min(1).max(120),
    adA: id,
    adB: id,
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    (value) =>
      value.adA !== value.adB &&
      Date.parse(value.startAt) > Date.now() &&
      Date.parse(value.endAt) > Date.parse(value.startAt) &&
      Date.parse(value.endAt) - Date.parse(value.startAt) <= 30 * 86400000,
    "Escolha anúncios distintos e um intervalo futuro de até 30 dias.",
  );
function blocked(message: string): never {
  throw new AppError(409, message, "EXPERIMENT_BLOCKED");
}
export function experimentPayload(configuration: Record<string, any>) {
  return {
    name: configuration.name,
    description: configuration.marker,
    type: "SPLIT_TEST",
    start_time: Math.floor(Date.parse(configuration.startAt) / 1000),
    end_time: Math.floor(Date.parse(configuration.endAt) / 1000),
    cells: [
      { name: "A", ads: [configuration.adA], treatment_percentage: 50 },
      { name: "B", ads: [configuration.adB], treatment_percentage: 50 },
    ],
  };
}
export function assertExperimentReadback(
  result: Record<string, any>,
  configuration: Record<string, any>,
  studyId: string,
) {
  const time = (value: unknown) =>
    typeof value === "number" || /^\d{10}$/.test(String(value))
      ? Number(value)
      : Math.floor(Date.parse(String(value)) / 1000);
  const cells = Array.isArray(result.cells) ? result.cells : result.cells?.data;
  const expected = experimentPayload(configuration);
  if (
    result.id !== studyId ||
    result.name !== configuration.name ||
    result.description !== configuration.marker ||
    result.type !== "SPLIT_TEST" ||
    result.business?.id !== configuration.businessId ||
    time(result.start_time) !== expected.start_time ||
    time(result.end_time) !== expected.end_time ||
    !Array.isArray(cells) ||
    cells.length !== 2 ||
    result.cells?.paging?.next
  )
    blocked("O estudo retornado não corresponde ao desenho aprovado.");
  for (const [index, label] of ["A", "B"].entries()) {
    const cell = cells.find((item: any) => item.name === label),
      ad = index === 0 ? configuration.adA : configuration.adB;
    if (
      !cell ||
      Number(cell.treatment_percentage) !== 50 ||
      !Array.isArray(cell.ad_ids) ||
      cell.ad_ids.length !== 1 ||
      cell.ad_ids[0] !== ad
    )
      blocked("A divisão dos anúncios no estudo difere da aprovada.");
  }
}
async function owned(workspaceId: string, experimentId: string) {
  const [row] = await db
    .select()
    .from(experiments)
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new NotFoundError("Experimento");
  return row;
}
async function assertBinding(row: Experiment, mutate: boolean) {
  const account = await (mutate ? authorizeMetaAsset : accountFor)(
      row.workspaceId,
      row.accountId,
    ),
    config = row.configuration as any;
  if (
    config.workspaceId !== row.workspaceId ||
    config.accountId !== account.id ||
    config.providerAccountId !== account.providerAccountId ||
    config.integrationId !== account.integrationId ||
    row.configurationHash !== deterministicHash(config)
  )
    blocked("A conta/integração ou desenho do experimento mudou.");
  return config;
}
async function audit(row: Experiment, actor: string, action: string) {
  await db
    .insert(auditLogsTable)
    .values({
      workspaceId: row.workspaceId,
      actor,
      action,
      data: {
        experimentId: row.id,
        configurationHash: row.configurationHash,
        providerStudyId: row.providerStudyId,
      },
    });
}
export async function prepareExperiment(
  workspaceId: string,
  actor: string,
  input: unknown,
) {
  const parsed = experimentSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      "Revise o estudo: conta, Business, anúncios distintos e período futuro.",
      "EXPERIMENT_INVALID",
    );
  const form = parsed.data,
    account = await accountFor(workspaceId, form.accountId);
  const ads = await db
    .select()
    .from(paidMediaEntitiesTable)
    .where(
      and(
        eq(paidMediaEntitiesTable.workspaceId, workspaceId),
        eq(paidMediaEntitiesTable.accountId, account.id),
        eq(paidMediaEntitiesTable.provider, "meta_ads"),
        eq(paidMediaEntitiesTable.entityType, "ad"),
        inArray(paidMediaEntitiesTable.providerEntityId, [form.adA, form.adB]),
      ),
    );
  if (new Set(ads.map((ad) => ad.providerEntityId)).size !== 2)
    blocked(
      "Sincronize os dois anúncios desta conta antes de preparar o experimento.",
    );
  const experimentId = randomUUID(),
    configuration = {
      ...form,
      workspaceId,
      providerAccountId: account.providerAccountId,
      integrationId: account.integrationId,
      marker: `NexOS experiment:${experimentId}`,
    };
  const [row] = await db
    .insert(experiments)
    .values({
      id: experimentId,
      workspaceId,
      accountId: account.id,
      configuration,
      configurationHash: deterministicHash(configuration),
    })
    .returning();
  await audit(row!, actor, "meta.experiment.prepared");
  return row!;
}
export async function listExperiments(workspaceId: string) {
  return db
    .select()
    .from(experiments)
    .where(eq(experiments.workspaceId, workspaceId))
    .orderBy(desc(experiments.updatedAt))
    .limit(100);
}
const studyFields =
  "id,name,description,business,type,start_time,end_time,cells{id,name,ad_ids,treatment_percentage},results_first_available_date";

type MetaInsight = { ad_id?: string; impressions?: string | number; clicks?: string | number; spend?: string | number; actions?: Array<{ action_type?: string; value?: string | number }>; action_values?: Array<{ action_type?: string; value?: string | number }> };
function sumActions(rows: MetaInsight["actions"], accepted: (type: string) => boolean) {
  return (rows ?? []).reduce((sum, row) => sum + (accepted(String(row.action_type ?? "")) ? Number(row.value ?? 0) : 0), 0);
}
export function compareExperimentInsights(rows: MetaInsight[], adA: string, adB: string) {
  const one = (id: string) => {
    const selected = rows.filter(row => row.ad_id === id);
    const impressions = selected.reduce((n, row) => n + Number(row.impressions ?? 0), 0);
    const clicks = selected.reduce((n, row) => n + Number(row.clicks ?? 0), 0);
    const spend = selected.reduce((n, row) => n + Number(row.spend ?? 0), 0);
    const conversions = selected.reduce((n, row) => n + sumActions(row.actions, type => /purchase|lead|complete_registration/i.test(type)), 0);
    const conversionValue = selected.reduce((n, row) => n + sumActions(row.action_values, type => /purchase|lead|complete_registration/i.test(type)), 0);
    return { adId: id, impressions, clicks, spend, conversions, conversionValue, ctr: impressions ? clicks / impressions * 100 : null, cpc: clicks ? spend / clicks : null, cpa: conversions ? spend / conversions : null, roas: spend ? conversionValue / spend : null };
  };
  const A = one(adA), B = one(adB);
  const sufficient = A.impressions > 0 && B.impressions > 0 && A.conversions >= 20 && B.conversions >= 20;
  return { A, B, method: "descriptive_meta_insights", winner: null, conclusion: sufficient ? "descriptive_comparison_only" : "insufficient_sample", statisticalSignificance: "not_available_for_legacy_split_test", note: "Métricas descritivas de Insights. O NexOS não declara vencedor sem resultados estatísticos oficiais da Meta; 20 conversões por variante é somente um mínimo operacional para leitura, não prova significância." };
}
export async function approveExperiment(
  workspaceId: string,
  experimentId: string,
  hash: string,
  actor: string,
) {
  const row = await owned(workspaceId, experimentId);
  await assertBinding(row, false);
  if (
    row.configurationHash !== hash ||
    Date.parse((row.configuration as any).startAt) <= Date.now()
  )
    blocked("Confira o desenho e o início futuro do estudo.");
  const [updated] = await db
    .update(experiments)
    .set({ status: "approved", approvedBy: actor })
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.workspaceId, workspaceId),
        eq(experiments.status, "draft"),
      ),
    )
    .returning();
  if (!updated) blocked("Estudo indisponível para aprovação.");
  await audit(updated, actor, "meta.experiment.approved");
  return updated;
}
export async function executeExperiment(
  workspaceId: string,
  experimentId: string,
  hash: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await owned(workspaceId, experimentId),
    config = await assertBinding(row, true),
    owner = randomUUID();
  if (hash !== row.configurationHash)
    blocked("Confirme o hash do desenho aprovado.");
  if (row.status === "ready") return row;
  if (Date.parse(config.startAt) <= Date.now())
    blocked("O estudo precisa de novo período futuro.");
  const [claimed] = await db
    .update(experiments)
    .set({
      status: "executing",
      intent: { owner, stage: "preflight", at: new Date().toISOString() },
    })
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.workspaceId, workspaceId),
        eq(experiments.status, "approved"),
      ),
    )
    .returning();
  if (!claimed)
    blocked("Uma execução anterior ou resposta ambígua não pode ser repetida.");
  const send = (
    path: string,
    options: Parameters<typeof metaAccountAssetRequest>[3] = {},
  ) => transport(workspaceId, row.accountId, path, options);
  const save = async (patch: Partial<typeof experiments.$inferInsert>) => {
    const [saved] = await db
      .update(experiments)
      .set(patch)
      .where(
        and(
          eq(experiments.id, experimentId),
          eq(experiments.workspaceId, workspaceId),
          eq(experiments.status, "executing"),
          sql`${experiments.intent}->>'owner' = ${owner}`,
        ),
      )
      .returning();
    if (!saved) blocked("O estudo perdeu a propriedade da execução.");
    return saved;
  };
  let mutationStarted = false;
  try {
    const profile = await send("account", { query: { fields: "id,business" } });
    if (
      (profile.business &&
        (profile.business as any).id !== config.businessId) ||
      !profile.business
    )
      blocked("O Business aprovado não corresponde ao da conta selecionada.");
    const before = [];
    for (const adId of [config.adA, config.adB]) {
      const ad = await send(adId, {
        query: { fields: "id,account_id,status,adset_id,creative" },
      });
      if (
        ad.id !== adId ||
        String(ad.account_id).replace(/^act_/, "") !==
          config.providerAccountId.replace(/^act_/, "") ||
        ad.status !== "PAUSED"
      )
        blocked(
          "Os anúncios precisam pertencer à conta aprovada e estar pausados. O estudo não ativa anúncios.",
        );
      before.push(ad);
    }
    await assertBinding(row, true);
    await save({
      intent: { owner, stage: "create", before, at: new Date().toISOString() },
    });
    mutationStarted = true;
    const created = await send(`${config.businessId}/ad_studies`, {
      method: "POST",
      payload: experimentPayload(config),
      idempotencyKey: `experiment:${experimentId}`,
    });
    const studyId = String(created.id ?? "");
    if (!/^\d+$/.test(studyId)) blocked("A Meta não confirmou o ID do estudo.");
    await save({ providerStudyId: studyId });
    const result = await send(studyId, { query: { fields: studyFields } });
    assertExperimentReadback(result, config, studyId);
    const completed = await save({
      status: "ready",
      evidence: {
        registrationVerified: true,
        adsActivated: false,
        resultAvailableAt: result.results_first_available_date ?? null,
        winner: null,
      },
    });
    await audit(completed, actor, "meta.experiment.registered");
    return completed;
  } catch {
    const stopped = await save({
      status: mutationStarted ? "manual_recovery" : "failed",
      evidence: {
        error: mutationStarted
          ? "EXPERIMENT_AMBIGUOUS"
          : "EXPERIMENT_PREFLIGHT_FAILED",
      },
    });
    await audit(stopped, actor, "meta.experiment.stopped");
    return stopped;
  }
}
export async function inspectExperiment(
  workspaceId: string,
  experimentId: string,
  transport = metaAccountAssetRequest,
) {
  const row = await owned(workspaceId, experimentId),
    config = await assertBinding(row, false);
  if (!row.providerStudyId) blocked("O estudo ainda não tem ID confirmado.");
  const result = await transport(
    workspaceId,
    row.accountId,
    row.providerStudyId,
    { query: { fields: studyFields } },
  );
  assertExperimentReadback(result, config, row.providerStudyId);
  const since = new Date(config.startAt).toISOString().slice(0, 10),
    until = new Date(Math.min(Date.parse(config.endAt), Date.now() - 60000)).toISOString().slice(0, 10);
  let comparison = null;
  if (until >= since) {
    const insights = await transport(workspaceId, row.accountId, "account/insights", { query: {
      fields: "ad_id,impressions,clicks,spend,actions,action_values", level: "ad", time_range: JSON.stringify({ since, until }), limit: "500",
      filtering: JSON.stringify([{ field: "ad.id", operator: "IN", value: [config.adA, config.adB] }]),
    } });
    comparison = compareExperimentInsights(Array.isArray(insights.data) ? insights.data : [], config.adA, config.adB);
  }
  await db.update(experiments).set({ evidence: { ...(row.evidence as Record<string, unknown>), comparison, comparisonCheckedAt: new Date().toISOString() } })
    .where(and(eq(experiments.id, row.id), eq(experiments.workspaceId, workspaceId)));
  return {
    id: row.id,
    providerStudyId: row.providerStudyId,
    registrationVerified: true,
    resultAvailableAt: result.results_first_available_date ?? null,
    winner: null,
    resultsStatus: comparison?.conclusion ?? "period_not_started",
    comparison,
  };
}
export async function recoverExperiment(
  workspaceId: string,
  experimentId: string,
  hash: string,
  studyId: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await owned(workspaceId, experimentId),
    config = await assertBinding(row, false);
  if (
    row.status !== "manual_recovery" ||
    row.configurationHash !== hash ||
    !/^\d+$/.test(studyId) ||
    (row.providerStudyId && row.providerStudyId !== studyId)
  )
    blocked("Revise o ID observado na Meta e o desenho interrompido.");
  assertExperimentReadback(
    await transport(workspaceId, row.accountId, studyId, {
      query: { fields: studyFields },
    }),
    config,
    studyId,
  );
  const [updated] = await db
    .update(experiments)
    .set({
      providerStudyId: studyId,
      status: "ready",
      evidence: {
        registrationVerified: true,
        recoveredBy: actor,
        winner: null,
        adsActivated: false,
      },
    })
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.workspaceId, workspaceId),
        eq(experiments.status, "manual_recovery"),
      ),
    )
    .returning();
  if (!updated) blocked("A recuperação mudou durante a conferência.");
  await audit(updated, actor, "meta.experiment.recovered");
  return updated;
}
export async function expireExperimentExecutions() {
  await db
    .update(experiments)
    .set({ status: "manual_recovery" })
    .where(
      and(
        inArray(experiments.status, ["executing", "rolling_back"]),
        lt(experiments.updatedAt, new Date(Date.now() - 300000)),
      ),
    );
}
export async function cancelExperiment(
  workspaceId: string,
  experimentId: string,
  hash: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await owned(workspaceId, experimentId),
    config = await assertBinding(row, true);
  if (row.configurationHash !== hash) blocked("Confirme o desenho aprovado.");
  if (row.status === "cancelled") return row;
  if (
    ["draft", "approved", "failed"].includes(row.status) &&
    !row.providerStudyId
  ) {
    const [cancelled] = await db
      .update(experiments)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(experiments.id, experimentId),
          eq(experiments.workspaceId, workspaceId),
          eq(experiments.status, row.status),
        ),
      )
      .returning();
    if (!cancelled) blocked("O estudo mudou.");
    await audit(cancelled, actor, "meta.experiment.cancelled_local");
    return cancelled;
  }
  if ((row.intent as any)?.stage === "delete")
    blocked("Confira a exclusão pendente sem repetir o DELETE.");
  if (
    !["ready", "manual_recovery"].includes(row.status) ||
    !row.providerStudyId
  )
    blocked(
      "Uma criação ambígua exige vincular o ID antes de excluir o estudo.",
    );
  const owner = randomUUID();
  const [claimed] = await db
    .update(experiments)
    .set({
      status: "rolling_back",
      intent: { owner, stage: "delete", at: new Date().toISOString() },
    })
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.workspaceId, workspaceId),
        eq(experiments.status, row.status),
      ),
    )
    .returning();
  if (!claimed) blocked("Estudo já em recuperação.");
  try {
    const before = await transport(
      workspaceId,
      row.accountId,
      row.providerStudyId,
      { query: { fields: studyFields } },
    );
    assertExperimentReadback(before, config, row.providerStudyId);
    await assertBinding(row, true);
    const [intent] = await db
      .update(experiments)
      .set({
        intent: {
          owner,
          stage: "delete",
          before,
          at: new Date().toISOString(),
        },
      })
      .where(
        and(
          eq(experiments.id, experimentId),
          eq(experiments.workspaceId, workspaceId),
          eq(experiments.status, "rolling_back"),
          sql`${experiments.intent}->>'owner' = ${owner}`,
        ),
      )
      .returning();
    if (!intent) blocked("A exclusão perdeu a propriedade.");
    const result = await transport(
      workspaceId,
      row.accountId,
      row.providerStudyId,
      { method: "DELETE", idempotencyKey: `experiment:${experimentId}:delete` },
    );
    if (result.success !== true) blocked("Exclusão não confirmada.");
    await db
      .update(experiments)
      .set({
        status: "manual_recovery",
        evidence: { deleteAccepted: true, adsDeleted: false },
      })
      .where(
        and(
          eq(experiments.id, experimentId),
          eq(experiments.workspaceId, workspaceId),
          eq(experiments.status, "rolling_back"),
          sql`${experiments.intent}->>'owner' = ${owner}`,
        ),
      );
    return verifyExperimentDeletion(
      workspaceId,
      experimentId,
      hash,
      actor,
      transport,
    );
  } catch {
    await db
      .update(experiments)
      .set({ status: "manual_recovery" })
      .where(
        and(
          eq(experiments.id, experimentId),
          eq(experiments.workspaceId, workspaceId),
          eq(experiments.status, "rolling_back"),
          sql`${experiments.intent}->>'owner' = ${owner}`,
        ),
      );
    blocked(
      "Confira a exclusão do estudo sem repetir a criação ou alterar anúncios.",
    );
  }
}
export async function verifyExperimentDeletion(
  workspaceId: string,
  experimentId: string,
  hash: string,
  actor: string,
  transport = metaAccountAssetRequest,
) {
  const row = await owned(workspaceId, experimentId),
    config = await assertBinding(row, false);
  if (row.status === "cancelled" && row.configurationHash === hash) return row;
  if (
    row.status !== "manual_recovery" ||
    row.configurationHash !== hash ||
    (row.intent as any)?.stage !== "delete" ||
    !row.providerStudyId
  )
    blocked("Não há exclusão pendente para este estudo.");
  let after = "",
    absent = false;
  for (let page = 0; page < 100; page++) {
    const list = await transport(
      workspaceId,
      row.accountId,
      `${config.businessId}/ad_studies`,
      { query: { fields: "id", limit: "500", ...(after ? { after } : {}) } },
    );
    if (
      !Array.isArray(list.data) ||
      list.data.some((item) => item.id === row.providerStudyId)
    )
      blocked("A ausência do estudo ainda não foi confirmada.");
    const paging = list.paging as any;
    if (!paging?.next) {
      absent = true;
      break;
    }
    if (!paging.cursors?.after || paging.cursors.after === after) break;
    after = paging.cursors.after;
  }
  if (!absent) blocked("A consulta de ausência ficou incompleta.");
  const [cancelled] = await db
    .update(experiments)
    .set({
      status: "cancelled",
      evidence: { absenceVerified: true, adsDeleted: false },
    })
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.workspaceId, workspaceId),
        eq(experiments.status, "manual_recovery"),
      ),
    )
    .returning();
  if (!cancelled) blocked("O estudo mudou.");
  await audit(cancelled, actor, "meta.experiment.deletion_verified");
  return cancelled;
}
