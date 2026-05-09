import { eq, and, desc } from "drizzle-orm";
import {
  db,
  vslsTable,
  campaignsTable,
} from "@workspace/db";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { runVSLScriptAgent } from "../agents/vsl-script.agent.js";
import { deductCredits } from "../credits/credits.service.js";
import type { StrategyOutput } from "../agents/strategy.agent.js";
import type { Logger } from "pino";

const VSL_CREDITS = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateVslInput {
  campaignId?: string;
  title: string;
  format?: "vsl" | "webinar" | "masterclass" | "challenge_day" | "long_form_video";
  productName?: string;
  productPrice?: string;
  targetAudience?: string;
  mainPromise?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function createVsl(workspaceId: string, input: CreateVslInput) {
  if (input.campaignId) {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, input.campaignId),
          eq(campaignsTable.workspaceId, workspaceId),
        ),
      );
    if (!campaign) throw new NotFoundError("Campaign not found");
  }

  const [vsl] = await db
    .insert(vslsTable)
    .values({
      workspaceId,
      campaignId: input.campaignId ?? null,
      title: input.title,
      format: input.format ?? "vsl",
      productName: input.productName ?? null,
      productPrice: input.productPrice ?? null,
      targetAudience: input.targetAudience ?? null,
      mainPromise: input.mainPromise ?? null,
    })
    .returning();

  return vsl!;
}

export async function getVsls(workspaceId: string, campaignId?: string) {
  const conditions = [eq(vslsTable.workspaceId, workspaceId)];
  if (campaignId) conditions.push(eq(vslsTable.campaignId, campaignId));

  return db
    .select()
    .from(vslsTable)
    .where(and(...conditions))
    .orderBy(desc(vslsTable.createdAt));
}

export async function getVsl(workspaceId: string, vslId: string) {
  const [vsl] = await db
    .select()
    .from(vslsTable)
    .where(
      and(eq(vslsTable.id, vslId), eq(vslsTable.workspaceId, workspaceId)),
    );
  if (!vsl) throw new NotFoundError("VSL not found");
  return vsl;
}

export async function generateVsl(
  workspaceId: string,
  vslId: string,
  log: Logger,
) {
  const vsl = await getVsl(workspaceId, vslId);

  if (!["draft", "rejected"].includes(vsl.status)) {
    throw new ValidationError("Only draft or rejected VSLs can be regenerated");
  }

  await db
    .update(vslsTable)
    .set({ status: "generating", generationStartedAt: new Date() })
    .where(eq(vslsTable.id, vslId));

  let intakeData: Record<string, unknown> = {
    "product.name": vsl.productName ?? "",
    "product.price": vsl.productPrice ?? "",
    "campaign.targetAudience": vsl.targetAudience ?? "",
    "product.mainPromise": vsl.mainPromise ?? "",
    "campaign.salesChannel": "vsl",
  };

  if (vsl.campaignId) {
    const [campaign] = await db
      .select({ intakeData: campaignsTable.intakeData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, vsl.campaignId));
    if (campaign) {
      intakeData = { ...intakeData, ...(campaign.intakeData as Record<string, unknown>) };
    }
  }

  try {
    const { runStrategyAgent } = await import("../agents/strategy.agent.js");
    const { runProfileBuilderAgent } = await import("../agents/profile-builder.agent.js");

    const [strategyResult, profileResult] = await Promise.allSettled([
      runStrategyAgent(vsl.campaignId ?? vslId, workspaceId, intakeData, "six_digits", log),
      runProfileBuilderAgent(vsl.campaignId ?? vslId, workspaceId, intakeData, "launch", log),
    ]);

    const fallbackStrategy: StrategyOutput = {
      executiveSummary: "",
      marketDiagnosis: {
        marketMaturity: "growing",
        competitiveLandscape: "",
        entryBarriers: [],
        opportunities: [],
        threats: [],
      },
      offerPositioning: {
        uniqueValueProposition: vsl.mainPromise ?? "",
        primaryDifferentiator: "",
        positioning: "",
        priceJustification: "",
        competitiveAdvantages: [],
      },
      audienceSegmentation: {
        primaryAvatar: vsl.targetAudience ?? "",
        secondaryAvatars: [],
        psychographicProfile: "",
        buyingTriggers: [],
        objections: [],
        sophisticationStrategy: "",
      },
      campaignArchitecture: {
        coreNarrative: vsl.mainPromise ?? "",
        emotionalHook: "",
        keyMessages: [],
        contentPillars: [],
        callToActionStrategy: "",
      },
      successMetrics: {
        primaryKPI: "",
        conversionRateTarget: 0,
        revenueTarget: 0,
        criticalAssumptions: [],
      },
      risks: { level: "low", mainRisks: [], mitigations: [] },
      strategistNotes: "",
    };

    const strategy = strategyResult.status === "fulfilled" ? strategyResult.value : fallbackStrategy;
    const profile = profileResult.status === "fulfilled" ? profileResult.value : undefined;

    const result = await runVSLScriptAgent(
      vsl.campaignId ?? vslId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      log,
    );

    await db
      .update(vslsTable)
      .set({
        status: "generated",
        totalDuration: result.totalDuration,
        totalWordCount: result.totalWordCount,
        hookData: result.hook as unknown as Record<string, unknown>,
        sections: result.sections as unknown as unknown[],
        offerReveal: result.offerReveal as unknown as Record<string, unknown>,
        ctas: result.ctas as unknown as Record<string, unknown>,
        technicalNotes: result.technicalNotes as unknown as Record<string, unknown>,
        vslNotes: result.vslNotes,
        aiProvider: "openai",
        creditsUsed: VSL_CREDITS,
      })
      .where(eq(vslsTable.id, vslId));

    await deductCredits(workspaceId, "copy_generation", log, vsl.campaignId ?? undefined).catch(() => {});

    return getVsl(workspaceId, vslId);
  } catch (err) {
    await db
      .update(vslsTable)
      .set({ status: "draft" })
      .where(eq(vslsTable.id, vslId));
    throw err;
  }
}

export async function updateVslSection(
  workspaceId: string,
  vslId: string,
  sectionId: string,
  patch: { script?: string; toneNotes?: string; visualDirection?: string; objective?: string },
) {
  const vsl = await getVsl(workspaceId, vslId);
  const sections = (vsl.sections as Array<Record<string, unknown>>) ?? [];
  const idx = sections.findIndex((s) => s["sectionId"] === sectionId);
  if (idx === -1) throw new NotFoundError("Section not found");

  sections[idx] = { ...sections[idx], ...patch };

  const [updated] = await db
    .update(vslsTable)
    .set({ sections: sections as unknown as unknown[] })
    .where(eq(vslsTable.id, vslId))
    .returning();

  return updated!;
}

export async function approveVsl(workspaceId: string, vslId: string) {
  const vsl = await getVsl(workspaceId, vslId);

  if (!["generated", "pending_approval"].includes(vsl.status)) {
    throw new ValidationError("VSL must be generated before approval");
  }

  const [updated] = await db
    .update(vslsTable)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(vslsTable.id, vslId))
    .returning();

  return updated!;
}

export async function rejectVsl(
  workspaceId: string,
  vslId: string,
  reason: string,
) {
  const vsl = await getVsl(workspaceId, vslId);

  if (!["generated", "pending_approval"].includes(vsl.status)) {
    throw new ValidationError("VSL must be generated before rejection");
  }

  const [updated] = await db
    .update(vslsTable)
    .set({ status: "rejected", rejectedAt: new Date(), rejectionReason: reason })
    .where(eq(vslsTable.id, vslId))
    .returning();

  return updated!;
}
