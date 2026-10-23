import { z } from "zod/v4";
import { isDeepStrictEqual } from "node:util";
import { and, eq, ne, sql } from "drizzle-orm";
import {
  auditLogsTable,
  campaignsTable,
  db,
  masterplanVersionsTable,
  paidMediaAccountsTable,
  paidMediaDatasetsTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";

export const paidMediaSetupSchema = z
  .object({
    accountId: z.string().uuid(),
    datasetId: z.string().uuid().nullable(),
    objective: z.enum(["OUTCOME_TRAFFIC", "OUTCOME_LEADS", "OUTCOME_SALES"]),
    conversionEvent: z
      .enum(["Lead", "CompleteRegistration", "Purchase"])
      .nullable(),
    amount: z
      .number()
      .positive("Informe um orçamento maior que zero.")
      .max(1_000_000_000)
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        "Use até duas casas decimais.",
      ),
    budgetKind: z.enum(["daily", "lifetime"]),
    budgetMode: z.enum(["abo", "cbo"]),
    startTime: z.iso.datetime().nullable(),
    endTime: z.iso.datetime().nullable(),
    destinationUrl: z
      .url()
      .refine((value) => new URL(value).protocol === "https:", "Use HTTPS."),
    country: z.string().regex(/^[A-Z]{2}$/),
    ageMin: z.number().int().min(18).max(65),
    ageMax: z.number().int().min(18).max(65),
    pageId: z.string().regex(/^\d+$/),
    imageUrl: z
      .url()
      .refine(
        (value) => new URL(value).protocol === "https:",
        "Use imagem HTTPS.",
      ),
    message: z.string().trim().min(1).max(5000),
    specialCategoriesConfirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.ageMin > value.ageMax)
      issue("ageMax", "A idade máxima precisa ser igual ou superior à mínima.");
    if (value.objective !== "OUTCOME_TRAFFIC" && !value.datasetId)
      issue("datasetId", "Selecione o pixel para otimizar conversões.");
    if (
      value.objective === "OUTCOME_SALES" &&
      value.conversionEvent !== "Purchase"
    )
      issue("conversionEvent", "Vendas exige Purchase.");
    if (
      value.objective === "OUTCOME_LEADS" &&
      !["Lead", "CompleteRegistration"].includes(value.conversionEvent ?? "")
    )
      issue("conversionEvent", "Leads exige Lead ou CompleteRegistration.");
    if (value.objective === "OUTCOME_TRAFFIC" && value.conversionEvent !== null)
      issue(
        "conversionEvent",
        "Tráfego otimiza cliques, sem evento de conversão.",
      );
    if (
      value.budgetKind === "lifetime" &&
      (!value.startTime ||
        !value.endTime ||
        Date.parse(value.startTime) >= Date.parse(value.endTime))
    )
      issue(
        "endTime",
        "Informe início e fim válidos para o orçamento do período.",
      );
  });
export type PaidMediaSetup = z.infer<typeof paidMediaSetupSchema>;

export function executablePaidMediaSetup(
  setup: PaidMediaSetup,
  account: { providerAccountId: string; currency: string },
  pixelId?: string,
) {
  if (!["BRL", "USD", "EUR", "GBP"].includes(account.currency))
    throw new AppError(
      422,
      "Moeda da conta ainda não suportada pelo compilador.",
      "BUDGET_CURRENCY_UNSUPPORTED",
    );
  if (setup.datasetId && (!pixelId || !/^\d+$/.test(pixelId)))
    throw new AppError(
      422,
      "O dataset deve conter o ID numérico do pixel Meta.",
      "INVALID_TRACKING_DATASET",
    );
  return {
    accountId: account.providerAccountId,
    objective: setup.objective,
    destinationType: "WEBSITE",
    destinationUrl: setup.destinationUrl,
    specialAdCategories: [],
    budget: {
      amount: setup.amount,
      kind: setup.budgetKind,
      mode: setup.budgetMode,
      currency: account.currency,
    },
    tracking: setup.conversionEvent
      ? { pixelId, conversionEvent: setup.conversionEvent }
      : {},
    audiences: [
      {
        geo_locations: { countries: [setup.country] },
        age_min: setup.ageMin,
        age_max: setup.ageMax,
      },
    ],
    creatives: [
      {
        object_story_spec: {
          page_id: setup.pageId,
          link_data: {
            link: setup.destinationUrl,
            picture: setup.imageUrl,
            message: setup.message,
          },
        },
      },
    ],
  };
}

export function paidMediaSnapshotFields(
  strategy: unknown,
  intakeData: unknown,
) {
  const source = intakeData as {
    paidMediaSetup?: { configuration?: unknown; form?: PaidMediaSetup };
  } | null;
  const saved = source?.paidMediaSetup;
  return {
    strategy: saved?.configuration
      ? {
          ...((strategy as Record<string, unknown>) ?? {}),
          paidMedia: saved.configuration,
        }
      : strategy,
    schedule:
      saved?.form?.budgetKind === "lifetime"
        ? { startTime: saved.form.startTime, endTime: saved.form.endTime }
        : {},
  };
}

export function assertPaidMediaApprovalMatchesCampaign(strategy: unknown, intakeData: unknown, snapshot: unknown): void {
  const current = paidMediaSnapshotFields(strategy, intakeData);
  const saved = snapshot as { strategy?: { paidMedia?: unknown }; campaign?: Record<string, unknown> };
  const expected = (current.strategy as { paidMedia?: unknown } | null)?.paidMedia;
  if (!isDeepStrictEqual(expected, saved.strategy?.paidMedia)
    || Object.entries(current.schedule).some(([key, value]) => saved.campaign?.[key] !== value)) {
    throw new AppError(409, "A configuração de anúncios mudou. Atualize e revise uma nova versão do Master Plan.", "PAID_MEDIA_SETUP_STALE");
  }
}

export async function getPaidMediaSetup(
  workspaceId: string,
  campaignId: string,
) {
  const [campaign] = await db
    .select({
      intakeData: campaignsTable.intakeData,
      productIntakeVersionId: campaignsTable.productIntakeVersionId,
    })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  return {
    setup:
      (campaign.intakeData as Record<string, unknown> | null)?.paidMediaSetup ??
      null,
    productIntakeVersionId: campaign.productIntakeVersionId,
  };
}

export async function savePaidMediaSetup(
  workspaceId: string,
  campaignId: string,
  actor: string,
  input: unknown,
) {
  const parsed = paidMediaSetupSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      422,
      parsed.error.issues[0]?.message ?? "Revise os dados dos anúncios.",
      "PAID_MEDIA_SETUP_INVALID",
      parsed.error.issues,
    );
  const form = parsed.data;
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, workspaceId),
        ),
      )
      .for("update")
      .limit(1);
    if (!campaign) throw new NotFoundError("Campaign");
    const [account] = await tx
      .select()
      .from(paidMediaAccountsTable)
      .where(
        and(
          eq(paidMediaAccountsTable.id, form.accountId),
          eq(paidMediaAccountsTable.workspaceId, workspaceId),
          eq(paidMediaAccountsTable.provider, "meta_ads"),
          eq(paidMediaAccountsTable.isSelected, true),
        ),
      )
      .limit(1);
    if (!account)
      throw new AppError(
        422,
        "Selecione uma conta Meta autorizada em Mídia paga antes de configurar os anúncios.",
        "ACCOUNT_SELECTION_REQUIRED",
      );
    const [dataset] = form.datasetId
      ? await tx
          .select()
          .from(paidMediaDatasetsTable)
          .where(
            and(
              eq(paidMediaDatasetsTable.id, form.datasetId),
              eq(paidMediaDatasetsTable.workspaceId, workspaceId),
              eq(paidMediaDatasetsTable.accountId, account.id),
              eq(paidMediaDatasetsTable.provider, "meta_ads"),
            ),
          )
          .limit(1)
      : [];
    if (form.datasetId && !dataset)
      throw new AppError(
        422,
        "O pixel precisa pertencer à conta selecionada.",
        "INVALID_TRACKING_DATASET",
      );
    const setup = {
      form,
      configuration: executablePaidMediaSetup(
        form,
        account,
        dataset?.providerDatasetId,
      ),
      savedAt: new Date().toISOString(),
    };
    await tx
      .update(campaignsTable)
      .set({
        intakeData: sql`jsonb_set(coalesce(${campaignsTable.intakeData}, '{}'::jsonb), '{paidMediaSetup}', ${JSON.stringify(setup)}::jsonb)`,
      })
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, workspaceId),
        ),
      );
    // Old approved versions must stop authorizing launches as soon as the user
    // changes their executable briefing. No provider asset is modified here.
    await tx
      .update(masterplanVersionsTable)
      .set({ status: "superseded", supersededAt: new Date() })
      .where(
        and(
          eq(masterplanVersionsTable.workspaceId, workspaceId),
          eq(masterplanVersionsTable.campaignId, campaignId),
          ne(masterplanVersionsTable.status, "superseded"),
        ),
      );
    await tx
      .insert(auditLogsTable)
      .values({
        workspaceId,
        campaignId,
        actor,
        action: "paid_media.setup.saved",
        data: {
          accountId: account.id,
          objective: form.objective,
          budgetMode: form.budgetMode,
          newApprovalRequired: true,
        },
      });
    return { setup, newApprovalRequired: true };
  });
}
